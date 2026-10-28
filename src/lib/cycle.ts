// Cycle Wellness: estimaciones opcionales. Los síntomas y las preferencias del día
// siempre pesan más que la fase calculada por calendario.
import { addDays, diffDays } from "./dates";
import type { CycleLogRow, CycleSettingsRow } from "@/types/db";

export type CyclePhase = "menstrual" | "follicular" | "ovulatory" | "luteal";
export type Confidence = "none" | "low" | "medium";

export const PHASE_INFO: Record<CyclePhase, { name: string; color: string; summary: string }> = {
  menstrual: { name: "Menstruación", color: "#d97786", summary: "Primeros días del ciclo." },
  follicular: { name: "Fase folicular (estimada)", color: "#8fbf9f", summary: "Después del sangrado y antes de la ovulación." },
  ovulatory: { name: "Alrededor de la ovulación (estimada)", color: "#e0b25c", summary: "Ventana aproximada de ovulación." },
  luteal: { name: "Fase lútea (estimada)", color: "#a08ac9", summary: "Desde la ovulación hasta el siguiente periodo." },
};

export const SYMPTOMS: { key: string; label: string; lowersEnergy: boolean }[] = [
  { key: "cramps", label: "Cólicos", lowersEnergy: true },
  { key: "fatigue", label: "Cansancio", lowersEnergy: true },
  { key: "headache", label: "Dolor de cabeza", lowersEnergy: true },
  { key: "bloating", label: "Hinchazón", lowersEnergy: false },
  { key: "back_pain", label: "Dolor lumbar", lowersEnergy: true },
  { key: "breast_tenderness", label: "Sensibilidad en senos", lowersEnergy: false },
  { key: "mood_changes", label: "Cambios de ánimo", lowersEnergy: false },
  { key: "cravings", label: "Antojos", lowersEnergy: false },
  { key: "poor_sleep", label: "Dormí mal", lowersEnergy: true },
  { key: "nausea", label: "Náuseas", lowersEnergy: true },
];
const SYMPTOM_LABEL = Object.fromEntries(SYMPTOMS.map((s) => [s.key, s.label]));

export interface CycleEstimate {
  hasData: boolean;
  cycleLength: number;
  periodLength: number;
  lengthSource: "logged" | "typical" | "default";
  variability: number; // días
  confidence: Confidence;
  currentDay: number | null;
  phase: CyclePhase | null;
  nextPeriodStart: string | null;
  nextPeriodWindow: [string, string] | null;
  notes: string[];
}

export function periodStarts(settings: CycleSettingsRow | null, logs: Pick<CycleLogRow, "logged_on" | "period_start">[]): string[] {
  const starts = new Set(logs.filter((l) => l.period_start).map((l) => l.logged_on));
  if (settings?.last_period_start) starts.add(settings.last_period_start);
  return [...starts].sort();
}

export function cycleLengths(starts: string[]): number[] {
  const lengths: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const len = diffDays(starts[i - 1], starts[i]);
    if (len >= 15 && len <= 60) lengths.push(len);
  }
  return lengths;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

export function phaseForDay(day: number, cycleLength: number, periodLength: number): CyclePhase {
  const ovulation = cycleLength - 14;
  if (day <= periodLength) return "menstrual";
  if (day >= ovulation - 1 && day <= ovulation + 1) return "ovulatory";
  if (day < ovulation - 1) return "follicular";
  return "luteal";
}

export function estimateCycle(
  settings: CycleSettingsRow | null,
  logs: Pick<CycleLogRow, "logged_on" | "period_start">[],
  today: string,
): CycleEstimate {
  const notes: string[] = [];
  const starts = periodStarts(settings, logs).filter((d) => d <= today);
  const lengths = cycleLengths(starts).slice(-6);
  const periodLength = settings?.typical_period_length ?? 5;

  let cycleLength = 28;
  let lengthSource: CycleEstimate["lengthSource"] = "default";
  if (lengths.length >= 2) {
    cycleLength = median(lengths);
    lengthSource = "logged";
  } else if (settings?.typical_cycle_length) {
    cycleLength = settings.typical_cycle_length;
    lengthSource = "typical";
  } else if (lengths.length === 1) {
    cycleLength = lengths[0];
    lengthSource = "logged";
  }

  const spread = lengths.length >= 2 ? Math.max(...lengths) - Math.min(...lengths) : null;
  const irregular = settings?.regularity === "irregular" || (spread !== null && spread > 7);
  let variability = spread !== null ? Math.max(2, Math.ceil(spread / 2)) : irregular ? 7 : 3;

  const last = starts[starts.length - 1];
  if (!last) {
    return {
      hasData: false, cycleLength, periodLength, lengthSource, variability, confidence: "none",
      currentDay: null, phase: null, nextPeriodStart: null, nextPeriodWindow: null,
      notes: ["Registra el primer día de tu próximo periodo para empezar a estimar tu ciclo."],
    };
  }

  const currentDay = diffDays(last, today) + 1;
  // Si ya pasó la fecha esperada, la próxima estimación parte de hoy.
  const overdue = currentDay > cycleLength + variability;
  const nextPeriodStart = overdue ? null : addDays(last, cycleLength);
  if (overdue) {
    notes.push("Tu periodo lleva más días de lo habitual según tus registros. Puede ser normal, pero si te preocupa, consulta a un profesional de la salud.");
    variability = Math.max(variability, 7);
  }

  let confidence: Confidence = lengthSource === "default" ? "low" : "medium";
  let phase: CyclePhase | null = overdue ? null : phaseForDay(currentDay, cycleLength, periodLength);

  if (settings?.hormonal_contraception) {
    phase = currentDay <= periodLength ? "menstrual" : null;
    confidence = "none";
    notes.push("Con anticoncepción hormonal las fases naturales no aplican de la misma forma, así que no estimamos fases. Seguimos tus síntomas y tu energía.");
  } else if (irregular) {
    confidence = "low";
    notes.push("Tus ciclos varían bastante, así que las fases y la próxima fecha son aproximadas.");
  }
  if (settings && !settings.wants_phase_estimates) {
    phase = currentDay <= periodLength ? "menstrual" : null;
    confidence = "none";
  }
  if (lengthSource === "default") notes.push("Usamos 28 días como referencia hasta tener más registros. Tu ciclo puede ser distinto.");

  return {
    hasData: true,
    cycleLength,
    periodLength,
    lengthSource,
    variability,
    confidence,
    currentDay,
    phase,
    nextPeriodStart,
    nextPeriodWindow: nextPeriodStart ? [addDays(nextPeriodStart, -variability), addDays(nextPeriodStart, variability)] : null,
    notes,
  };
}

