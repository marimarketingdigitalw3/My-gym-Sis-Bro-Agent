// Edge Function: Gym Sis · Mis outfits. Consejos de combinación con las fotos del clóset de la persona.
// Lee prendas y preferencias con RLS, envía las fotos elegidas al proveedor de IA y guarda el consejo.
// Sin proveedor o con error, responde con el consejo de respaldo basado en reglas.
import { createClient } from "@supabase/supabase-js";
import { AnthropicProvider } from "../_shared/ai/anthropic.ts";
import type { ImageInput } from "../_shared/ai/provider.ts";
import {
  formatStyleContext, STYLE_SYSTEM_PROMPT, styleFallback, validateStyleRequest, type StyleProfileLike, type WardrobeItemLike,
} from "../_shared/style.ts";

const CORS = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const BUCKET = "wardrobe";
const MEDIA: Record<string, ImageInput["mediaType"]> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const NOTICES: Record<string, string> = {
  billing: "La cuenta de IA no tiene saldo. Te damos un consejo del modo de respaldo.",
  timeout: "La IA tardó demasiado. Te damos un consejo del modo de respaldo.",
  unavailable: "La IA no está disponible ahora. Te damos un consejo del modo de respaldo.",
};

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "No autenticado." }, 401);
  const userDb = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const { data: auth, error: authError } = await userDb.auth.getUser();
  if (authError || !auth.user) return json({ error: "Sesión inválida." }, 401);
  const userId = auth.user.id;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }
  const parsed = validateStyleRequest(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  const { activity, itemIds, question } = parsed.value;

  const limit = Number(Deno.env.get("STYLE_RATE_LIMIT_PER_HOUR") ?? 15);
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await admin.from("style_advice").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since);
  if ((count ?? 0) >= limit) return json({ error: "Alcanzaste el límite de consejos por hora. Vuelve a intentarlo más tarde." }, 429);

  const [profileRes, closetRes, personRes] = await Promise.all([
    userDb.from("style_profiles").select("styles, favorite_colors, avoid_colors, fit, coverage, activities, notes").maybeSingle(),
    userDb.from("wardrobe_items").select("id, category, colors, name, storage_path").order("created_at", { ascending: false }).limit(80),
    userDb.from("profiles").select("display_name").maybeSingle(),
  ]);
  const profile = (profileRes.data ?? null) as StyleProfileLike | null;
  const closet = (closetRes.data ?? []) as (WardrobeItemLike & { storage_path: string })[];
  const selected = itemIds.map((id) => closet.find((i) => i.id === id)).filter((i): i is WardrobeItemLike & { storage_path: string } => !!i);
  if (selected.length !== itemIds.length) return json({ error: "Alguna prenda no existe en tu clóset." }, 404);
  const rest = closet.filter((i) => !itemIds.includes(i.id));

  let content: string;
  let source: "ai" | "fallback" = "fallback";
  let notice: string | null = null;
  const fallback = () => styleFallback({ activity, profile, selected, closet: rest.length || selected.length ? [...selected, ...rest] : [] });

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    content = fallback();
    notice = "La IA no está configurada. Te damos un consejo del modo de respaldo.";
  } else {
    const images: ImageInput[] = [];
    for (const item of selected) {
      const { data: blob } = await admin.storage.from(BUCKET).download(item.storage_path);
      if (!blob) continue;
      const ext = item.storage_path.split(".").pop()?.toLowerCase() ?? "jpg";
      images.push({ mediaType: MEDIA[ext] ?? "image/jpeg", base64: toBase64(new Uint8Array(await blob.arrayBuffer())) });
    }
    const provider = new AnthropicProvider({ apiKey, model: Deno.env.get("COACH_MODEL") ?? undefined });
    const firstName = String(personRes.data?.display_name ?? "").split(" ")[0].slice(0, 30);
    const result = await provider.complete({
      system: STYLE_SYSTEM_PROMPT,
      context: formatStyleContext({ activity, profile, selected, closet: rest, question, firstName }),
      messages: [{ role: "user", content: question || "Arma mi look para hoy con lo que tengo." }],
      images,
    });
    if (result.ok && result.text) {
      content = result.text;
      source = "ai";
    } else {
      if (!result.ok) console.error("style provider error", result.reason, result.detail ?? "");
      content = fallback();
      notice = NOTICES[result.ok ? "unavailable" : result.reason] ?? NOTICES.unavailable;
    }
  }

  const { data: saved, error } = await admin.from("style_advice")
    .insert({ user_id: userId, activity, item_ids: itemIds, question: question || null, content: content.slice(0, 8000), source })
    .select("id, user_id, activity, item_ids, question, content, source, created_at").single();
  if (error) console.error("save style advice", error.message);
  return json({ advice: saved, notice });
});
