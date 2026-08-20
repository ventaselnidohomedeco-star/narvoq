-- update-40-mp-marketplace.sql
-- Marketplace de pagos: cada complejo conecta su MP; NarvoQ puede tomar comisión.

-- 1. Setting global editable desde admin
create table if not exists app_settings (
  key text primary key,
  value_num numeric,
  value_text text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

-- Semilla: comisión marketplace 0% por defecto (editable desde admin)
insert into app_settings (key, value_num) values ('marketplace_fee_pct', 0)
on conflict (key) do nothing;

alter table app_settings enable row level security;
drop policy if exists app_settings_read on app_settings;
create policy app_settings_read on app_settings
  for select using (auth.role() = 'authenticated');
drop policy if exists app_settings_write on app_settings;
create policy app_settings_write on app_settings
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  ) with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- 2. Campos MP en complexes (OAuth marketplace)
alter table complexes add column if not exists mp_user_id text;
alter table complexes add column if not exists mp_access_token text;
alter table complexes add column if not exists mp_refresh_token text;
alter table complexes add column if not exists mp_public_key text;
alter table complexes add column if not exists mp_expires_at timestamptz;
alter table complexes add column if not exists mp_connected_at timestamptz;

-- 3. Registro de pagos MP (para reconciliación)
create table if not exists mp_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete set null,
  complex_id uuid not null references complexes(id) on delete cascade,
  player_id uuid references profiles(id) on delete set null,
  preference_id text,               -- preference de MP
  payment_id text,                  -- id del pago (una vez pagado)
  amount numeric not null,          -- monto que pagó el jugador
  marketplace_fee numeric default 0, -- comisión NarvoQ
  kind text not null,               -- 'seña' | 'total'
  status text not null default 'pending', -- pending | approved | rejected | refunded
  raw_webhook jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_mp_payments_booking on mp_payments (booking_id);
create index if not exists idx_mp_payments_pref on mp_payments (preference_id);
create index if not exists idx_mp_payments_payment on mp_payments (payment_id);

alter table mp_payments enable row level security;
drop policy if exists mp_payments_read on mp_payments;
create policy mp_payments_read on mp_payments
  for select using (
    player_id = auth.uid()
    or exists (select 1 from complexes c where c.id = complex_id and c.owner_id = auth.uid())
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
drop policy if exists mp_payments_insert on mp_payments;
create policy mp_payments_insert on mp_payments
  for insert with check (auth.uid() is not null);

notify pgrst, 'reload schema';
