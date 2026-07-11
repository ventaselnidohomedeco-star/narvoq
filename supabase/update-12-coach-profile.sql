-- ============================================================
-- Actualización 12 — Perfil ampliado de profe/entrenador
-- Ejecutar UNA VEZ en el SQL Editor de Supabase (idempotente).
-- ============================================================

-- Perfil del profe: disponibilidad, tarifas, especialidad, complejos
alter table profiles add column if not exists availability jsonb;
-- ejemplo: [{ "day": "lun", "from": "16:00", "to": "22:00" }, ...]

alter table profiles add column if not exists price_individual numeric(10,2);
alter table profiles add column if not exists price_group numeric(10,2);
alter table profiles add column if not exists specialty text;
-- 'competencia' | 'iniciacion' | 'infantil' | 'femenino' | 'padel_adaptado' | 'tecnica' | 'fisico'

alter table profiles add column if not exists level_min int check (level_min between 1 and 8);
alter table profiles add column if not exists level_max int check (level_max between 1 and 8);
alter table profiles add column if not exists coach_complexes text[];
-- lista libre de complejos donde trabaja

alter table profiles add column if not exists years_experience int;

-- Objetivos por alumno
alter table coach_students add column if not exists objectives text;
alter table coach_students add column if not exists start_date date default current_date;

-- Evaluaciones periódicas del alumno (adicional a las trainings)
create table if not exists coach_evaluations (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references profiles(id) on delete cascade,
  player_id uuid not null references profiles(id) on delete cascade,
  period text not null,                -- ej: 'Trimestre 1 2026'
  overall int check (overall between 1 and 10),
  technical int check (technical between 1 and 10),
  tactical int check (tactical between 1 and 10),
  physical int check (physical between 1 and 10),
  mental int check (mental between 1 and 10),
  strengths text,
  improvements text,
  video_url text,
  created_at timestamptz not null default now()
);
alter table coach_evaluations enable row level security;

drop policy if exists "evals read" on coach_evaluations;
create policy "evals read" on coach_evaluations for select
  using (coach_id = auth.uid() or player_id = auth.uid() or my_role() = 'super_admin');

drop policy if exists "evals write coach" on coach_evaluations;
create policy "evals write coach" on coach_evaluations for all
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());

-- Reservas de clases del alumno con el profe
create table if not exists coach_bookings (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references profiles(id) on delete cascade,
  player_id uuid not null references profiles(id) on delete cascade,
  type text not null default 'individual',  -- 'individual' | 'grupal'
  starts_at timestamptz not null,
  duration_min int not null default 60,
  price numeric(10,2),
  status text not null default 'solicitada',  -- 'solicitada' | 'confirmada' | 'cancelada' | 'jugada'
  payment_status text not null default 'pendiente',
  notes text,
  created_at timestamptz not null default now()
);
alter table coach_bookings enable row level security;

drop policy if exists "cbookings read" on coach_bookings;
create policy "cbookings read" on coach_bookings for select
  using (coach_id = auth.uid() or player_id = auth.uid() or my_role() = 'super_admin');

drop policy if exists "cbookings insert player" on coach_bookings;
create policy "cbookings insert player" on coach_bookings for insert
  with check (player_id = auth.uid());

drop policy if exists "cbookings update" on coach_bookings;
create policy "cbookings update" on coach_bookings for update
  using (coach_id = auth.uid() or player_id = auth.uid());
