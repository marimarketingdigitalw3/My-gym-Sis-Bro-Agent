-- Pruebas de aislamiento entre usuarios. Cualquier fallo lanza una excepción y detiene el script.
\set ON_ERROR_STOP 1
\o /dev/null

create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FALLO: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

create or replace function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
  if uid is null then execute 'set role anon'; else execute 'set role authenticated'; end if;
end $$;

-- Datos base (como superusuario)
insert into exercise_library (id, name, name_en, category, pattern, primary_muscles, equipment, difficulty, instructions, default_unit)
values ('test-squat', 'Sentadilla test', 'Test squat', 'strength', 'squat', '{quads}', '{bodyweight}', 1, '{paso}', 'reps')
on conflict (id) do nothing;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@test.dev', '{"display_name":"Ana"}'),
  ('00000000-0000-0000-0000-00000000000b', 'beto@test.dev', '{"display_name":"Beto"}');

select pg_temp.assert((select count(*) = 2 from profiles), 'el trigger crea un perfil por usuario');
select pg_temp.assert((select count(*) = 2 from user_settings), 'el trigger crea ajustes por usuario');
select pg_temp.assert((select display_name = 'Ana' from profiles where id = '00000000-0000-0000-0000-00000000000a'), 'el nombre del registro se copia al perfil');

-- ---------- Ana crea sus datos ----------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
update profiles set height_cm = 165, weight_kg = 60, theme = 'sis' where id = auth.uid();
insert into workout_plans (id, user_id, name, split, days_per_week, session_minutes, schedule)
  values ('10000000-0000-0000-0000-00000000000a', auth.uid(), 'Plan Ana', 'full_body', 3, 45, '[]');
insert into workout_exercises (plan_id, user_id, day_index, position, exercise_id, sets, rep_min, rep_max)
  values ('10000000-0000-0000-0000-00000000000a', auth.uid(), 0, 0, 'test-squat', 3, 8, 12);
insert into workout_sessions (id, user_id, plan_id, title) values ('20000000-0000-0000-0000-00000000000a', auth.uid(), '10000000-0000-0000-0000-00000000000a', 'Día A');
insert into exercise_sets (session_id, user_id, exercise_id, set_number, reps, weight_kg) values ('20000000-0000-0000-0000-00000000000a', auth.uid(), 'test-squat', 1, 10, 20);
insert into cycle_logs (user_id, logged_on, period_start, symptoms) values (auth.uid(), current_date, true, '{cramps}');
insert into progress_measurements (user_id, measured_on, weight_kg) values (auth.uid(), current_date, 60);
insert into supplement_logs (user_id, logged_on, supplement) values (auth.uid(), current_date, 'creatine');
insert into chat_conversations (id, user_id) values ('30000000-0000-0000-0000-00000000000a', auth.uid());
insert into chat_messages (conversation_id, user_id, role, content) values ('30000000-0000-0000-0000-00000000000a', auth.uid(), 'user', 'Hola');
select pg_temp.assert((select count(*) = 1 from workout_exercises), 'Ana ve su ejercicio del plan');

do $$ begin
  insert into chat_messages (conversation_id, user_id, role, content)
    values ('30000000-0000-0000-0000-00000000000a', auth.uid(), 'assistant', 'respuesta falsa');
  raise exception 'FALLO: el cliente no debe poder insertar mensajes del asistente';
exception when insufficient_privilege or check_violation then raise notice 'ok - el cliente no puede escribir como asistente';
end $$;

do $$ begin
  insert into cycle_logs (user_id, logged_on) values ('00000000-0000-0000-0000-00000000000b', current_date);
  raise exception 'FALLO: Ana pudo insertar datos a nombre de Beto';
exception when insufficient_privilege then raise notice 'ok - no se puede insertar con el user_id de otra persona';
end $$;

-- ---------- Beto intenta acceder a lo de Ana ----------
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select count(*) = 1 from profiles), 'Beto solo ve su propio perfil');
select pg_temp.assert((select count(*) = 0 from workout_plans), 'Beto no ve planes ajenos');
select pg_temp.assert((select count(*) = 0 from workout_exercises), 'Beto no ve ejercicios de planes ajenos');
select pg_temp.assert((select count(*) = 0 from exercise_sets), 'Beto no ve series ajenas');
select pg_temp.assert((select count(*) = 0 from cycle_logs), 'Beto no ve datos de ciclo ajenos');
select pg_temp.assert((select count(*) = 0 from supplement_logs), 'Beto no ve suplementos ajenos');
select pg_temp.assert((select count(*) = 0 from progress_measurements), 'Beto no ve medidas ajenas');
select pg_temp.assert((select count(*) = 0 from chat_messages), 'Beto no ve conversaciones ajenas');
select pg_temp.assert((select count(*) > 0 from exercise_library), 'la biblioteca de ejercicios es pública para usuarios');

