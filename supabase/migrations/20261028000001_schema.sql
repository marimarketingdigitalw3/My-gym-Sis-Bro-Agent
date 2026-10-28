-- My Gym/Sis · Gym Bro: esquema principal
-- Todas las tablas privadas llevan user_id y RLS que limita el acceso al propietario.
-- La biblioteca de ejercicios es pública (solo lectura) y está separada de los registros personales.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Perfil y ajustes
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 50),
  birth_date date check (birth_date > date '1900-01-01' and birth_date < current_date),
  height_cm numeric(5,1) check (height_cm between 100 and 250),
  weight_kg numeric(5,1) check (weight_kg between 25 and 350),
  target_weight_kg numeric(5,1) check (target_weight_kg between 25 and 350),
  country text check (char_length(country) <= 60),
  units text not null default 'metric' check (units in ('metric', 'imperial')),
  language text not null default 'es' check (language in ('es', 'en')),
  sex text check (sex in ('female', 'male')),
  gender_identity text check (char_length(gender_identity) <= 50),
  theme text not null default 'neutral' check (theme in ('sis', 'bro', 'neutral')),
  onboarding_step smallint not null default 0 check (onboarding_step between 0 and 10),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  cycle_tracking_enabled boolean not null default false,
  water_tracking_enabled boolean not null default true,
  calorie_tracking_enabled boolean not null default true,
  ai_share_context boolean not null default true,
  health_consent_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Respuestas del cuestionario que no tienen tabla propia.
-- health contiene datos de salud sensibles: nunca se envía completo al proveedor de IA.
create table public.onboarding_responses (
  user_id uuid primary key references auth.users (id) on delete cascade,
  fitness jsonb not null default '{}'::jsonb,
  environment jsonb not null default '{}'::jsonb,
  lifestyle jsonb not null default '{}'::jsonb,
  health jsonb not null default '{}'::jsonb,
  body_type jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.fitness_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal text not null check (goal in (
    'lose_fat', 'build_muscle', 'strength', 'endurance', 'cardio_health', 'mobility',
    'recomposition', 'glutes_legs', 'upper_body', 'general_health', 'maintain')),
  priority smallint not null default 2 check (priority between 1 and 11),
  target_weeks smallint check (target_weeks between 4 and 104),
  status text not null default 'active' check (status in ('active', 'achieved', 'archived')),
  created_at timestamptz not null default now(),
  unique (user_id, goal)
);
create index fitness_goals_user_idx on public.fitness_goals (user_id, priority);

create table public.nutrition_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  diet text not null default 'omnivore' check (diet in ('omnivore', 'vegetarian', 'vegan', 'pescatarian')),
  eating_pattern text check (char_length(eating_pattern) <= 60),
  allergens text[] not null default '{}',
  dislikes text[] not null default '{}',
  meals_per_day smallint not null default 4 check (meals_per_day between 2 and 6),
  budget text not null default 'medium' check (budget in ('low', 'medium', 'high')),
  cooking_minutes smallint not null default 30 check (cooking_minutes between 5 and 180),
  cuisines text[] not null default '{colombian}',
  wants_meal_prep boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.cycle_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_period_start date,
  typical_cycle_length smallint check (typical_cycle_length between 15 and 60),
  typical_period_length smallint check (typical_period_length between 1 and 10),
  regularity text not null default 'unknown' check (regularity in ('regular', 'irregular', 'unknown')),
  hormonal_contraception boolean not null default false,
  wants_phase_estimates boolean not null default true,
  period_training_preference text check (period_training_preference in ('as_usual', 'lighter', 'decide_daily')),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Biblioteca pública de ejercicios
-- ---------------------------------------------------------------------------
create table public.exercise_library (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null,
  name_en text not null,
  category text not null check (category in ('strength', 'cardio', 'mobility', 'core')),
  pattern text not null,
  primary_muscles text[] not null,
  secondary_muscles text[] not null default '{}',
  equipment text[] not null,
  difficulty smallint not null check (difficulty between 1 and 3),
  stressed_joints text[] not null default '{}',
  unilateral boolean not null default false,
  is_compound boolean not null default false,
  instructions text[] not null,
  common_mistakes text[] not null default '{}',
  alternatives text[] not null default '{}',
  default_unit text not null check (default_unit in ('reps', 'seconds')),
  load_increment_kg numeric(4,1) not null default 0
);

-- ---------------------------------------------------------------------------
-- Entrenamiento
-- ---------------------------------------------------------------------------
create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  is_active boolean not null default true,
  split text not null,
  days_per_week smallint not null check (days_per_week between 1 and 7),
  session_minutes smallint not null check (session_minutes between 10 and 180),
  schedule jsonb not null,
  rationale text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index workout_plans_one_active on public.workout_plans (user_id) where is_active;

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.workout_plans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  day_index smallint not null check (day_index between 0 and 6),
  position smallint not null check (position >= 0),
  exercise_id text not null references public.exercise_library (id),
  sets smallint not null check (sets between 1 and 10),
  rep_min smallint check (rep_min between 1 and 100),
  rep_max smallint check (rep_max between 1 and 100),
  duration_s smallint check (duration_s between 5 and 7200),
  rest_s smallint not null default 60 check (rest_s between 0 and 600),
  target_rpe numeric(3,1) check (target_rpe between 1 and 10),
  load_kg numeric(6,2) check (load_kg >= 0),
  notes text check (char_length(notes) <= 300),
  check (rep_min is null or rep_max is null or rep_min <= rep_max),
  check (rep_max is not null or duration_s is not null)
);
create index workout_exercises_plan_idx on public.workout_exercises (plan_id, day_index, position);
create index workout_exercises_user_idx on public.workout_exercises (user_id);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid references public.workout_plans (id) on delete set null,
  day_index smallint check (day_index between 0 and 6),
  title text not null check (char_length(title) <= 80),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_s integer check (duration_s >= 0),
  perceived_effort smallint check (perceived_effort between 1 and 10),
  pain_reported boolean not null default false,
  notes text check (char_length(notes) <= 1000),
  check (completed_at is null or completed_at >= started_at)
);
create index workout_sessions_user_idx on public.workout_sessions (user_id, started_at desc);

