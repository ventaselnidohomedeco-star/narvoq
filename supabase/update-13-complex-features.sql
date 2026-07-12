-- ============================================================
-- Actualización 13 — Features de complejo
-- Lista de espera de turnos + promos por baja demanda + reglas de descuento
-- Ejecutar UNA VEZ en el SQL Editor de Supabase (idempotente).
-- ============================================================

-- 1) Lista de espera por horario específico de cancha
create table if not exists booking_waitlist (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references courts(id) on delete cascade,
  starts_at timestamptz not null,
  player_id uuid not null references profiles(id) on delete cascade,
  notified_at timestamptz,       -- se fija cuando le avisamos que se liberó
  fulfilled_at timestamptz,      -- se fija si finalmente reserva
  created_at timestamptz not null default now(),
  unique (court_id, starts_at, player_id)
);
alter table booking_waitlist enable row level security;

drop policy if exists "waitlist read own or complex" on booking_waitlist;
create policy "waitlist read own or complex" on booking_waitlist for select using (
  player_id = auth.uid()
  or exists (select 1 from courts c join complexes cx on cx.id = c.complex_id
             where c.id = court_id and cx.owner_id = auth.uid())
  or my_role() = 'super_admin'
);

drop policy if exists "waitlist insert own" on booking_waitlist;
create policy "waitlist insert own" on booking_waitlist for insert
  with check (player_id = auth.uid());

drop policy if exists "waitlist update" on booking_waitlist;
create policy "waitlist update" on booking_waitlist for update using (
  player_id = auth.uid()
  or exists (select 1 from courts c join complexes cx on cx.id = c.complex_id
             where c.id = court_id and cx.owner_id = auth.uid())
);

drop policy if exists "waitlist delete own" on booking_waitlist;
create policy "waitlist delete own" on booking_waitlist for delete using (
  player_id = auth.uid()
  or exists (select 1 from courts c join complexes cx on cx.id = c.complex_id
             where c.id = court_id and cx.owner_id = auth.uid())
);

create index if not exists idx_waitlist_slot on booking_waitlist(court_id, starts_at)
  where fulfilled_at is null;

-- 2) Reglas de descuento por baja demanda
-- Configuradas por el complejo. Aplican por día de semana + rango horario.
create table if not exists offpeak_rules (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references complexes(id) on delete cascade,
  name text not null,              -- ej: "Happy hour miércoles"
  weekdays int[] not null,         -- 0=domingo ... 6=sábado
  from_time time not null,         -- ej: '14:00'
  to_time time not null,           -- ej: '17:00'
  discount_pct int not null check (discount_pct between 1 and 90),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table offpeak_rules enable row level security;

drop policy if exists "offpeak read" on offpeak_rules;
create policy "offpeak read" on offpeak_rules for select using (true);

drop policy if exists "offpeak write" on offpeak_rules;
create policy "offpeak write" on offpeak_rules for all
  using (owns_complex(complex_id) or my_role() = 'super_admin')
  with check (owns_complex(complex_id) or my_role() = 'super_admin');

create index if not exists idx_offpeak_complex on offpeak_rules(complex_id, active);
