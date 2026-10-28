// Edge Function: Gym AI Coach.
// Valida la sesión, aplica límite de uso, construye un contexto mínimo y llama al proveedor de IA.
// La clave del proveedor se lee del entorno del servidor y nunca llega al navegador.
import { createClient } from "@supabase/supabase-js";
import {
  COACH_SYSTEM_PROMPT, conversationTitle, formatContext, isRateLimited, prepareHistory, validateChatRequest,
  type HistoryMessage,
} from "../_shared/coach.ts";
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
  const { message } = parsed.value;

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
    .insert({ conversation_id: conversationId, user_id: userId, role: "user", content: message, source: "user" });
  if (insertError) return json({ error: "No se pudo guardar el mensaje." }, 500);

  // Contexto mínimo (RLS).
  const now = new Date();
  const todayWeekday = (now.getUTCDay() + 6) % 7;
  const weekStart = new Date(now.getTime() - todayWeekday * 86_400_000);
  const [profile, settings, onboarding, goals, plan, nutrition, cycleToday] = await Promise.all([
    userDb.from("profiles").select("display_name, language").eq("id", userId).single(),
    userDb.from("user_settings").select("ai_share_context, cycle_tracking_enabled").eq("user_id", userId).single(),
    userDb.from("onboarding_responses").select("fitness, environment, health").eq("user_id", userId).maybeSingle(),
    userDb.from("fitness_goals").select("goal, priority, status"),
    userDb.from("workout_plans").select("id, days_per_week, schedule").eq("is_active", true).maybeSingle(),
    userDb.from("nutrition_preferences").select("diet, allergens").maybeSingle(),
    userDb.from("cycle_logs").select("symptoms, energy").eq("logged_on", isoDate(now)).maybeSingle(),
  ]);
  const [planExercises, sessions, sets] = await Promise.all([
    plan.data ? userDb.from("workout_exercises").select("day_index, position, exercise_id").eq("plan_id", plan.data.id) : Promise.resolve({ data: [] }),
    userDb.from("workout_sessions").select("started_at, title, status").order("started_at", { ascending: false }).limit(20),
    userDb.from("exercise_sets").select("exercise_id, weight_kg, reps, completed").order("created_at", { ascending: false }).limit(200),
  ]);
  const ids = new Set<string>([
    ...((planExercises.data ?? []) as { exercise_id: string }[]).map((e) => e.exercise_id),
    ...((sets.data ?? []) as { exercise_id: string }[]).map((s) => s.exercise_id),
  ]);
  const { data: names } = ids.size
    ? await userDb.from("exercise_library").select("id, name").in("id", [...ids])
    : { data: [] as { id: string; name: string }[] };
  const nameById = new Map((names ?? []).map((n: { id: string; name: string }) => [n.id, n.name]));

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

  // 1. Señales de alarma: respuesta de seguridad sin llamar al proveedor.
  // 2. Proveedor de IA configurado: respuesta generada.
  // 3. Sin proveedor o con error: modo de respaldo identificado como tal.
  let reply: { text: string; source: "ai" | "fallback" | "safety"; notice?: string };
  const flags = detectRedFlags(message);
  const provider = providerFromEnv();
  if (flags.length) {
    reply = { text: safetyMessage(flags, context.language), source: "safety" };
  } else if (!provider) {
    reply = { ...fallbackReply(message, context), notice: "El proveedor de IA no está configurado. Respuesta del modo de respaldo." };
  } else {
    const result = await provider.complete({
      system: COACH_SYSTEM_PROMPT,
      context: formatContext(context),
      messages: prepareHistory(history, message),
    });
    if (result.ok) {
      reply = { text: result.text, source: "ai" };
    } else {
      console.error("coach provider error", result.reason, result.detail ?? "");
      reply = {
        ...fallbackReply(message, context),
        notice: result.reason === "timeout"
          ? "La IA tardó demasiado en responder. Te mostramos una respuesta del modo de respaldo."
          : "La IA no está disponible en este momento. Te mostramos una respuesta del modo de respaldo.",
      };
    }
  }

  const { data: saved, error: saveError } = await admin.from("chat_messages")
    .insert({ conversation_id: conversationId, user_id: userId, role: "assistant", content: reply.text.slice(0, 8000), source: reply.source })
    .select("id, conversation_id, user_id, role, content, source, created_at").single();
  if (saveError) console.error("save assistant message", saveError.message);
  await admin.from("chat_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);

  return json({ conversationId, message: saved, source: reply.source, notice: reply.notice ?? null });
});
