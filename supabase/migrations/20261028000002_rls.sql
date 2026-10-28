-- Row Level Security: cada persona solo accede a sus propios datos.

alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- Inserción y borrado: solo el trigger de registro y el borrado en cascada de auth.users.

-- Tablas con una fila (o varias) por usuario y columna user_id.
do $$
declare
  t text;
begin
  foreach t in array array[
    'user_settings', 'onboarding_responses', 'fitness_goals', 'nutrition_preferences', 'cycle_settings',
    'workout_plans', 'workout_sessions', 'meal_plans', 'meal_logs', 'water_logs',
    'progress_measurements', 'progress_photos', 'recovery_logs', 'cycle_logs', 'chat_conversations'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s_select_own" on public.%I for select to authenticated using (user_id = auth.uid())', t, t);
    execute format('create policy "%s_insert_own" on public.%I for insert to authenticated with check (user_id = auth.uid())', t, t);
    execute format('create policy "%s_update_own" on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
    execute format('create policy "%s_delete_own" on public.%I for delete to authenticated using (user_id = auth.uid())', t, t);
  end loop;
end;
$$;

-- Filas hijas: además del user_id, el padre debe pertenecer a la misma persona.
alter table public.workout_exercises enable row level security;
create policy "workout_exercises_select_own" on public.workout_exercises for select to authenticated
  using (user_id = auth.uid());
create policy "workout_exercises_insert_own" on public.workout_exercises for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from public.workout_plans p where p.id = plan_id and p.user_id = auth.uid()));
create policy "workout_exercises_update_own" on public.workout_exercises for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (
    select 1 from public.workout_plans p where p.id = plan_id and p.user_id = auth.uid()));
create policy "workout_exercises_delete_own" on public.workout_exercises for delete to authenticated
  using (user_id = auth.uid());

alter table public.exercise_sets enable row level security;
create policy "exercise_sets_select_own" on public.exercise_sets for select to authenticated
  using (user_id = auth.uid());
create policy "exercise_sets_insert_own" on public.exercise_sets for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from public.workout_sessions s where s.id = session_id and s.user_id = auth.uid()));
create policy "exercise_sets_update_own" on public.exercise_sets for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (
    select 1 from public.workout_sessions s where s.id = session_id and s.user_id = auth.uid()));
create policy "exercise_sets_delete_own" on public.exercise_sets for delete to authenticated
  using (user_id = auth.uid());

alter table public.chat_messages enable row level security;
create policy "chat_messages_select_own" on public.chat_messages for select to authenticated
  using (user_id = auth.uid());
-- Los mensajes del asistente los escribe la Edge Function con service_role.
-- Desde el cliente solo se pueden insertar mensajes propios con rol 'user'.
create policy "chat_messages_insert_own" on public.chat_messages for insert to authenticated
  with check (user_id = auth.uid() and role = 'user' and exists (
    select 1 from public.chat_conversations c where c.id = conversation_id and c.user_id = auth.uid()));
create policy "chat_messages_delete_own" on public.chat_messages for delete to authenticated
  using (user_id = auth.uid());

-- Biblioteca pública: lectura para todos, escritura solo vía migraciones/service_role.
alter table public.exercise_library enable row level security;
create policy "exercise_library_public_read" on public.exercise_library for select to anon, authenticated using (true);

-- Ningún permiso para anon sobre datos personales.
revoke all on all tables in schema public from anon;
grant select on public.exercise_library to anon;
