-- Suplementos y horario de comidas (Gym Sis y Gym Bro).
-- Ritmo diario de la persona para sugerir horarios: hora de despertar y de dormir.
alter table public.nutrition_preferences
  add column supplements text[] not null default '{}' check (cardinality(supplements) <= 20),
  add column wake_time text check (wake_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  add column sleep_time text check (sleep_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- Registro diario de suplementos tomados.
create table public.supplement_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_on date not null,
  supplement text not null check (char_length(supplement) between 1 and 40),
  taken_at timestamptz not null default now(),
  unique (user_id, logged_on, supplement)
);
create index supplement_logs_user_idx on public.supplement_logs (user_id, logged_on desc);

alter table public.supplement_logs enable row level security;
create policy "supplement_logs_select_own" on public.supplement_logs for select to authenticated using (user_id = auth.uid());
create policy "supplement_logs_insert_own" on public.supplement_logs for insert to authenticated with check (user_id = auth.uid());
create policy "supplement_logs_update_own" on public.supplement_logs for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "supplement_logs_delete_own" on public.supplement_logs for delete to authenticated using (user_id = auth.uid());