create table public.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id text not null references public.exercise_library (id),
  set_number smallint not null check (set_number between 1 and 20),
  target_reps smallint check (target_reps between 1 and 100),
  reps smallint check (reps between 0 and 200),
  weight_kg numeric(6,2) check (weight_kg between 0 and 1000),
  duration_s smallint check (duration_s between 0 and 7200),
  rpe numeric(3,1) check (rpe between 1 and 10),
  completed boolean not null default true,
  pain boolean not null default false,
  created_at timestamptz not null default now(),
  unique (session_id, exercise_id, set_number)
);
create index exercise_sets_user_exercise_idx on public.exercise_sets (user_id, exercise_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Nutrición
-- ---------------------------------------------------------------------------
create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  targets jsonb not null,
  days jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create table public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_on date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  name text not null check (char_length(name) between 1 and 120),
  kcal smallint not null check (kcal between 0 and 5000),
  protein_g numeric(5,1) not null default 0 check (protein_g between 0 and 500),
  carbs_g numeric(5,1) not null default 0 check (carbs_g between 0 and 1000),
  fat_g numeric(5,1) not null default 0 check (fat_g between 0 and 500),
  recipe_id text,
  source text not null default 'manual' check (source in ('plan', 'manual', 'quick')),
  is_estimate boolean not null default true,
  created_at timestamptz not null default now()
);
create index meal_logs_user_day_idx on public.meal_logs (user_id, logged_on);

create table public.water_logs (
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_on date not null,
  ml integer not null default 0 check (ml between 0 and 15000),
  primary key (user_id, logged_on)
);

-- ---------------------------------------------------------------------------
-- Progreso, bienestar y ciclo
-- ---------------------------------------------------------------------------
create table public.progress_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  measured_on date not null,
  weight_kg numeric(5,1) check (weight_kg between 25 and 350),
  waist_cm numeric(5,1) check (waist_cm between 30 and 250),
  hips_cm numeric(5,1) check (hips_cm between 30 and 250),
  chest_cm numeric(5,1) check (chest_cm between 30 and 250),
  arm_cm numeric(5,1) check (arm_cm between 10 and 100),
  thigh_cm numeric(5,1) check (thigh_cm between 20 and 150),
  body_fat_pct numeric(4,1) check (body_fat_pct between 2 and 70),
  notes text check (char_length(notes) <= 300),
  created_at timestamptz not null default now(),
  check (coalesce(weight_kg, waist_cm, hips_cm, chest_cm, arm_cm, thigh_cm, body_fat_pct) is not null)
);
create index progress_measurements_user_idx on public.progress_measurements (user_id, measured_on);

create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  taken_on date not null,
  storage_path text not null unique,
  pose text check (pose in ('front', 'side', 'back', 'other')),
  notes text check (char_length(notes) <= 300),
  created_at timestamptz not null default now(),
  -- La ruta debe vivir dentro de la carpeta del propietario.
  check (split_part(storage_path, '/', 1) = user_id::text)
);
create index progress_photos_user_idx on public.progress_photos (user_id, taken_on);

create table public.recovery_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_on date not null,
  energy smallint check (energy between 1 and 5),
  sleep_hours numeric(3,1) check (sleep_hours between 0 and 24),
  soreness smallint check (soreness between 1 and 5),
  stress smallint check (stress between 1 and 5),
  pain_areas text[] not null default '{}',
  red_flags text[] not null default '{}',
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  unique (user_id, logged_on)
);

create table public.cycle_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_on date not null,
  period_start boolean not null default false,
  flow text check (flow in ('none', 'spotting', 'light', 'medium', 'heavy')),
  symptoms text[] not null default '{}',
  energy smallint check (energy between 1 and 5),
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  unique (user_id, logged_on)
);

-- ---------------------------------------------------------------------------
-- Gym AI Coach
-- ---------------------------------------------------------------------------
create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Nueva conversación' check (char_length(title) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index chat_conversations_user_idx on public.chat_conversations (user_id, updated_at desc);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 8000),
  source text not null default 'ai' check (source in ('ai', 'fallback', 'safety', 'user')),
  created_at timestamptz not null default now()
);
create index chat_messages_conversation_idx on public.chat_messages (conversation_id, created_at);
create index chat_messages_user_recent_idx on public.chat_messages (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger user_settings_updated before update on public.user_settings for each row execute function public.set_updated_at();
create trigger onboarding_updated before update on public.onboarding_responses for each row execute function public.set_updated_at();
create trigger nutrition_prefs_updated before update on public.nutrition_preferences for each row execute function public.set_updated_at();
create trigger cycle_settings_updated before update on public.cycle_settings for each row execute function public.set_updated_at();
create trigger workout_plans_updated before update on public.workout_plans for each row execute function public.set_updated_at();
create trigger meal_plans_updated before update on public.meal_plans for each row execute function public.set_updated_at();
create trigger chat_conversations_updated before update on public.chat_conversations for each row execute function public.set_updated_at();

-- Crea el perfil y los ajustes al registrarse.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(left(new.raw_user_meta_data ->> 'display_name', 50), ''));
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
