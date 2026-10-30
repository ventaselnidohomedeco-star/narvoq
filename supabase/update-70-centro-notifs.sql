-- =====================================================================
-- update-70-centro-notifs.sql
-- Centro de Entrenamiento · Notificaciones completas
--
-- Triggers:
--   1) Alumno agregado al centro -> notif al alumno
--   2) Coach/Asistente agregado al staff -> notif al nuevo staff
--   3) Clase agendada (pillar_session futura) -> notif al alumno
--   4) Alumno confirmó asistencia -> notif al coach
--   5) Alumno declinó asistencia -> notif al coach
--   6) Nueva evaluación de coaching -> notif al alumno
--   7) Coach asignado cambió -> notif al alumno
-- =====================================================================

-- 1) Alumno agregado al centro
create or replace function notify_student_added_to_center()
returns trigger language plpgsql security definer as $$
declare
  v_center_name text;
begin
  if new.role <> 'student' then return new; end if;
  if new.profile_id is null then return new; end if;

  select name into v_center_name from training_centers where id = new.center_id;

  insert into notifications (user_id, kind, title, body, link, ref_id)
  values (
    new.profile_id,
    'coach_add',
    '🏫 Te sumaron a un Centro de Entrenamiento',
    'Ahora sos alumno de ' || coalesce(v_center_name, 'un centro') || '. Entrá a Mis clases para ver tus próximas sesiones.',
    '/jugador/mis-clases',
    new.center_id
  );
  return new;
end $$;

drop trigger if exists trg_notify_student_added on center_members;
create trigger trg_notify_student_added
after insert on center_members
for each row execute procedure notify_student_added_to_center();

-- 2) Coach/Asistente agregado al staff
create or replace function notify_staff_added_to_center()
returns trigger language plpgsql security definer as $$
declare
  v_center_name text;
  v_center_slug text;
begin
  if new.role not in ('coach', 'assistant') then return new; end if;
  if new.profile_id is null then return new; end if;

  select name, slug into v_center_name, v_center_slug from training_centers where id = new.center_id;

  insert into notifications (user_id, kind, title, body, link, ref_id)
  values (
    new.profile_id,
    'coach_add',
    '🎾 Te sumaron como ' || case when new.role = 'coach' then 'Coach' else 'Asistente' end,
    'Ahora formás parte del staff de ' || coalesce(v_center_name, 'un centro') || '. Entrá al panel para gestionar tus alumnos.',
    '/training/centro/' || v_center_slug,
    new.center_id
  );
  return new;
end $$;

drop trigger if exists trg_notify_staff_added on center_members;
create trigger trg_notify_staff_added
after insert on center_members
for each row execute procedure notify_staff_added_to_center();

-- 3) Clase agendada (sesión futura) -> notif al alumno
create or replace function notify_student_scheduled_session()
returns trigger language plpgsql security definer as $$
declare
  v_center_name text;
  v_coach_name text;
  v_date_fmt text;
begin
  -- Solo si es futura
  if new.date < current_date then return new; end if;
  if new.student_id is null then return new; end if;

  select name into v_center_name from training_centers where id = new.center_id;
  select first_name || ' ' || coalesce(last_name, '')
    into v_coach_name from profiles where id = new.coach_id;

  v_date_fmt := to_char(new.date, 'DD/MM')
    || case when new.session_time is not null then ' ' || to_char(new.session_time, 'HH24:MI') || 'hs' else '' end;

  insert into notifications (user_id, kind, title, body, link, ref_id)
  values (
    new.student_id,
    'training_new',
    '📅 Nueva clase agendada',
    'Tu coach ' || coalesce(trim(v_coach_name), 'del centro') ||
      ' agendó una clase de ' || new.pillar::text ||
      ' el ' || v_date_fmt || '. Confirmá tu asistencia.',
    '/jugador/mis-clases',
    new.id
  );
  return new;
end $$;

drop trigger if exists trg_notify_student_scheduled_session on pillar_sessions;
create trigger trg_notify_student_scheduled_session
after insert on pillar_sessions
for each row execute procedure notify_student_scheduled_session();

-- 4) + 5) Alumno confirmó o declinó asistencia -> notif al coach
create or replace function notify_coach_attendance_response()
returns trigger language plpgsql security definer as $$
declare
  v_student_name text;
  v_center_slug text;
  v_date_fmt text;
