// Horarios del día: hora de cada entreno y utilidades para trabajar con "HH:MM".
import type { LifestyleAnswers, WorkoutDayMeta } from "@/types/db";

export const DEFAULT_TRAINING_TIME: Record<NonNullable<LifestyleAnswers["preferredTime"]>, string> = {
  morning: "06:30",
  midday: "12:30",
  evening: "18:30",
  flexible: "18:00",
};

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Minutos desde medianoche a "HH:MM" (admite valores fuera de 0..1439). */
export function fromMinutes(total: number): string {
  const t = ((Math.round(total) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export function addMinutes(time: string, minutes: number): string {
  return fromMinutes(toMinutes(time) + minutes);
}

/** "18:30" → "6:30 p. m." */
export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h < 12 ? "a. m." : "p. m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Hora de inicio de un día del plan: la elegida por la persona o la de su preferencia del cuestionario. */
export function dayStartTime(meta: Pick<WorkoutDayMeta, "time">, preferred?: LifestyleAnswers["preferredTime"]): string {
  return meta.time && TIME_RE.test(meta.time) ? meta.time : DEFAULT_TRAINING_TIME[preferred ?? "flexible"];
}

/** Hora actual como "HH:MM". */
export function nowTime(date = new Date()): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
