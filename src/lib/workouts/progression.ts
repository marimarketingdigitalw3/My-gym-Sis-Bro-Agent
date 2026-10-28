// Sobrecarga progresiva con doble progresión: primero repeticiones, luego carga.
// Nunca sube la carga si hubo dolor, técnica dudosa o mala recuperación.
import type { ExerciseSetRow, WorkoutExerciseRow } from "@/types/db";

export type ProgressionAction = "start" | "increase_load" | "increase_reps" | "repeat" | "reduce" | "substitute";

export interface ProgressionAdvice {
  action: ProgressionAction;
  suggestedLoadKg: number | null;
  targetReps: number | null;
  message: string;
}

export interface RecoveryState {
  energy?: number | null; // 1..5
  soreness?: number | null; // 1..5
  poorTechnique?: boolean;
}

type SetLike = Pick<ExerciseSetRow, "reps" | "weight_kg" | "rpe" | "completed" | "pain">;

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

export function progressionAdvice(
  prescription: Pick<WorkoutExerciseRow, "rep_min" | "rep_max" | "load_kg">,
  lastSets: SetLike[],
  incrementKg: number,
  recovery: RecoveryState = {},
): ProgressionAdvice {
  const { rep_min: repMin, rep_max: repMax } = prescription;
  const working = lastSets.filter((s) => s.completed);
  const lastLoad = working.length ? Math.max(...working.map((s) => Number(s.weight_kg ?? 0))) : prescription.load_kg ?? null;

  if (lastSets.some((s) => s.pain)) {
    return {
      action: "substitute",
      suggestedLoadKg: lastLoad,
      targetReps: repMin,
      message: "La última vez sentiste dolor. No subimos la carga: prueba una alternativa o reduce el rango. Si el dolor sigue, consulta a un profesional.",
    };
  }
  if (!working.length || repMax === null || repMin === null) {
    return {
      action: "start",
      suggestedLoadKg: prescription.load_kg,
      targetReps: repMin,
      message: "Primera vez: elige un peso con el que termines cada serie sintiendo que podrías hacer 2 o 3 repeticiones más.",
    };
  }
  if (recovery.poorTechnique) {
    return { action: "repeat", suggestedLoadKg: lastLoad, targetReps: repMin, message: "Repite el mismo peso y prioriza la técnica antes de progresar." };
  }
  if ((recovery.energy ?? 3) <= 2 || (recovery.soreness ?? 1) >= 4) {
    return { action: "repeat", suggestedLoadKg: lastLoad, targetReps: repMin, message: "Tu recuperación de hoy es baja: mantén el peso de la última vez. Progresar otro día también es progresar." };
  }

  const reps = working.map((s) => s.reps ?? 0);
  const rpes = working.map((s) => s.rpe).filter((r): r is number => r !== null && r !== undefined);
  const avgRpe = rpes.length ? rpes.reduce((a, b) => a + Number(b), 0) / rpes.length : null;
  const failedSets = reps.filter((r) => r < repMin).length;

  if (failedSets >= 2 || (avgRpe !== null && avgRpe >= 9.5)) {
    const reduced = lastLoad ? roundTo(lastLoad * 0.9, incrementKg || 1) : null;
    return {
      action: "reduce",
      suggestedLoadKg: reduced,
      targetReps: repMin,
      message: "La última sesión fue muy exigente. Baja un poco el peso (~10 %) y vuelve a construir desde ahí.",
    };
  }

  const allTop = reps.every((r) => r >= repMax);
  if (allTop && (avgRpe === null || avgRpe <= 8.5)) {
    if (incrementKg > 0 && lastLoad !== null && lastLoad > 0) {
      return {
        action: "increase_load",
        suggestedLoadKg: roundTo(lastLoad + incrementKg, 0.5),
        targetReps: repMin,
        message: `Completaste todas las repeticiones: sube a ${roundTo(lastLoad + incrementKg, 0.5)} kg y vuelve al rango bajo (${repMin}).`,
      };
    }
    return {
      action: "increase_reps",
      suggestedLoadKg: lastLoad,
      targetReps: repMax,
      message: "Dominas este rango. Añade una serie, haz la bajada más lenta o pasa a una variante más difícil.",
    };
  }

  const best = Math.max(...reps);
  return {
    action: "increase_reps",
    suggestedLoadKg: lastLoad,
    targetReps: Math.min(repMax, best + 1),
    message: `Mantén ${lastLoad ?? "el mismo"} kg e intenta ${Math.min(repMax, best + 1)} repeticiones en cada serie.`,
  };
}

/** 1RM estimado con la fórmula de Epley. Solo orientativo. */
export function estimatedOneRepMax(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

export interface PersonalRecord {
  exerciseId: string;
  bestWeightKg: number;
  bestReps: number;
  bestE1rm: number;
  date: string;
}

export function personalRecords(sets: Pick<ExerciseSetRow, "exercise_id" | "weight_kg" | "reps" | "completed" | "created_at">[]): PersonalRecord[] {
  const byExercise = new Map<string, PersonalRecord>();
  for (const s of sets) {
    if (!s.completed || !s.reps) continue;
    const w = Number(s.weight_kg ?? 0);
    const e1rm = w > 0 ? estimatedOneRepMax(w, s.reps) : 0;
    const prev = byExercise.get(s.exercise_id);
    const better = !prev || e1rm > prev.bestE1rm || (e1rm === prev.bestE1rm && s.reps > prev.bestReps);
    if (better) {
      byExercise.set(s.exercise_id, { exerciseId: s.exercise_id, bestWeightKg: w, bestReps: s.reps, bestE1rm: e1rm, date: s.created_at.slice(0, 10) });
    }
  }
  return [...byExercise.values()].sort((a, b) => b.date.localeCompare(a.date));
}
