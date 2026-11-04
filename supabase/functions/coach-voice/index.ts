// Edge Function: voz del coach con ElevenLabs.
// - speak: convierte una respuesta del coach (de la propia persona) en audio y lo guarda en caché.
// - transcribe: convierte una nota de voz en texto para enviarla al coach.
// La clave ELEVENLABS_API_KEY solo existe en el servidor. Sin clave responde 503 y la app usa la voz del navegador.
import { createClient } from "@supabase/supabase-js";
import {
  DEFAULT_STT_MODEL, DEFAULT_TTS_MODEL, DEFAULT_VOICES, isAllowedAudio, isVoiceKind, speechText, voiceIdFor,
} from "../_shared/voice.ts";

const CORS = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const API = "https://api.elevenlabs.io/v1";
const BUCKET = "chat-attachments";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function tts(apiKey: string, voiceId: string, text: string): Promise<Response> {
  return await fetch(`${API}/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: Deno.env.get("ELEVENLABS_TTS_MODEL") || DEFAULT_TTS_MODEL, language_code: "es" }),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "No autenticado." }, 401);
  const userDb = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: auth, error: authError } = await userDb.auth.getUser();
  if (authError || !auth.user) return json({ error: "Sesión inválida." }, 401);
  const userId = auth.user.id;

  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) return json({ error: "La voz del coach no está configurada.", code: "voice_not_configured" }, 503);
  const admin = createClient(url, serviceKey);

  // ---------- Transcripción (nota de voz → texto) ----------
  if ((req.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return json({ error: "Audio inválido." }, 400);
    }
    const audio = form.get("audio");
    if (!(audio instanceof File) || !isAllowedAudio(audio.type, audio.size)) {
      return json({ error: "La nota de voz no es válida o supera 10 MB." }, 400);
    }
    const body = new FormData();
    body.append("model_id", Deno.env.get("ELEVENLABS_STT_MODEL") || DEFAULT_STT_MODEL);
    body.append("language_code", "spa");
    body.append("file", audio, audio.name || "nota.webm");
    const res = await fetch(`${API}/speech-to-text`, { method: "POST", headers: { "xi-api-key": apiKey }, body });
    if (!res.ok) {
      console.error("elevenlabs stt", res.status, (await res.text()).slice(0, 300));
      return json({ error: "No pudimos transcribir la nota de voz.", code: res.status === 401 ? "voice_auth" : "voice_unavailable" }, 502);
    }
    const data = await res.json() as { text?: string };
    return json({ text: (data.text ?? "").trim() });
  }

  // ---------- Lectura en voz alta de una respuesta ----------
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }
  const messageId = payload.messageId;
  const kind = isVoiceKind(payload.voice) ? payload.voice : "female";
  if (typeof messageId !== "string" || !UUID_RE.test(messageId)) return json({ error: "Mensaje inválido." }, 400);

  // Solo respuestas del coach de la propia persona (RLS).
  const { data: msg } = await userDb.from("chat_messages").select("id, role, content").eq("id", messageId).maybeSingle();
  if (!msg || msg.role !== "assistant") return json({ error: "Mensaje no encontrado." }, 404);

  const voiceId = voiceIdFor(kind, (n) => Deno.env.get(n));
  const path = `${userId}/voice/${messageId}-${voiceId}.mp3`;
  const store = admin.storage.from(BUCKET);
  const signed = async () => (await store.createSignedUrl(path, 60 * 30)).data?.signedUrl ?? null;

  // Caché: cada respuesta se convierte en audio una sola vez por voz.
  const { data: existing } = await store.list(`${userId}/voice`, { search: `${messageId}-${voiceId}.mp3` });
  if (existing?.some((o) => o.name === `${messageId}-${voiceId}.mp3`)) return json({ url: await signed(), cached: true });

  const text = speechText(String(msg.content ?? ""));
  if (!text) return json({ error: "No hay texto para leer." }, 400);

  let res = await tts(apiKey, voiceId, text);
  // Voz configurada no disponible en el plan (p. ej. voz de la biblioteca en el plan gratuito): voz base.
  if (!res.ok && voiceId !== DEFAULT_VOICES[kind] && [400, 402, 403, 404].includes(res.status)) {
    console.warn("elevenlabs voice fallback", res.status);
    res = await tts(apiKey, DEFAULT_VOICES[kind], text);
  }
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    console.error("elevenlabs tts", res.status, detail);
    const code = res.status === 401 ? "voice_auth" : /quota|credits|limit/i.test(detail) ? "voice_quota" : "voice_unavailable";
    return json({ error: code === "voice_quota" ? "Se agotaron los créditos de voz de ElevenLabs." : "La voz del coach no está disponible ahora.", code }, 502);
  }
  const audio = new Uint8Array(await res.arrayBuffer());
  const { error: upError } = await store.upload(path, audio, { contentType: "audio/mpeg", upsert: true });
  if (upError) {
    console.error("voice upload", upError.message);
    return new Response(audio, { headers: { ...CORS, "Content-Type": "audio/mpeg" } });
  }
  return json({ url: await signed(), cached: false });
});
