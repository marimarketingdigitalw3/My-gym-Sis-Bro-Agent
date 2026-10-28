// Estado de ánimo de Gym Bot según el progreso del día y de la semana.
import { addDays, startOfWeek } from "./dates";

export type GymBotMood = "feliz" | "motivado" | "cansado" | "triste" | "enojado" | "tranquilo";

export interface MoodInput {
  today: string;
  /** 0 = lunes … 6 = domingo. */
  todayIdx: number;
  plannedWeekdays: number[];
  completedDates: Set<string>;
  streak: number;
  recovery: { energy: number | null; sleep_hours: number | null; soreness: number | null } | null;
  /** Fecha de creación de la cuenta (YYYY-MM-DD), para no "extrañar" a quien acaba de empezar. */
  since: string;
  nextTitle?: string | null;
}

export interface MoodResult {
  mood: GymBotMood;
  message: string;
}

export const MOOD_LABELS: Record<GymBotMood, string> = {
  feliz: "Feliz",
  motivado: "Motivado",
  cansado: "Cansado",
  triste: "Triste",
  enojado: "Gruñón",
  tranquilo: "Tranquilo",
};

export function computeMood(i: MoodInput): MoodResult {
  const weekStart = startOfWeek(i.today);
  const doneToday = i.completedDates.has(i.today);
  const plannedToday = i.plannedWeekdays.includes(i.todayIdx);

  if (doneToday) {
    return { mood: "feliz", message: i.streak > 1 ? `¡Sesión lista! Ya son ${i.streak} días de racha.` : "¡Sesión lista! Hoy cumpliste." };
  }

  const r = i.recovery;
  if (r && ((r.energy !== null && r.energy <= 2) || (r.sleep_hours !== null && r.sleep_hours < 6) || (r.soreness !== null && r.soreness >= 4))) {
    return { mood: "cansado", message: "Hoy estamos cansados. Vamos suave o con movilidad: recuperar también cuenta." };
  }

  const missed = i.plannedWeekdays.filter((d) => d < i.todayIdx && !i.completedDates.has(addDays(weekStart, d))).length;
  if (missed >= 2) {
    return { mood: "enojado", message: `¡Ey! Van ${missed} sesiones pendientes esta semana. ¿Retomamos hoy con algo corto?` };
  }

  let daysSince = 0;
  for (let d = 1; d <= 4; d++) {
    const date = addDays(i.today, -d);
    if (date < i.since || i.completedDates.has(date)) break;
    daysSince = d;
  }
  if (daysSince >= 4) {
    return { mood: "triste", message: "Te extraño en el gym. Un entreno corto hoy y volvemos a sonreír." };
  }

  if (plannedToday) {
    const what = i.nextTitle ? `Hoy toca ${i.nextTitle}.` : "Hoy toca entrenar.";
    return { mood: "motivado", message: i.streak > 0 ? `${what} ¡A sumar a tu racha de ${i.streak}!` : `${what} ¡Vamos con todo!` };
  }

  return { mood: "tranquilo", message: "Día de descanso. Hidrátate, estira y recarga energía." };
}
