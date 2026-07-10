-- ============================================================
-- Actualización 09 — Sección Training (rol profe/entrenador)
-- Ejecutar UNA VEZ en el SQL Editor de Supabase
-- ============================================================

-- 1) Ampliar el enum de roles con 'coach' (profe)
alter type user_role add value if not exists 'coach';

-- 2) Vínculo profe ↔ alumno
create table if not exists coach_students (
  coach_id uuid not null references profiles(id) on delete cascade,
  player_id uuid not null references profiles(id) on delete cascade,
  nickname text,
  created_at timestamptz not null default now(),
  primary key (coach_id, player_id)
);
alter table coach_students enable row level security;

drop policy if exists "coach_students read" on coach_students;
create policy "coach_students read" on coach_students for select
  using (coach_id = auth.uid() or player_id = auth.uid() or my_role() = 'super_admin');

drop policy if exists "coach_students insert" on coach_students;
create policy "coach_students insert" on coach_students for insert
  with check (coach_id = auth.uid());

drop policy if exists "coach_students delete" on coach_students;
create policy "coach_students delete" on coach_students for delete
  using (coach_id = auth.uid());

-- 3) Permitir al profe leer los entrenamientos de sus alumnos aunque el
-- entrenamiento haya sido cargado por otro profe / el jugador.
drop policy if exists "trainings read shared" on trainings;
create policy "trainings read shared" on trainings for select using (
  player_id = auth.uid()
  or coach_id = auth.uid()
  or exists (select 1 from coach_students cs
             where cs.coach_id = auth.uid() and cs.player_id = trainings.player_id)
  or exists (select 1 from complexes c
             where c.id = trainings.complex_id and c.owner_id = auth.uid())
  or my_role() = 'super_admin'
);

-- 4) El profe puede registrar entrenamientos de sus alumnos vinculados.
drop policy if exists "trainings insert self or complex" on trainings;
create policy "trainings insert self or coach or complex" on trainings for insert with check (
  player_id = auth.uid()
  or coach_id = auth.uid()
  or exists (select 1 from coach_students cs
             where cs.coach_id = auth.uid() and cs.player_id = trainings.player_id)
  or exists (select 1 from complexes c
             where c.id = complex_id and c.owner_id = auth.uid())
  or my_role() = 'super_admin'
);