update profiles set weight_kg = 99 where id = '00000000-0000-0000-0000-00000000000a';
delete from cycle_logs where user_id = '00000000-0000-0000-0000-00000000000a';

do $$ begin
  insert into workout_exercises (plan_id, user_id, day_index, position, exercise_id, sets, rep_min, rep_max)
    values ('10000000-0000-0000-0000-00000000000a', auth.uid(), 1, 0, 'test-squat', 3, 8, 12);
  raise exception 'FALLO: Beto pudo añadir ejercicios al plan de Ana';
exception when insufficient_privilege then raise notice 'ok - no se pueden añadir hijos a un plan ajeno';
end $$;

do $$ begin
  insert into exercise_sets (session_id, user_id, exercise_id, set_number, reps)
    values ('20000000-0000-0000-0000-00000000000a', auth.uid(), 'test-squat', 2, 5);
  raise exception 'FALLO: Beto pudo añadir series a la sesión de Ana';
exception when insufficient_privilege then raise notice 'ok - no se pueden añadir series a una sesión ajena';
end $$;

do $$ begin
  insert into exercise_library (id, name, name_en, category, pattern, primary_muscles, equipment, difficulty, instructions, default_unit)
    values ('hack', 'x', 'x', 'strength', 'squat', '{quads}', '{bodyweight}', 1, '{x}', 'reps');
  raise exception 'FALLO: un usuario pudo escribir en la biblioteca pública';
exception when insufficient_privilege then raise notice 'ok - la biblioteca pública es de solo lectura';
end $$;

-- ---------- Anónimo ----------
select pg_temp.login(null);
select pg_temp.assert((select count(*) > 0 from exercise_library), 'anon puede leer la biblioteca de ejercicios');
do $$ begin
  perform count(*) from profiles;
  raise exception 'FALLO: anon pudo consultar perfiles';
exception when insufficient_privilege then raise notice 'ok - anon no tiene acceso a perfiles';
end $$;

-- ---------- Verificación como superusuario ----------
reset role;
select pg_temp.assert((select weight_kg = 60 from profiles where id = '00000000-0000-0000-0000-00000000000a'), 'el UPDATE de Beto no afectó el perfil de Ana');
select pg_temp.assert((select count(*) = 1 from cycle_logs), 'el DELETE de Beto no borró el ciclo de Ana');

-- Storage: las fotos solo dentro de la carpeta propia
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
do $$ begin
  insert into storage.objects (bucket_id, name) values ('progress-photos', '00000000-0000-0000-0000-00000000000a/foto.jpg');
  raise exception 'FALLO: Beto pudo subir a la carpeta de Ana';
exception when insufficient_privilege then raise notice 'ok - storage bloquea carpetas ajenas';
end $$;
insert into storage.objects (bucket_id, name) values ('progress-photos', '00000000-0000-0000-0000-00000000000b/foto.jpg');
select pg_temp.assert((select count(*) = 1 from storage.objects), 'Beto solo ve su propia foto');
reset role;

-- Borrado de cuenta: elimina en cascada todos los datos personales
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.assert((select count(*) = 0 from workout_plans where user_id = '00000000-0000-0000-0000-00000000000a'), 'borrar la cuenta elimina planes');
select pg_temp.assert((select count(*) = 0 from exercise_sets where user_id = '00000000-0000-0000-0000-00000000000a'), 'borrar la cuenta elimina series');
select pg_temp.assert((select count(*) = 0 from chat_messages where user_id = '00000000-0000-0000-0000-00000000000a'), 'borrar la cuenta elimina el chat');
select pg_temp.assert((select count(*) = 0 from cycle_logs where user_id = '00000000-0000-0000-0000-00000000000a'), 'borrar la cuenta elimina el ciclo');
select pg_temp.assert((select count(*) = 0 from supplement_logs where user_id = '00000000-0000-0000-0000-00000000000a'), 'borrar la cuenta elimina los suplementos');
select pg_temp.assert((select count(*) = 1 from profiles), 'el otro usuario conserva su perfil');

\o
\echo 'TODAS LAS PRUEBAS DE RLS PASARON'
