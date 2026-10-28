import { db } from "./data";
import { generatePlan, type GeneratedPlan } from "@/lib/workouts/generator";
import type { ExerciseSetRow, WorkoutExerciseRow, WorkoutPlanRow, WorkoutSessionRow } from "@/types/db";

export interface ActivePlan {
  plan: WorkoutPlanRow;
  exercises: WorkoutExerciseRow[];
}

export async function getActivePlan(): Promise<ActivePlan | null> {
  const [plan] = await db.select("workout_plans", { eq: { is_active: true } });
  if (!plan) return null;
  const exercises = await db.select("workout_exercises", { eq: { plan_id: plan.id }, order: { column: "position" } });
  return { plan, exercises: exercises.sort((a, b) => a.day_index - b.day_index || a.position - b.position) };
}

/** Guarda un plan generado como plan activo (el anterior queda en el historial). */
export async function saveGeneratedPlan(generated: GeneratedPlan): Promise<ActivePlan> {
  const current = await db.select("workout_plans", { eq: { is_active: true } });
  for (const p of current) await db.update("workout_plans", { id: p.id }, { is_active: false });
  const [plan] = await db.insert("workout_plans", [{
    name: generated.name,
    is_active: true,
    split: generated.split,
    days_per_week: generated.daysPerWeek,
    session_minutes: generated.sessionMinutes,
    schedule: generated.days.map((d) => d.meta),
    rationale: generated.rationale,
  }]);
  const rows = generated.days.flatMap((d) => d.exercises.map((e) => ({ ...e, plan_id: plan.id })));
  const exercises = rows.length ? await db.insert("workout_exercises", rows) : [];
  return { plan, exercises };
}

export async function regeneratePlan(input: Parameters<typeof generatePlan>[0]): Promise<ActivePlan> {
  return saveGeneratedPlan(generatePlan(input));
}

export async function updatePlanSchedule(planId: string, schedule: WorkoutPlanRow["schedule"]) {
  const [row] = await db.update("workout_plans", { id: planId }, { schedule });
  return row;
}

export async function updatePlanExercise(id: string, patch: Partial<WorkoutExerciseRow>) {
  const [row] = await db.update("workout_exercises", { id }, patch);
  return row;
}

export async function removePlanExercise(id: string) {
  await db.remove("workout_exercises", { id });
}

export async function addPlanExercise(row: Omit<WorkoutExerciseRow, "id" | "user_id">) {
  const [created] = await db.insert("workout_exercises", [row]);
  return created;
}

// ---------- Sesiones ----------
export async function startSession(planId: string | null, dayIndex: number | null, title: string): Promise<WorkoutSessionRow> {
  // Reanuda una sesión en curso del mismo día si existe.
  const open = await db.select("workout_sessions", { eq: { status: "in_progress" } });
  const same = open.find((s) => s.plan_id === planId && s.day_index === dayIndex);
  if (same) return same;
  const [session] = await db.insert("workout_sessions", [{
    plan_id: planId, day_index: dayIndex, title, status: "in_progress", started_at: new Date().toISOString(), pain_reported: false,
  }]);
  return session;
}

export async function getSession(id: string) {
  const [session] = await db.select("workout_sessions", { eq: { id } });
  if (!session) return null;
  const sets = await db.select("exercise_sets", { eq: { session_id: id }, order: { column: "set_number" } });
  return { session, sets };
}

export async function saveSet(row: Omit<ExerciseSetRow, "id" | "user_id" | "created_at">): Promise<ExerciseSetRow> {
  const [saved] = await db.upsert("exercise_sets", [{ ...row, created_at: new Date().toISOString() }], ["session_id", "exercise_id", "set_number"]);
  return saved;
}

export async function deleteSet(sessionId: string, exerciseId: string, setNumber: number) {
  await db.remove("exercise_sets", { session_id: sessionId, exercise_id: exerciseId, set_number: setNumber });
}

export async function completeSession(id: string, data: { perceived_effort: number | null; pain_reported: boolean; notes: string | null; startedAt: string }) {
  const completedAt = new Date();
  const [s] = await db.update("workout_sessions", { id }, {
    status: "completed",
    completed_at: completedAt.toISOString(),
    duration_s: Math.max(0, Math.round((completedAt.getTime() - new Date(data.startedAt).getTime()) / 1000)),
    perceived_effort: data.perceived_effort,
    pain_reported: data.pain_reported,
    notes: data.notes,
  });
  return s;
}

export async function abandonSession(id: string) {
  await db.update("workout_sessions", { id }, { status: "abandoned" });
}

export async function deleteSession(id: string) {
  await db.remove("workout_sessions", { id });
}

export async function listSessions(limit = 100) {
  return db.select("workout_sessions", { order: { column: "started_at", ascending: false }, limit });
}

export async function allSets() {
  return db.select("exercise_sets", { order: { column: "created_at", ascending: true } });
}

/** Series completadas de la última sesión (distinta a la actual) en la que se hizo el ejercicio. */
export function lastPerformance(sets: ExerciseSetRow[], exerciseId: string, excludeSessionId?: string): ExerciseSetRow[] {
  const relevant = sets.filter((s) => s.exercise_id === exerciseId && s.session_id !== excludeSessionId && s.completed);
  if (!relevant.length) return [];
  const latest = relevant.reduce((a, b) => (a.created_at > b.created_at ? a : b));
  return relevant.filter((s) => s.session_id === latest.session_id).sort((a, b) => a.set_number - b.set_number);
}
