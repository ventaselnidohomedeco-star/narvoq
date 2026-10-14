-- =====================================================================
-- update-69-alumno-features.sql
-- Centro de Entrenamiento · Mejoras post-review:
--   1) assigned_coach_id: cada alumno tiene un coach asignado
--   2) RLS para que el alumno pueda confirmar/rechazar su propia asistencia
-- =====================================================================

-- 1) Coach asignado al alumno (self-reference en profiles)
alter table center_members add column if not exists assigned_coach_id uuid references profiles(id) on delete set null;
create index if not exists idx_center_members_assigned_coach on center_members(assigned_coach_id) where assigned_coach_id is not null;

-- 2) RLS: el alumno puede UPDATE sus propias pillar_sessions futuras (solo para confirmar/rechazar)
drop policy if exists "pillar_sessions update student self" on pillar_sessions;
create policy "pillar_sessions update student self" on pillar_sessions for update
  using (student_id = auth.uid() and date >= current_date)
  with check (student_id = auth.uid());

-- 3) Vista: progreso completo del alumno (para su propia página)
create or replace view v_alumno_evoluacion as
select
  ce.student_id,
  ce.center_id,
  ce.date,
  ce.overall,
  ce.score_tecnica,
  ce.score_tactica,
  ce.score_fisico,
  ce.score_mental,
  ce.score_actitud,
  ce.score_compromiso,
  ce.strengths,
  ce.weaknesses,
  ce.goals,
  p.first_name || ' ' || p.last_name as coach_name
from coaching_evaluations ce
left join profiles p on p.id = ce.coach_id
order by ce.date desc;

notify pgrst, 'reload schema';
