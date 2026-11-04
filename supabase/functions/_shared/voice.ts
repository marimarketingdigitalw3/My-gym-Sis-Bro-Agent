// Utilidades puras de la voz del coach (ElevenLabs): texto hablable, elección de voz y validación.
export type VoiceKind = "female" | "male";

/** Voces base de ElevenLabs, disponibles en todos los planes (también desde la API en el plan gratuito). */
export const DEFAULT_VOICES: Record<VoiceKind, string> = {
  female: "EXAVITQu4vr4xnSDxMaL", // Sarah
  male: "JBFqnCBsd6RMkjVDRZzb", // George
};
export const DEFAULT_TTS_MODEL = "eleven_multilingual_v2";
export const DEFAULT_STT_MODEL = "scribe_v1";
export const MAX_SPEECH_CHARS = 2500;
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

const VOICE_ID_RE = /^[A-Za-z0-9]{10,40}$/;

/** Voz configurada para el tipo pedido; si la variable no es válida, la voz base. */
export function voiceIdFor(kind: VoiceKind, env: (name: string) => string | undefined): string {
  const configured = env(kind === "female" ? "ELEVENLABS_VOICE_FEMALE" : "ELEVENLABS_VOICE_MALE")?.trim();
  return configured && VOICE_ID_RE.test(configured) ? configured : DEFAULT_VOICES[kind];
}

export const isVoiceKind = (v: unknown): v is VoiceKind => v === "female" || v === "male";

/** Quita el formato Markdown y los símbolos que no se deben leer en voz alta, y recorta la longitud. */
export function speechText(markdown: string, max = MAX_SPEECH_CHARS): string {
  let t = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/^\s*(\d+)[.)]\s+/gm, "$1. ")
    .replace(/(\*\*|__|\*|_|~~)/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
  if (t.length > max) {
    const cut = t.slice(0, max);
    const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("\n"));
    t = (end > max * 0.6 ? cut.slice(0, end + 1) : cut).trim();
  }
  return t;
}

const AUDIO_TYPES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-m4a", "audio/aac"];
export function isAllowedAudio(type: string, size: number): boolean {
  const base = type.split(";")[0].trim().toLowerCase();
  return size > 0 && size <= MAX_AUDIO_BYTES && AUDIO_TYPES.includes(base);
}
