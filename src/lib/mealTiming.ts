// Horario de comidas: a qué hora abrir y cerrar la ventana de comidas según el objetivo,
// el sueño y el entreno del día. También sugiere la hora de cada suplemento.
import type { GoalKey } from "@/types/domain";
import { fromMinutes, toMinutes } from "./schedule";

export interface DayRhythm {
  wake: string;
  sleep: string;
  /** Inicio del entreno de hoy, o null si es día de descanso. */
  trainingStart: string | null;
  trainingMinutes: number;
}

export interface EatingWindow {
  start: string;
  end: string;
  hours: number;
  meals: { label: string; time: string }[];
  notes: string[];
}

const FAT_LOSS: GoalKey[] = ["lose_fat", "recomposition"];
const GAIN: GoalKey[] = ["build_muscle", "glutes_legs", "upper_body", "strength"];

/** Minutos del día para despertar, dormir y entreno; dormir después de medianoche se trata como del mismo "día". */
function minutes(r: DayRhythm) {
  const wake = toMinutes(r.wake);
  let sleep = toMinutes(r.sleep);
  if (sleep <= wake) sleep += 1440;
  let train: number | null = r.trainingStart ? toMinutes(r.trainingStart) : null;
  if (train !== null && train < wake) train += 1440;
  return { wake, sleep, train, trainEnd: train !== null ? train + r.trainingMinutes : null };
}

export function goalWindowHours(goal: GoalKey): number {
  if (FAT_LOSS.includes(goal)) return 10;
  if (GAIN.includes(goal)) return 13;
  return 12;
}

export function eatingWindow(goal: GoalKey, r: DayRhythm, mealsPerDay = 4): EatingWindow {
  const { wake, sleep, train, trainEnd } = minutes(r);
  const notes: string[] = [];
  const fatLoss = FAT_LOSS.includes(goal);
  const hours = goalWindowHours(goal);

  let start = wake + (fatLoss ? 60 : 30);
  // Termina con margen antes de dormir: 3 h para perder grasa, 2 h en los demás objetivos.
  const latest = sleep - (fatLoss ? 180 : 120);
  let end = Math.min(start + hours * 60, latest);

  if (train !== null && trainEnd !== null) {
    if (train < start) {
      start = trainEnd + 15;
      end = Math.min(start + hours * 60, latest);
      notes.push("Entrenas antes de abrir la ventana: haz tu primera comida justo después de entrenar.");
    } else if (trainEnd + 60 > end) {
      end = Math.min(Math.max(end, trainEnd + 60), sleep - 90);
      notes.push("Movimos el cierre para que alcances a comer después de entrenar.");
    }
  }
  if (end - start < 8 * 60) {
    // Nunca proponemos ventanas muy cortas.
    end = Math.min(start + 8 * 60, sleep - 60);
  }

  // Horas redondas a cuartos de hora: más fáciles de recordar.
  start = Math.round(start / 15) * 15;
  end = Math.round(end / 15) * 15;

  const n = Math.max(2, Math.min(6, mealsPerDay));
  const labels = n === 2 ? ["Primera comida", "Última comida"]
    : n === 3 ? ["Desayuno", "Almuerzo", "Cena"]
      : n === 4 ? ["Desayuno", "Almuerzo", "Merienda", "Cena"]
        : n === 5 ? ["Desayuno", "Media mañana", "Almuerzo", "Merienda", "Cena"]
          : ["Desayuno", "Media mañana", "Almuerzo", "Merienda", "Cena", "Snack"];
  const step = (end - start) / (n - 1);
  const meals = labels.map((label, i) => ({ label, time: fromMinutes(start + Math.round((step * i) / 15) * 15) }));

  if (fatLoss) notes.push("Un horario estable ayuda a controlar el hambre. El déficit lo marca el total del día, no solo la ventana.");
  else if (GAIN.includes(goal)) notes.push("Para ganar músculo conviene repartir la proteína en varias comidas a lo largo del día.");

  return { start: fromMinutes(start), end: fromMinutes(end), hours: Math.round(((end - start) / 60) * 10) / 10, meals, notes };
}

/** Estado de la ventana en este momento. */
export function windowStatus(w: Pick<EatingWindow, "start" | "end">, now: string): { state: "before" | "open" | "closed"; minutesLeft: number; progress: number } {
  const s = toMinutes(w.start);
  let e = toMinutes(w.end);
  if (e <= s) e += 1440;
  let n = toMinutes(now);
  if (n < s && n + 1440 <= e) n += 1440;
  if (n < s) return { state: "before", minutesLeft: s - n, progress: 0 };
  if (n >= e) return { state: "closed", minutesLeft: 0, progress: 100 };
  return { state: "open", minutesLeft: e - n, progress: Math.round(((n - s) / (e - s)) * 100) };
}

// ---------- Suplementos ----------

export interface Supplement {
  key: string;
  name: string;
  dose: string;
  why: string;
  caution?: string;
  /** Para quién se destaca primero en el catálogo. */
  focus?: "sis" | "bro";
}

