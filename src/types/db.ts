// Filas de la base de datos. Reflejan supabase/migrations/*.sql (snake_case).
import type {
  Allergen, BiologicalSex, BudgetLevel, CuisineStyle, DietPattern, Equipment, FitnessLevel, GoalKey,
  JointArea, Language, MealType, ThemeName, TrainingEnvironment, Units,
} from "./domain";

export interface ProfileRow {
  id: string;
  display_name: string;
  birth_date: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  target_weight_kg: number | null;
  country: string | null;
  units: Units;
  language: Language;
  sex: BiologicalSex | null;
  gender_identity: string | null;
  theme: ThemeName;
  onboarding_step: number;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserSettingsRow {
  user_id: string;
  cycle_tracking_enabled: boolean;
  water_tracking_enabled: boolean;
  calorie_tracking_enabled: boolean;
  ai_share_context: boolean;
  health_consent_at: string | null;
  updated_at: string;
}

export interface FitnessAnswers {
  level?: FitnessLevel;
  experienceMonths?: number;
  daysPerWeek?: number;
  sessionMinutes?: number;
  hasRoutine?: boolean;
  knownExercises?: string[];
  dislikedExercises?: string[];
}

export interface EnvironmentAnswers {
  environment?: TrainingEnvironment;
  equipment?: Equipment[];
}

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

export interface LifestyleAnswers {
  activityLevel?: ActivityLevel;
  dailySteps?: number | null;
  occupation?: "sitting" | "mixed" | "physical";
  sleepHours?: number;
  preferredDays?: number[]; // 0 = lunes ... 6 = domingo
  preferredTime?: "morning" | "midday" | "evening" | "flexible";
  stressLevel?: 1 | 2 | 3 | 4 | 5 | null;
  sports?: string;
}

export interface HealthAnswers {
  limitations?: JointArea[];
  injuriesNotes?: string;
  chronicConditions?: boolean;
  chronicNotes?: string;
  pregnancyStatus?: "none" | "pregnant" | "postpartum" | "prefer_not";
  medicalRestriction?: boolean;
  painDuringExercise?: boolean;
  redFlags?: string[]; // ver lib/safety
  edHistory?: boolean | null; // null = prefiere no responder
  acknowledgedDisclaimer?: boolean;
}

export interface BodyTypeAnswers {
  wantsClassification?: boolean;
  answers?: Record<string, "a" | "b" | "c">;
  result?: "ectomorph" | "mesomorph" | "endomorph" | "mixed" | null;
}

export interface OnboardingRow {
  user_id: string;
  fitness: FitnessAnswers;
  environment: EnvironmentAnswers;
  lifestyle: LifestyleAnswers;
  health: HealthAnswers;
  body_type: BodyTypeAnswers;
  updated_at: string;
}

export interface FitnessGoalRow {
  id: string;
  user_id: string;
  goal: GoalKey;
  priority: number;
  target_weeks: number | null;
  status: "active" | "achieved" | "archived";
  created_at: string;
}

export interface NutritionPrefsRow {
  user_id: string;
  diet: DietPattern;
  eating_pattern: string | null;
  allergens: Allergen[];
  dislikes: string[];
  meals_per_day: number;
  budget: BudgetLevel;
  cooking_minutes: number;
  cuisines: CuisineStyle[];
  wants_meal_prep: boolean;
  /** Claves del catálogo de suplementos que la persona toma. */
  supplements: string[];
  /** "HH:MM" */
  wake_time: string | null;
  sleep_time: string | null;
  updated_at: string;
}

export interface SupplementLogRow {
  id: string;
  user_id: string;
  logged_on: string;
  supplement: string;
  taken_at: string;
}

export interface CycleSettingsRow {
  user_id: string;
  last_period_start: string | null;
  typical_cycle_length: number | null;
  typical_period_length: number | null;
  regularity: "regular" | "irregular" | "unknown";
  hormonal_contraception: boolean;
  wants_phase_estimates: boolean;
  period_training_preference: "as_usual" | "lighter" | "decide_daily" | null;
  updated_at: string;
}

export interface WorkoutDayMeta {
  dayIndex: number; // 0..6 dentro de la semana del plan
  weekday: number; // 0 = lunes
  title: string;
  focus: string;
  warmup: string[];
  cooldown: string[];
  estimatedMinutes: number;
  /** Hora de inicio "HH:MM" elegida por la persona. Si falta, se usa su horario preferido. */
  time?: string;
}

export interface WorkoutPlanRow {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  split: string;
  days_per_week: number;
  session_minutes: number;
  schedule: WorkoutDayMeta[];
  rationale: string[];
  created_at: string;
  updated_at: string;
}

export interface WorkoutExerciseRow {
  id: string;
  plan_id: string;
  user_id: string;
  day_index: number;
  position: number;
  exercise_id: string;
  sets: number;
  rep_min: number | null;
  rep_max: number | null;
  duration_s: number | null;
  rest_s: number;
  target_rpe: number | null;
  load_kg: number | null;
  notes: string | null;
}

export interface WorkoutSessionRow {
  id: string;
  user_id: string;
  plan_id: string | null;
  day_index: number | null;
  title: string;
  status: "in_progress" | "completed" | "abandoned";
  started_at: string;
  completed_at: string | null;
  duration_s: number | null;
  perceived_effort: number | null;
  pain_reported: boolean;
  notes: string | null;
}

export interface ExerciseSetRow {
  id: string;
  session_id: string;
  user_id: string;
  exercise_id: string;
  set_number: number;
  target_reps: number | null;
  reps: number | null;
  weight_kg: number | null;
  duration_s: number | null;
  rpe: number | null;
  completed: boolean;
  pain: boolean;
  created_at: string;
}

export interface MacroTargets {
  kcal: number;
  kcalMin: number;
  kcalMax: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  waterMl: number;
}

export interface PlannedMeal {
  mealType: MealType;
  recipeId: string;
  servings: number;
  completed: boolean;
}

export interface MealPlanDay {
  date: string;
  meals: PlannedMeal[];
}

export interface MealPlanRow {
  id: string;
  user_id: string;
  week_start: string;
  targets: MacroTargets | null;
  days: MealPlanDay[];
  created_at: string;
  updated_at: string;
}

export interface MealLogRow {
  id: string;
  user_id: string;
  logged_on: string;
  meal_type: MealType;
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  recipe_id: string | null;
  source: "plan" | "manual" | "quick";
  is_estimate: boolean;
  created_at: string;
}

export interface WaterLogRow {
  user_id: string;
  logged_on: string;
  ml: number;
}

export interface MeasurementRow {
  id: string;
  user_id: string;
  measured_on: string;
  weight_kg: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  body_fat_pct: number | null;
  notes: string | null;
  created_at: string;
}

export interface ProgressPhotoRow {
  id: string;
  user_id: string;
  taken_on: string;
  storage_path: string;
  pose: "front" | "side" | "back" | "other" | null;
  notes: string | null;
  created_at: string;
}

export interface RecoveryLogRow {
  id: string;
  user_id: string;
  logged_on: string;
  energy: number | null;
  sleep_hours: number | null;
  soreness: number | null;
  stress: number | null;
  pain_areas: JointArea[];
  red_flags: string[];
  notes: string | null;
  created_at: string;
}

export interface CycleLogRow {
  id: string;
  user_id: string;
  logged_on: string;
  period_start: boolean;
  flow: "none" | "spotting" | "light" | "medium" | "heavy" | null;
  symptoms: string[];
  energy: number | null;
  notes: string | null;
  created_at: string;
}

export interface ChatConversationRow {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRow {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  source: "ai" | "fallback" | "safety" | "user";
  created_at: string;
}

export interface Tables {
  profiles: ProfileRow;
  user_settings: UserSettingsRow;
  onboarding_responses: OnboardingRow;
  fitness_goals: FitnessGoalRow;
  nutrition_preferences: NutritionPrefsRow;
  cycle_settings: CycleSettingsRow;
  workout_plans: WorkoutPlanRow;
  workout_exercises: WorkoutExerciseRow;
  workout_sessions: WorkoutSessionRow;
  exercise_sets: ExerciseSetRow;
  meal_plans: MealPlanRow;
  meal_logs: MealLogRow;
  water_logs: WaterLogRow;
  supplement_logs: SupplementLogRow;
  progress_measurements: MeasurementRow;
  progress_photos: ProgressPhotoRow;
  recovery_logs: RecoveryLogRow;
  cycle_logs: CycleLogRow;
  chat_conversations: ChatConversationRow;
  chat_messages: ChatMessageRow;
}

export type TableName = keyof Tables;
