import { db, PERSONAL_TABLES } from "./data";
import type { UserBundle } from "@/lib/userBundle";
import type {
  CycleSettingsRow, FitnessGoalRow, NutritionPrefsRow, OnboardingRow, ProfileRow, UserSettingsRow,
} from "@/types/db";
import type { GoalKey } from "@/types/domain";

export async function loadUserBundle(): Promise<UserBundle> {
  const [profiles, settings, onboarding, goals, nutrition, cycle] = await Promise.all([
    db.select("profiles"),
    db.select("user_settings"),
    db.select("onboarding_responses"),
    db.select("fitness_goals", { order: { column: "priority" } }),
    db.select("nutrition_preferences"),
    db.select("cycle_settings"),
  ]);
  if (!profiles[0]) throw new Error("No encontramos tu perfil. Cierra sesión e inténtalo de nuevo.");
  const defaults: UserSettingsRow = {
    user_id: profiles[0].id, cycle_tracking_enabled: false, water_tracking_enabled: true, calorie_tracking_enabled: true,
    ai_share_context: true, health_consent_at: null, updated_at: "",
  };
  return {
    profile: profiles[0],
    settings: settings[0] ?? defaults,
    onboarding: onboarding[0] ?? null,
    goals,
    nutrition: nutrition[0] ?? null,
    cycle: cycle[0] ?? null,
  };
}

export async function updateProfile(patch: Partial<ProfileRow>) {
  const user = await db.auth.getUser();
  if (!user) throw new Error("Sesión no válida.");
  await db.update("profiles", { id: user.id }, patch);
}

export async function updateSettings(patch: Partial<UserSettingsRow>) {
  await db.upsert("user_settings", [patch], ["user_id"]);
}

export async function saveOnboardingSection(patch: Partial<Omit<OnboardingRow, "user_id" | "updated_at">>) {
  const existing = (await db.select("onboarding_responses"))[0];
  await db.upsert("onboarding_responses", [{ ...(existing ?? {}), ...patch }], ["user_id"]);
}

export async function saveGoals(goals: GoalKey[], targetWeeks: number | null) {
  const current = await db.select("fitness_goals");
  for (const g of current) if (!goals.includes(g.goal)) await db.remove("fitness_goals", { id: g.id });
  const rows: Partial<FitnessGoalRow>[] = goals.map((goal, i) => ({ goal, priority: i + 1, target_weeks: i === 0 ? targetWeeks : null, status: "active" }));
  if (rows.length) await db.upsert("fitness_goals", rows, ["user_id", "goal"]);
}

export async function saveNutritionPrefs(prefs: Partial<NutritionPrefsRow>) {
  await db.upsert("nutrition_preferences", [prefs], ["user_id"]);
}

export async function saveCycleSettings(settings: Partial<CycleSettingsRow>) {
  await db.upsert("cycle_settings", [settings], ["user_id"]);
}

/** Borra todos los datos personales, conservando la cuenta y un perfil vacío. */
export async function deleteAllMyData() {
  const photos = await db.select("progress_photos");
  await db.removePhotos(photos.map((p) => p.storage_path));
  for (const table of PERSONAL_TABLES) {
    const rows = await db.select(table);
    if (rows.length) await db.remove(table, {});
  }
  await updateProfile({
    birth_date: null, height_cm: null, weight_kg: null, target_weight_kg: null, sex: null, gender_identity: null,
    country: null, onboarding_completed: false, onboarding_step: 0,
  });
  await updateSettings({ cycle_tracking_enabled: false, health_consent_at: null });
}

/** Exporta los datos personales en JSON (derecho de acceso y portabilidad). */
export async function exportMyData(): Promise<Blob> {
  const tables = ["profiles", "user_settings", ...PERSONAL_TABLES] as const;
  const out: Record<string, unknown> = { exported_at: new Date().toISOString() };
  for (const t of tables) out[t] = await db.select(t);
  return new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
}
