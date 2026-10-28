// Entradas de los motores derivadas del perfil.
import { ageFromBirthDate } from "@/lib/dates";
import { estimateNutrition, type NutritionEstimate } from "@/lib/nutrition";
import { activeGoals, primaryGoal, type UserBundle } from "@/lib/userBundle";
import { selectionContextFor, type GeneratorInput, type SelectionContext } from "@/lib/workouts/generator";
import type { MovementPattern } from "@/types/domain";

export const DISLIKE_PATTERNS: { key: MovementPattern | "jumping"; label: string }[] = [
  { key: "lunge", label: "Zancadas" },
  { key: "squat", label: "Sentadillas" },
  { key: "hinge", label: "Peso muerto y bisagras" },
  { key: "vertical_push", label: "Press sobre la cabeza" },
  { key: "vertical_pull", label: "Dominadas y jalones" },
  { key: "core_flexion", label: "Abdominales tipo crunch" },
  { key: "cardio", label: "Cardio continuo" },
];

export function generatorInputFromBundle(bundle: UserBundle, poorRecovery = false): GeneratorInput {
  const f = bundle.onboarding?.fitness ?? {};
  const e = bundle.onboarding?.environment ?? {};
  const h = bundle.onboarding?.health ?? {};
  const l = bundle.onboarding?.lifestyle ?? {};
  const disliked = (f.dislikedExercises ?? []).filter((x) => DISLIKE_PATTERNS.some((d) => d.key === x)) as MovementPattern[];
  const sleepPoor = (l.sleepHours ?? 7) < 6;
  const stressHigh = (l.stressLevel ?? 0) >= 4;
  return {
    level: f.level ?? "beginner",
    daysPerWeek: f.daysPerWeek ?? 3,
    sessionMinutes: f.sessionMinutes ?? 45,
    goals: activeGoals(bundle),
    environment: e.environment ?? "home_none",
    equipment: e.equipment ?? [],
    limitations: h.limitations ?? [],
    dislikedPatterns: disliked,
    preferredDays: l.preferredDays,
    poorRecovery: poorRecovery || sleepPoor || stressHigh,
    pregnancyStatus: h.pregnancyStatus,
    painDuringExercise: h.painDuringExercise,
  };
}

export function selectionContextFromBundle(bundle: UserBundle): SelectionContext {
  return selectionContextFor(generatorInputFromBundle(bundle));
}

export function nutritionFromBundle(bundle: UserBundle): NutritionEstimate {
  const p = bundle.profile;
  return estimateNutrition({
    age: ageFromBirthDate(p.birth_date),
    sex: p.sex,
    heightCm: p.height_cm !== null ? Number(p.height_cm) : null,
    weightKg: p.weight_kg !== null ? Number(p.weight_kg) : null,
    goal: primaryGoal(bundle),
    lifestyle: bundle.onboarding?.lifestyle,
    trainingDaysPerWeek: bundle.onboarding?.fitness?.daysPerWeek,
    edHistory: bundle.onboarding?.health?.edHistory ?? null,
    pregnancyStatus: bundle.onboarding?.health?.pregnancyStatus,
  });
}

/** ¿Se muestran cifras de calorías? Respeta la preferencia de la persona y el modo seguro. */
export function showCalories(bundle: UserBundle, estimate: NutritionEstimate): boolean {
  return bundle.settings.calorie_tracking_enabled && estimate.mode !== "no_numbers";
}
