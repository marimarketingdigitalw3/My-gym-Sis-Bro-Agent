// Detección de señales de alarma. Compartido entre la app y la Edge Function del coach.
// No diagnostica: solo decide cuándo detener recomendaciones de entrenamiento y derivar a evaluación médica.

export type RedFlagKey = "chest_pain" | "fainting" | "severe_breathlessness" | "irregular_heartbeat" | "sudden_severe_pain";

export const RED_FLAGS: { key: RedFlagKey; label: string }[] = [
  { key: "chest_pain", label: "Dolor u opresión en el pecho al hacer ejercicio" },
  { key: "fainting", label: "Desmayo o casi desmayo" },
  { key: "severe_breathlessness", label: "Falta de aire intensa e inexplicable" },
  { key: "irregular_heartbeat", label: "Palpitaciones o latidos irregulares fuera de lo normal" },
  { key: "sudden_severe_pain", label: "Dolor intenso y repentino (por ejemplo, un chasquido con dolor)" },
];

const PATTERNS: { key: RedFlagKey; re: RegExp }[] = [
  { key: "chest_pain", re: /(dolor|opresi[oó]n|presi[oó]n|apret\w*)\s+(en\s+(el|mi)\s+)?pecho|chest\s+(pain|tightness|pressure)|pecho\s+me\s+duele/i },
  { key: "fainting", re: /desmay|me\s+desvanec|perd[ií]\s+el\s+conocimiento|faint|passed\s+out|blacked\s+out/i },
  {
    key: "severe_breathlessness",
    re: /no\s+puedo\s+respirar|me\s+ahogo|falta\s+de\s+aire\s+(intensa|severa|fuerte)|can'?t\s+breathe|severe(ly)?\s+short(ness)?\s+of\s+breath/i,
  },
  { key: "irregular_heartbeat", re: /palpitaciones|coraz[oó]n\s+(acelerado|irregular)|irregular\s+heartbeat|heart\s+(racing|palpitations)/i },
  { key: "sudden_severe_pain", re: /(dolor\s+(muy\s+)?(intenso|agudo|insoportable))|(sent[ií]\s+un\s+(chasquido|tir[oó]n))|sharp\s+pain|severe\s+pain|heard\s+a\s+pop/i },
];

export function detectRedFlags(text: string): RedFlagKey[] {
  return PATTERNS.filter((p) => p.re.test(text)).map((p) => p.key);
}

const CARDIO_FLAGS: RedFlagKey[] = ["chest_pain", "fainting", "severe_breathlessness", "irregular_heartbeat"];

export function isUrgent(flags: readonly string[]): boolean {
  return flags.some((f) => CARDIO_FLAGS.includes(f as RedFlagKey));
}

export function safetyMessage(flags: readonly string[], lang: "es" | "en" = "es"): string {
  if (lang === "en") {
    return isUrgent(flags)
      ? "What you describe can be a sign of something serious. Stop exercising now and seek medical evaluation. If symptoms are severe or don't go away, call your local emergency number. I'll pause workout recommendations until a health professional clears you."
      : "Sharp or sudden pain is a reason to stop that exercise. Don't train through it. If it persists, swells or limits movement, get it checked by a health professional before loading that area again.";
  }
  return isUrgent(flags)
    ? "Lo que describes puede ser una señal de algo serio. Detén el ejercicio ahora y busca evaluación médica. Si los síntomas son intensos o no ceden, llama a la línea de emergencias de tu país. Pausaré las recomendaciones de entrenamiento hasta que un profesional de la salud te autorice."
    : "Un dolor agudo o repentino es motivo para detener ese ejercicio. No entrenes a través del dolor. Si persiste, se inflama o limita el movimiento, que te evalúe un profesional de la salud antes de volver a cargar esa zona.";
}