export const SUPPLEMENTS: Supplement[] = [
  { key: "creatine", name: "Creatina monohidratada", dose: "3 a 5 g al día", why: "Mejora fuerza y rendimiento. Lo importante es tomarla todos los días; con comida se absorbe mejor." },
  { key: "whey", name: "Proteína en polvo", dose: "20 a 30 g por toma", why: "Ayuda a completar la proteína del día y a recuperar después de entrenar." },
  { key: "caffeine", name: "Cafeína o pre-entreno", dose: "Según la etiqueta, sin pasar de 400 mg de cafeína al día", why: "Más energía y foco al entrenar.", caution: "Evítala si tienes problemas cardíacos, hipertensión, ansiedad o estás en embarazo." },
  { key: "electrolytes", name: "Electrolitos", dose: "Según la etiqueta", why: "Reponen sodio y potasio en entrenos largos o con mucho calor." },
  { key: "omega3", name: "Omega 3", dose: "1 a 2 g de EPA + DHA", why: "Apoya la salud cardiovascular. Se absorbe mejor con una comida que tenga grasa." },
  { key: "vitamin_d", name: "Vitamina D", dose: "Según indicación profesional", why: "Huesos, músculo y sistema inmune. Mejor con la comida principal." },
  { key: "multivitamin", name: "Multivitamínico", dose: "1 al día", why: "Cubre posibles vacíos de la dieta. Tómalo con el desayuno para evitar malestar." },
  { key: "magnesium", name: "Magnesio", dose: "200 a 400 mg", why: "Puede ayudar a relajarte y descansar mejor por la noche." },
  { key: "iron", name: "Hierro", dose: "Solo con indicación médica", why: "Útil si tienes deficiencia, por ejemplo con periodos abundantes.", caution: "Tómalo lejos del café, el té y los lácteos (2 horas), idealmente con vitamina C. No lo tomes sin un examen que lo indique.", focus: "sis" },
  { key: "collagen", name: "Colágeno con vitamina C", dose: "10 a 15 g", why: "Puede apoyar tendones y articulaciones si lo tomas antes de entrenar. La evidencia es limitada.", focus: "sis" },
  { key: "casein", name: "Caseína", dose: "25 a 40 g", why: "Proteína de digestión lenta para la noche.", focus: "bro" },
];

export const SUPPLEMENT_BY_KEY: Record<string, Supplement> = Object.fromEntries(SUPPLEMENTS.map((s) => [s.key, s]));

export interface SupplementSlot {
  time: string | null;
  label: string;
  warning?: string;
}

/** Hora sugerida para un suplemento según el ritmo del día y la ventana de comidas. */
export function supplementTime(key: string, r: DayRhythm, w: Pick<EatingWindow, "start" | "end">): SupplementSlot {
  const { wake, sleep, train, trainEnd } = minutes(r);
  const start = toMinutes(w.start) < wake ? toMinutes(w.start) + 1440 : toMinutes(w.start);
  const mainMeal = start + 300;
  const training = train !== null && trainEnd !== null;
  const t = (m: number) => fromMinutes(m);

  switch (key) {
    case "creatine":
      return training ? { time: t(trainEnd! + 30), label: "Después de entrenar, con tu comida" } : { time: t(start), label: "Con tu primera comida (descanso)" };
    case "whey":
    case "collagen":
      if (key === "collagen" && training) return { time: t(train! - 45), label: "45 min antes de entrenar, con vitamina C" };
      return training ? { time: t(trainEnd! + 15), label: "Al terminar de entrenar" } : { time: t(start + 240), label: "Entre comidas para completar proteína" };
    case "caffeine": {
      if (!training) return { time: null, label: "Solo los días de entreno" };
      const at = train! - 45;
      const cutoff = sleep - 6 * 60;
      return at > cutoff
        ? { time: t(at), label: "45 min antes de entrenar", warning: `Entrenas tarde: la cafeína después de las ${t(cutoff)} puede quitarte el sueño. Mejor sin cafeína hoy.` }
        : { time: t(at), label: "30 a 45 min antes de entrenar" };
    }
    case "electrolytes":
      return training ? { time: t(train!), label: "Durante el entreno" } : { time: null, label: "Solo si entrenas largo o con calor" };
    case "omega3":
    case "vitamin_d":
      return { time: t(mainMeal), label: "Con tu comida principal" };
    case "multivitamin":
      return { time: t(start), label: "Con el desayuno" };
    case "magnesium":
      return { time: t(sleep - 60), label: "1 hora antes de dormir" };
    case "iron":
      return { time: t(wake + 30), label: "En ayunas, 2 h lejos de café, té y lácteos" };
    case "casein":
      return { time: w.end, label: "Con tu última comida, antes de cerrar la ventana" };
    default:
      return { time: null, label: "Cuando te lo indique tu profesional" };
  }
}
