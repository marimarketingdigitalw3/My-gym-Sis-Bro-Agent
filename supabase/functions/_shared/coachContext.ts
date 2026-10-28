// Construye el contexto mínimo del coach a partir de filas de la base de datos.
// Formas mínimas declaradas aquí para no depender de los tipos de la app (Deno no resuelve alias "@/").
import type { CoachContext, CoachLanguage } from "./coach.ts";

interface ProfileLike { display_name: string; language: string }
interface SettingsLike { ai_share_context: boolean; cycle_tracking_enabled: boolean }
interface OnboardingLike {
  fitness?: { level?: string };
  environment?: { environment?: string; equipment?: string[] };
  health?: { limitations?: string[] };
}
interface GoalLike { goal: string; priority: number; status: string }
interface PlanLike { id: string; days_per_week: number; schedule: { dayIndex: number; weekday: number; title: string }[] }
interface PlanExerciseLike { day_index: number; position: number; exercise_id: string }
interface SessionLike { started_at: string; title: string; status: string }
interface SetLike { exercise_id: string; weight_kg: number | null; reps: number | null; completed: boolean }
interface NutritionLike { diet: string; allergens: string[] }
interface CycleLogLike { symptoms: string[]; energy: number | null }

export interface CoachContextInput {
  profile: ProfileLike;
  settings: SettingsLike;
  onboarding: OnboardingLike | null;
  goals: GoalLike[];
  plan: PlanLike | null;
  planExercises: PlanExerciseLike[];
  recentSessions: SessionLike[];
  recentSets: SetLike[];
  nutrition: NutritionLike | null;
  proteinTargetG: number | null;
  cycleToday: CycleLogLike | null;
  todayWeekday: number; // 0 = lunes
  weekStartISO: string;
  exerciseName: (id: string) => string;
}

export function buildCoachContext(input: CoachContextInput): CoachContext {
  const language: CoachLanguage = input.profile.language === "en" ? "en" : "es";
  const firstName = (input.profile.display_name || "").split(" ")[0].slice(0, 30);

  // Sin permiso para compartir contexto, solo enviamos el idioma.
  if (!input.settings.ai_share_context) {
    return {
      firstName: "", language, level: null, goals: [], equipment: [], limitations: [], todayWorkout: null,
      recentSessions: [], personalRecords: [], missedSessionsThisWeek: null, nutrition: null, cycleToday: null,
    };
  }

  const day = input.plan?.schedule.find((d) => d.weekday === input.todayWeekday) ?? null;
  const todayWorkout = day
    ? {
      title: day.title,
      exercises: input.planExercises
        .filter((e) => e.day_index === day.dayIndex)
        .sort((a, b) => a.position - b.position)
        .map((e) => input.exerciseName(e.exercise_id)),
    }
    : null;

  const completed = input.recentSessions.filter((s) => s.status === "completed");
  const completedThisWeek = completed.filter((s) => s.started_at.slice(0, 10) >= input.weekStartISO).length;
  const plannedSoFar = input.plan ? input.plan.schedule.filter((d) => d.weekday < input.todayWeekday).length : 0;

  const best = new Map<string, { exercise: string; weightKg: number; reps: number }>();
  for (const s of input.recentSets) {
    if (!s.completed || !s.reps || !s.weight_kg) continue;
    const prev = best.get(s.exercise_id);
    if (!prev || s.weight_kg > prev.weightKg) best.set(s.exercise_id, { exercise: input.exerciseName(s.exercise_id), weightKg: Number(s.weight_kg), reps: s.reps });
  }

  return {
    firstName,
    language,
    level: input.onboarding?.fitness?.level ?? null,
    goals: input.goals.filter((g) => g.status === "active").sort((a, b) => a.priority - b.priority).map((g) => g.goal),
    equipment: input.onboarding?.environment?.equipment ?? [],
    limitations: input.onboarding?.health?.limitations ?? [],
    todayWorkout,
    recentSessions: completed.slice(0, 5).map((s) => ({ date: s.started_at.slice(0, 10), title: s.title })),
    personalRecords: [...best.values()].slice(0, 5),
    missedSessionsThisWeek: input.plan ? Math.max(0, plannedSoFar - completedThisWeek) : null,
    nutrition: input.nutrition ? { diet: input.nutrition.diet, allergens: input.nutrition.allergens, proteinTargetG: input.proteinTargetG } : null,
    cycleToday: input.settings.cycle_tracking_enabled && input.cycleToday
      ? { symptoms: input.cycleToday.symptoms, energy: input.cycleToday.energy }
      : null,
  };
}
