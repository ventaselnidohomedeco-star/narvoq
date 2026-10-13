-- =====================================================================
-- update-68-coaching-wa.sql
-- Centro de Entrenamiento · Sprint Fase 2:
--   1) Coaching: evaluaciones periódicas por alumno
--   2) Confirmaciones WA: sesiones futuras + tracking de confirmación
-- =====================================================================

-- 1) EVALUACIONES de coaching
create table if not exists coaching_evaluations (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references training_centers(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  coach_id uuid not null references profiles(id),
  date date not null default current_date,
  -- Scores 1-10
  score_tecnica int check (score_tecnica between 1 and 10),
  score_tactica int check (score_tactica between 1 and 10),
  score_fisico int check (score_fisico between 1 and 10),
  score_mental int check (score_mental between 1 and 10),
  score_actitud int check (score_actitud between 1 and 10),
  score_compromiso int check (score_compromiso between 1 and 10),
  overall int check (overall between 1 and 10),           -- promedio o manual
  strengths text,                                          -- fortalezas
  weaknesses text,                                         -- a mejorar
  goals text,                                              -- objetivos del período
  notes text,                                              -- notas libres
  next_eval_date date,                                     -- próxima evaluación sugerida
  created_at timestamptz not null default now()
);

create index if not exists idx_coaching_evals_student on coaching_evaluations(student_id, date desc);
create index if not exists idx_coaching_evals_center on coaching_evaluations(center_id);
create index if not exists idx_coaching_evals_coach on coaching_evaluations(coach_id);

alter table coaching_evaluations enable row level security;

create policy "coaching_evals read" on coaching_evaluations for select using (
  student_id = auth.uid()
  or coach_id = auth.uid()
  or exists (
    select 1 from center_members
    where center_id = coaching_evaluations.center_id
      and profile_id = auth.uid() and role in ('master','coach','assistant')
  )
);

create policy "coaching_evals write staff" on coaching_evaluations for all
  using (
    exists (
      select 1 from center_members
      where center_id = coaching_evaluations.center_id
        and profile_id = auth.uid() and role in ('master','coach','assistant')
    )
  )
  with check (
    exists (
      select 1 from center_members
      where center_id = coaching_evaluations.center_id
        and profile_id = auth.uid() and role in ('master','coach','assistant')
    )
  );

-- 2) CONFIRMACIONES de asistencia (para pillar_sessions futuras)
alter table pillar_sessions add column if not exists confirmed_at timestamptz;
alter table pillar_sessions add column if not exists confirmed_by text; -- 'student' | 'coach' | 'auto'
alter table pillar_sessions add column if not exists wa_sent_at timestamptz; -- cuándo se envió el mensaje
alter table pillar_sessions add column if not exists court_id uuid references courts(id); -- cancha opcional
alter table pillar_sessions add column if not exists session_time time; -- hora específica (ej 17:30)

create index if not exists idx_pillar_sessions_future on pillar_sessions(center_id, date) where date >= current_date;

notify pgrst, 'reload schema';