export interface CycleSuggestion {
  headline: string;
  explanation: string;
  offerLighterSession: boolean;
  ideas: string[];
}

export function cycleTrainingSuggestion(
  estimate: Pick<CycleEstimate, "phase" | "confidence">,
  today: { symptoms: string[]; energy: number | null } | null,
  preference: CycleSettingsRow["period_training_preference"] = null,
): CycleSuggestion {
  const symptoms = today?.symptoms ?? [];
  const lowEnergy = (today?.energy ?? 3) <= 2;
  const heavySymptoms = symptoms.filter((s) => SYMPTOMS.find((x) => x.key === s)?.lowersEnergy);

  // 1. Lo que la persona reporta hoy manda sobre el calendario.
  if (heavySymptoms.length || lowEnergy) {
    const what = [
      ...heavySymptoms.map((s) => SYMPTOM_LABEL[s]?.toLowerCase()),
      ...(lowEnergy ? ["energía baja"] : []),
    ].filter(Boolean).join(", ");
    return {
      headline: "Hoy puedes elegir una opción más suave",
      explanation: `Reportaste ${what}, así que te sugerimos una alternativa de menor intensidad. También puedes seguir tu plan normal si te sientes cómoda o cómodo.`,
      offerLighterSession: true,
      ideas: ["Caminata de 20 a 30 minutos", "Movilidad y estiramientos", "Tu entrenamiento con 1 serie menos por ejercicio", "Descanso activo si lo necesitas"],
    };
  }

  if (estimate.confidence === "none" || !estimate.phase) {
    return {
      headline: "Entrena según cómo te sientas",
      explanation: "No usamos fases estimadas para ti. Te guiamos por tus síntomas, tu energía y tu recuperación.",
      offerLighterSession: false,
      ideas: [],
    };
  }

  switch (estimate.phase) {
    case "menstrual":
      return {
        headline: "Entrena con normalidad si te sientes bien",
        explanation: preference === "lighter"
          ? "Nos dijiste que prefieres sesiones más ligeras durante el periodo. Tienes una opción suave disponible, pero no es obligatoria."
          : "No hace falta bajar la intensidad durante el periodo. Si aparecen molestias, tienes una opción más suave.",
        offerLighterSession: preference === "lighter",
        ideas: ["Mantén tu plan habitual", "Hidrátate bien", "Si hay molestias: movilidad o caminata"],
      };
    case "follicular":
      return {
        headline: "Buen momento para progresar si te sientes con energía",
        explanation: "Es una sugerencia basada en una fase estimada. Si tu cuerpo responde bien, puedes intentar subir carga o repeticiones.",
        offerLighterSession: false,
        ideas: ["Intenta la progresión sugerida en tus ejercicios principales"],
      };
    case "ovulatory":
      return {
        headline: "Mantén tu entrenamiento normal",
        explanation: "Alrededor de la ovulación estimada no cambiamos nada de forma automática. Entrena como te sientas.",
        offerLighterSession: false,
        ideas: ["Calienta bien antes de cargas altas"],
      };
    case "luteal":
      return {
        headline: "Volumen flexible según tu recuperación",
        explanation: "Algunas personas notan más cansancio o hinchazón en esta fase. Si es tu caso, puedes reducir una serie. Si no, sigue tu plan.",
        offerLighterSession: false,
        ideas: ["Prioriza la hidratación y el sueño", "Ajusta el volumen si tu energía baja"],
      };
  }
}

export const CYCLE_DISCLAIMER =
  "Las fases son estimaciones por calendario, no mediciones fisiológicas. Ciclos irregulares y anticonceptivos hormonales las hacen menos fiables. Esta función no sirve para diagnosticar trastornos hormonales ni para conocer tu fertilidad.";