begin
  -- Solo si el confirmed_at cambió (nuevo valor) y el que confirmó fue el alumno
  if new.confirmed_at is null then return new; end if;
  if old.confirmed_at is not null then return new; end if;
  if new.confirmed_by <> 'student' then return new; end if;
  if new.coach_id is null then return new; end if;

  select first_name || ' ' || coalesce(last_name, '') into v_student_name
    from profiles where id = new.student_id;
  select slug into v_center_slug from training_centers where id = new.center_id;

  v_date_fmt := to_char(new.date, 'DD/MM')
    || case when new.session_time is not null then ' ' || to_char(new.session_time, 'HH24:MI') || 'hs' else '' end;

  insert into notifications (user_id, kind, title, body, link, ref_id)
  values (
    new.coach_id,
    'generic',
    case when new.attended = false then '✗ ' || trim(v_student_name) || ' NO va a la clase'
         else '✓ ' || trim(v_student_name) || ' confirmó asistencia' end,
    'Clase del ' || v_date_fmt ||
      case when new.attended = false then ' — avisó que no va a asistir' else ' — confirmó que va' end,
    '/training/centro/' || v_center_slug || '/confirmaciones',
    new.id
  );
  return new;
end $$;

drop trigger if exists trg_notify_coach_attendance on pillar_sessions;
create trigger trg_notify_coach_attendance
after update on pillar_sessions
for each row execute procedure notify_coach_attendance_response();

-- 6) Nueva evaluación de coaching -> notif al alumno
create or replace function notify_student_new_evaluation()
returns trigger language plpgsql security definer as $$
declare
  v_coach_name text;
begin
  select first_name || ' ' || coalesce(last_name, '') into v_coach_name
    from profiles where id = new.coach_id;

  insert into notifications (user_id, kind, title, body, link, ref_id)
  values (
    new.student_id,
    'generic',
    '🎯 Nueva evaluación de ' || coalesce(trim(v_coach_name), 'tu coach'),
    'Overall: ' || coalesce(new.overall::text, '-') || '/10. Entrá a Mis clases para ver fortalezas, mejoras y objetivos.',
    '/jugador/mis-clases',
    new.id
  );
  return new;
end $$;

drop trigger if exists trg_notify_student_new_eval on coaching_evaluations;
create trigger trg_notify_student_new_eval
after insert on coaching_evaluations
for each row execute procedure notify_student_new_evaluation();

-- 7) Coach asignado cambió -> notif al alumno y al nuevo coach
create or replace function notify_coach_assignment_change()
returns trigger language plpgsql security definer as $$
declare
  v_coach_name text;
  v_student_name text;
begin
  -- Solo si assigned_coach_id cambió y hay un nuevo coach
  if new.assigned_coach_id is null then return new; end if;
  if old.assigned_coach_id is not distinct from new.assigned_coach_id then return new; end if;
  if new.role <> 'student' then return new; end if;

  select first_name || ' ' || coalesce(last_name, '') into v_coach_name
    from profiles where id = new.assigned_coach_id;
  select first_name || ' ' || coalesce(last_name, '') into v_student_name
    from profiles where id = new.profile_id;

  -- Al alumno
  insert into notifications (user_id, kind, title, body, link, ref_id)
  values (
    new.profile_id,
    'generic',
    '🎾 Nuevo coach asignado',
    'Tu nuevo coach es ' || coalesce(trim(v_coach_name), 'del centro') || '. Va a gestionar tus clases y evaluaciones.',
    '/jugador/mis-clases',
    new.center_id
  );

  -- Al coach
  insert into notifications (user_id, kind, title, body, link, ref_id)
  values (
    new.assigned_coach_id,
    'generic',
    '➕ Nuevo alumno asignado',
    trim(v_student_name) || ' es tu nuevo alumno. Entrá a Alumnos para verlo.',
    '/training/dashboard',
    new.id
  );
  return new;
end $$;

drop trigger if exists trg_notify_coach_assignment on center_members;
create trigger trg_notify_coach_assignment
after update on center_members
for each row execute procedure notify_coach_assignment_change();

notify pgrst, 'reload schema';
