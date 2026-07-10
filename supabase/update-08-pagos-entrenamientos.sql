-- Update 08: pagos por transferencia, membresias autogestionadas y entrenamientos pro
-- Ejecutar despues de update-07-banners.sql.

-- Datos de cobro del complejo
alter table complexes add column if not exists payment_alias text;
alter table complexes add column if not exists payment_cbu text;
alter table complexes add column if not exists payment_holder text;
alter table complexes add column if not exists payment_bank text;
alter table complexes add column if not exists payment_notes text;

-- Reservas: el jugador sube comprobante, el complejo valida y confirma
alter table bookings add column if not exists payment_status text not null default 'pendiente';
alter table bookings add column if not exists payment_proof_url text;
alter table bookings add column if not exists payment_uploaded_at timestamptz;
alter table bookings add column if not exists payment_confirmed_at timestamptz;
alter table bookings add column if not exists payment_confirmed_by uuid references profiles(id);

-- Membresias: solicitud del jugador + comprobante + aprobacion del complejo
alter table membership_members add column if not exists status text not null default 'activa';
alter table membership_members add column if not exists payment_status text not null default 'pagado';
alter table membership_members add column if not exists payment_proof_url text;
alter table membership_members add column if not exists payment_uploaded_at timestamptz;
alter table membership_members add column if not exists payment_confirmed_at timestamptz;
alter table membership_members add column if not exists payment_confirmed_by uuid references profiles(id);

drop policy if exists "members insert player" on membership_members;
create policy "members insert player" on membership_members for insert
  with check (player_id = auth.uid());

drop policy if exists "members update player proof" on membership_members;
create policy "members update player proof" on membership_members for update
  using (player_id = auth.uid())
  with check (player_id = auth.uid());

-- Entrenamientos compartidos por jugador, profe o institucion/complejo
alter table trainings add column if not exists complex_id uuid references complexes(id) on delete set null;
alter table trainings add column if not exists coach_id uuid references profiles(id) on delete set null;
alter table trainings add column if not exists focus text;
alter table trainings add column if not exists intensity int check (intensity between 1 and 10);
alter table trainings add column if not exists technical_score int check (technical_score between 1 and 10);
alter table trainings add column if not exists tactical_score int check (tactical_score between 1 and 10);
alter table trainings add column if not exists physical_score int check (physical_score between 1 and 10);
alter table trainings add column if not exists homework text;
alter table trainings add column if not exists shared_with_player boolean not null default true;

drop policy if exists "trainings all self" on trainings;
create policy "trainings read shared" on trainings for select using (
  player_id = auth.uid()
  or coach_id = auth.uid()
  or exists (select 1 from complexes c where c.id = trainings.complex_id and c.owner_id = auth.uid())
  or my_role() = 'super_admin'
);
create policy "trainings insert self or complex" on trainings for insert with check (
  player_id = auth.uid()
  or coach_id = auth.uid()
  or exists (select 1 from complexes c where c.id = complex_id and c.owner_id = auth.uid())
  or my_role() = 'super_admin'
);
create policy "trainings update owner" on trainings for update using (
  player_id = auth.uid()
  or coach_id = auth.uid()
  or exists (select 1 from complexes c where c.id = trainings.complex_id and c.owner_id = auth.uid())
  or my_role() = 'super_admin'
);

-- Banners: nuevas secciones posibles desde el panel CEO
-- No requiere alter table; banners.section es text.
