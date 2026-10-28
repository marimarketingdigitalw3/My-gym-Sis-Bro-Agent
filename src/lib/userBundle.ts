// Agrupa los datos de perfil que necesitan los motores (entrenamiento, nutrición, ciclo, coach).
import type {
  CycleSettingsRow, FitnessGoalRow, NutritionPrefsRow, OnboardingRow, ProfileRow, UserSettingsRow,
} from "@/types/db";
import type { GoalKey } from "@/types/domain";

export interface UserBundle {
  profile: ProfileRow;
  settings: UserSettingsRow;
  onboarding: OnboardingRow | null;
  goals: FitnessGoalRow[];
  nutrition: NutritionPrefsRow | null;
  cycle: CycleSettingsRow | null;
}

export function activeGoals(bundle: Pick<UserBundle, "goals">): GoalKey[] {
  return bundle.goals
    .filter((g) => g.status === "active")
    .sort((a, b) => a.priority - b.priority)
    .map((g) => g.goal);
}

export function primaryGoal(bundle: Pick<UserBundle, "goals">): GoalKey {
  return activeGoals(bundle)[0] ?? "general_health";
}

export const GOAL_LABELS: Record<GoalKey, string> = {
  lose_fat: "Perder grasa corporal",
  build_muscle: "Ganar músculo",
  strength: "Aumentar fuerza",
  endurance: "Mejorar resistencia",
  cardio_health: "Salud cardiovascular",
  mobility: "Movilidad y flexibilidad",
  recomposition: "Tonificar y recomposición corporal",
  glutes_legs: "Glúteos y piernas",
  upper_body: "Tren superior",
  general_health: "Salud general",
  maintain: "Mantener mi forma física",
};
