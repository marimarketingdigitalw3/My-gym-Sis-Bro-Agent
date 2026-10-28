// Constancia: reto de 66 días y racha con comodines (heredado del prototipo Sis Bro).
// Un día vacío gasta un comodín en vez de romper la racha; sin comodines la racha vuelve a 0,
// pero el reto nunca se reinicia.
import { addDays, diffDays } from "./dates";

export const CHALLENGE_DAYS = 66;
export const MAX_FREEZES = 2;
export const FREEZE_EVERY = 7;

export interface StreakResult {
  streak: number;
  best: number;
  freezes: number;
  usedFreezes: number;
  activeDays: number;
  challengeDay: number;
}

/** activeDates: días con al menos un entrenamiento completado o un registro de bienestar. */
export function computeStreak(activeDates: Iterable<string>, startISO: string, todayISO: string): StreakResult {
  const active = new Set(activeDates);
  let streak = 0;
  let best = 0;
  let freezes = 0;
  let usedFreezes = 0;
  let activeDays = 0;
  const days = Math.max(0, diffDays(startISO, todayISO));
  for (let i = 0; i <= days; i++) {
    const date = addDays(startISO, i);
    if (i > 0 && i % FREEZE_EVERY === 0) freezes = Math.min(MAX_FREEZES, freezes + 1);
    if (active.has(date)) {
      streak++;
      activeDays++;
    } else if (date === todayISO) {
      continue; // el día de hoy aún no termina
    } else if (freezes > 0) {
      freezes--;
      usedFreezes++;
    } else {
      streak = 0;
    }
    best = Math.max(best, streak);
  }
  return { streak, best, freezes, usedFreezes, activeDays, challengeDay: Math.min(days + 1, CHALLENGE_DAYS) };
}

/** Porcentaje de sesiones planificadas completadas en una semana. */
export function weeklyCompletion(completedThisWeek: number, plannedPerWeek: number): number {
  if (plannedPerWeek <= 0) return 0;
  return Math.min(100, Math.round((completedThisWeek / plannedPerWeek) * 100));
}
