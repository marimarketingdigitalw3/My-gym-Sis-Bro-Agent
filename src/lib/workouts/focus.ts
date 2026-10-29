// Grupos musculares para crear rutinas propias ("Glúteos", "Pierna", "Femoral"...) y filtrar ejercicios.
import { EXERCISES } from "@/data/exercises";
import type { Exercise, MuscleGroup } from "@/types/domain";
import { isAllowed, type SelectionContext } from "./generator";
import type { WorkoutDayMeta } from "@/types/db";

export interface FocusGroup {
  key: string;
  label: string;
  muscles: MuscleGroup[];
}

export const FOCUS_GROUPS: FocusGroup[] = [
  { key: "glutes", label: "Glúteos", muscles: ["glutes"] },
  { key: "legs", label: "Pierna", muscles: ["quads", "glutes", "hamstrings", "calves", "adductors"] },
  { key: "hamstrings", label: "Femoral", muscles: ["hamstrings"] },
  { key: "quads", label: "Cuádriceps", muscles: ["quads"] },
  { key: "calves", label: "Pantorrillas", muscles: ["calves"] },
  { key: "chest", label: "Pecho", muscles: ["chest"] },
  { key: "back", label: "Espalda", muscles: ["back"] },
  { key: "shoulders", label: "Hombros", muscles: ["shoulders"] },
  { key: "arms", label: "Brazos", muscles: ["biceps", "triceps", "forearms"] },
  { key: "core", label: "Abdomen", muscles: ["core"] },
  { key: "cardio", label: "Cardio", muscles: ["cardio", "full_body"] },
];

export const FOCUS_BY_KEY: Record<string, FocusGroup> = Object.fromEntries(FOCUS_GROUPS.map((g) => [g.key, g]));

export function musclesFor(keys: string[]): Set<MuscleGroup> {
  return new Set(keys.flatMap((k) => FOCUS_BY_KEY[k]?.muscles ?? []));
}

export function matchesFocus(ex: Exercise, keys: string[]): boolean {
  if (!keys.length) return true;
  const m = musclesFor(keys);
  return ex.primaryMuscles.some((x) => m.has(x));
}

/** Ejercicios sugeridos para una rutina propia: compatibles con el equipo y las limitaciones, básicos primero y sin repetir patrón. */
export function suggestExercises(keys: string[], ctx: SelectionContext, count = 5): Exercise[] {
  const pool = EXERCISES.filter((e) => e.category !== "mobility" && isAllowed(e, ctx) && matchesFocus(e, keys))
    .sort((a, b) => Number(b.isCompound) - Number(a.isCompound) || a.difficulty - b.difficulty);
  const out: Exercise[] = [];
  const patterns = new Set<string>();
  for (const e of pool) if (!patterns.has(e.pattern) && out.length < count) { out.push(e); patterns.add(e.pattern); }
  for (const e of pool) if (!out.includes(e) && out.length < count) out.push(e);
  return out;
}

/** Nuevo día del plan con el primer índice libre (0 a 6). */
export function newDayMeta(schedule: WorkoutDayMeta[], weekday: number, title: string, keys: string[], minutes: number, warmup: string[], cooldown: string[]): WorkoutDayMeta {
  const used = new Set(schedule.map((d) => d.dayIndex));
  const dayIndex = [0, 1, 2, 3, 4, 5, 6].find((i) => !used.has(i)) ?? 0;
  return {
    dayIndex, weekday, title: title.trim() || "Rutina personalizada",
    focus: keys.map((k) => FOCUS_BY_KEY[k]?.label).filter(Boolean).join(", ") || "Personalizada",
    warmup, cooldown, estimatedMinutes: minutes,
  };
}

/** Mueve la rutina de `dayIndex` al día `weekday`; si allí había otra, intercambian días. */
export function moveDay(schedule: WorkoutDayMeta[], dayIndex: number, weekday: number): WorkoutDayMeta[] {
  const moving = schedule.find((d) => d.dayIndex === dayIndex);
  if (!moving) return schedule;
  return schedule
    .map((d) => (d.dayIndex === dayIndex ? { ...d, weekday } : d.weekday === weekday ? { ...d, weekday: moving.weekday } : d))
    .sort((a, b) => a.weekday - b.weekday);
}

/** Aplica un nuevo orden de la semana: posición i = día i (0 = lunes). `order` contiene dayIndex o null (descanso). */
export function applyWeekOrder(schedule: WorkoutDayMeta[], order: (number | null)[]): WorkoutDayMeta[] {
  return schedule
    .map((d) => ({ ...d, weekday: order.indexOf(d.dayIndex) }))
    .sort((a, b) => a.weekday - b.weekday);
}
