// Edge Function: Gym AI Coach.
// Valida la sesión, aplica límite de uso, construye un contexto mínimo y llama al proveedor de IA.
// La clave del proveedor se lee del entorno del servidor y nunca llega al navegador.
import { createClient } from "@supabase/supabase-js";
import {
  COACH_SYSTEM_PROMPT, conversationTitle, formatCatalog, formatContext, isRateLimited, prepareHistory, validateChatRequest,
  type CatalogEntry, type HistoryMessage,
} from "../_shared/coach.ts";
import { actionFromTool, COACH_TOOLS, describeAction, MAX_ACTIONS_PER_REPLY, type CoachAction, type StoredAction } from "../_shared/coachActions.ts";
import type { ImageInput } from "../_shared/ai/provider.ts";
import { buildCoachContext } from "../_shared/coachContext.ts";
import { fallbackReply } from "../_shared/coachFallback.ts";
import { detectRedFlags, safetyMessage } from "../_shared/safety.ts";
import { AnthropicProvider } from "../_shared/ai/anthropic.ts";
import type { ChatProvider } from "../_shared/ai/provider.ts";

const CORS = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function providerFromEnv(): ChatProvider | null {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return null;
  return new AnthropicProvider({ apiKey, model: Deno.env.get("COACH_MODEL") ?? undefined });
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

const ATTACHMENT_BUCKET = "chat-attachments";
const MEDIA: Record<string, ImageInput["mediaType"]> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Convierte llamadas a herramientas en acciones guardables con etiqueta en español. */
function storedActions(calls: { name: string; input: unknown }[], exerciseName: (id: string) => string, validExercise: (id: string) => boolean): StoredAction[] {
  const out: StoredAction[] = [];
  for (const c of calls) {
    const a: CoachAction | null = actionFromTool(c.name, c.input);
    if (!a) continue;
    if ("exercise_id" in a && !validExercise(a.exercise_id)) continue;
    if (a.type === "swap_exercise" && !validExercise(a.replacement_id)) continue;
    out.push({ id: crypto.randomUUID(), action: a, label: describeAction(a, exerciseName), applied_at: null });
    if (out.length >= MAX_ACTIONS_PER_REPLY) break;
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "No autenticado." }, 401);

  // Cliente con el JWT del usuario: todas las lecturas pasan por RLS.
  const userDb = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: auth, error: authError } = await userDb.auth.getUser();
  if (authError || !auth.user) return json({ error: "Sesión inválida." }, 401);
  const userId = auth.user.id;
  // Cliente de servicio: solo para escribir respuestas del asistente y contar el uso.
  const admin = createClient(url, serviceKey);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }
  const parsed = validateChatRequest(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  const { message, attachments } = parsed.value;
  if (attachments.some((p) => !p.startsWith(`${userId}/`))) return json({ error: "Adjunto no permitido." }, 403);

  const limit = Number(Deno.env.get("COACH_RATE_LIMIT_PER_HOUR") ?? 30);
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await admin.from("chat_messages").select("id", { count: "exact", head: true })
    .eq("user_id", userId).eq("role", "user").gte("created_at", since);
  if (isRateLimited(count ?? 0, limit)) {
    return json({ error: "Alcanzaste el límite de mensajes por hora. Vuelve a intentarlo más tarde." }, 429);
  }

  // Conversación: se verifica la propiedad con el cliente del usuario (RLS).
  let conversationId = parsed.value.conversationId;
  if (conversationId) {
    const { data } = await userDb.from("chat_conversations").select("id").eq("id", conversationId).maybeSingle();
    if (!data) return json({ error: "Conversación no encontrada." }, 404);
  } else {
    const { data, error } = await userDb.from("chat_conversations")
      .insert({ user_id: userId, title: conversationTitle(message) }).select("id").single();
    if (error || !data) return json({ error: "No se pudo crear la conversación." }, 500);
    conversationId = data.id as string;
  }

  const { data: historyRows } = await userDb.from("chat_messages").select("role, content")
    .eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(12);
  const history = ((historyRows ?? []) as HistoryMessage[]).reverse();

  const { error: insertError } = await userDb.from("chat_messages")
    .insert({ conversation_id: conversationId, user_id: userId, role: "user", content: message || "(foto)", source: "user", attachments });
  if (insertError) return json({ error: "No se pudo guardar el mensaje." }, 500);

  // Contexto mínimo (RLS).
  const now = new Date();
  const todayWeekday = (now.getUTCDay() + 6) % 7;
  const weekStart = new Date(now.getTime() - todayWeekday * 86_400_000);
  const [profile, settings, onboarding, goals, plan, nutrition, cycleToday, library] = await Promise.all([
    userDb.from("profiles").select("display_name, language").eq("id", userId).single(),
    userDb.from("user_settings").select("ai_share_context, cycle_tracking_enabled").eq("user_id", userId).single(),
    userDb.from("onboarding_responses").select("fitness, environment, health").eq("user_id", userId).maybeSingle(),
    userDb.from("fitness_goals").select("goal, priority, status"),
    userDb.from("workout_plans").select("id, days_per_week, schedule").eq("is_active", true).maybeSingle(),
    userDb.from("nutrition_preferences").select("diet, allergens, meals_per_day, supplements, wake_time, sleep_time").maybeSingle(),
    userDb.from("cycle_logs").select("symptoms, energy").eq("logged_on", isoDate(now)).maybeSingle(),
    userDb.from("exercise_library").select("id, name, primary_muscles, equipment").order("id"),
  ]);
  const catalog: CatalogEntry[] = ((library.data ?? []) as { id: string; name: string; primary_muscles: string[]; equipment: string[] }[])
    .map((e) => ({ id: e.id, name: e.name, muscles: e.primary_muscles ?? [], equipment: e.equipment ?? [] }));
  const [planExercises, sessions, sets] = await Promise.all([
    plan.data ? userDb.from("workout_exercises").select("day_index, position, exercise_id").eq("plan_id", plan.data.id) : Promise.resolve({ data: [] }),
    userDb.from("workout_sessions").select("started_at, title, status").order("started_at", { ascending: false }).limit(20),
    userDb.from("exercise_sets").select("exercise_id, weight_kg, reps, completed").order("created_at", { ascending: false }).limit(200),
  ]);
  const nameById = new Map(catalog.map((e) => [e.id, e.name]));

  const context = buildCoachContext({
    profile: profile.data ?? { display_name: "", language: "es" },
    settings: settings.data ?? { ai_share_context: false, cycle_tracking_enabled: false },
    onboarding: onboarding.data,
    goals: goals.data ?? [],
    plan: plan.data,
    planExercises: planExercises.data ?? [],
    recentSessions: sessions.data ?? [],
    recentSets: sets.data ?? [],
    nutrition: nutrition.data,
    proteinTargetG: null,
    cycleToday: cycleToday.data,
    todayWeekday,
    weekStartISO: isoDate(weekStart),
    exerciseName: (id) => nameById.get(id) ?? id,
  });

  // Fotos adjuntas: se leen del bucket privado y se envían al proveedor como imágenes.
  const images: ImageInput[] = [];
  for (const path of attachments) {
    const { data: blob, error: dlError } = await admin.storage.from(ATTACHMENT_BUCKET).download(path);
    if (dlError || !blob) { console.error("attachment download", path, dlError?.message); continue; }
    const ext = path.split(".").pop()?.toLowerCase() ?? "jpg";
    images.push({ mediaType: MEDIA[ext] ?? "image/jpeg", base64: toBase64(new Uint8Array(await blob.arrayBuffer())) });
  }

  const exerciseName = (id: string) => nameById.get(id) ?? id;
  const validExercise = (id: string) => nameById.has(id);
  const catalogItems = catalog.map((e) => ({ id: e.id, name: e.name }));
  const fallback = (notice: string) => {
    const f = fallbackReply(message, context, catalogItems);
    return { text: f.text, source: f.source, notice, actions: storedActions(f.actions.map((a) => ({ name: a.type, input: a })), exerciseName, validExercise) };
  };

  // 1. Señales de alarma: respuesta de seguridad sin llamar al proveedor.
  // 2. Proveedor de IA configurado: respuesta generada, con acciones propuestas si las hay.
  // 3. Sin proveedor o con error: modo de respaldo identificado como tal.
  let reply: { text: string; source: "ai" | "fallback" | "safety"; notice?: string; actions: StoredAction[] };
  const flags = detectRedFlags(message);
  const provider = providerFromEnv();
  if (flags.length) {
    reply = { text: safetyMessage(flags, context.language), source: "safety", actions: [] };
  } else if (!provider) {
    reply = fallback("El proveedor de IA no está configurado. Respuesta del modo de respaldo.");
  } else {
    const result = await provider.complete({
      system: COACH_SYSTEM_PROMPT,
      reference: formatCatalog(catalog),
      context: formatContext(context),
      messages: prepareHistory(history, message || "(Envío una foto. Dime qué ves y qué me recomiendas.)"),
      images,
      tools: [...COACH_TOOLS],
    });
    if (result.ok) {
      const actions = storedActions(result.toolCalls, exerciseName, validExercise);
      const one = actions.length === 1;
      const text = result.text || (actions.length
        ? `Preparé ${one ? "este cambio" : "estos cambios"} para que lo${one ? "" : "s"} confirmes:\n${actions.map((a) => `• ${a.label}`).join("\n")}`
        : "");
      reply = { text, source: "ai", actions };
    } else {
      console.error("coach provider error", result.reason, result.detail ?? "");
      reply = fallback(result.reason === "timeout"
        ? "La IA tardó demasiado en responder. Te mostramos una respuesta del modo de respaldo."
        : "La IA no está disponible en este momento. Te mostramos una respuesta del modo de respaldo.");
    }
  }

  const { data: saved, error: saveError } = await admin.from("chat_messages")
    .insert({ conversation_id: conversationId, user_id: userId, role: "assistant", content: reply.text.slice(0, 8000), source: reply.source, actions: reply.actions })
    .select("id, conversation_id, user_id, role, content, source, created_at, attachments, actions").single();
  if (saveError) console.error("save assistant message", saveError.message);
  await admin.from("chat_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);

  return json({ conversationId, message: saved, source: reply.source, notice: reply.notice ?? null });
});
