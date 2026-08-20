-- update-33-player-ledger.sql
-- Estado de cuenta del jugador por complejo.
-- Cada entrada es un movimiento: seña, cobro de cancha, reembolso, ajuste manual.
-- Un balance > 0 = el complejo le debe al jugador (favor).
-- Un balance < 0 = el jugador le debe al complejo (deuda).

create table if not exists player_ledger (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references profiles(id) on delete cascade,
  complex_id uuid not null references complexes(id) on delete cascade,
  kind text not null check (kind in (
    'seña_paid',       -- jugador pagó la seña de una reserva
    'restante_paid',   -- jugador pagó el restante al jugar
    'refund',          -- reembolso al jugador (reserva cancelada por complejo, etc)
    'used_credit',     -- se usó su saldo a favor para pagar algo
    'manual_credit',   -- ajuste manual del complejo (le suma al jugador)
    'manual_debit'     -- ajuste manual del complejo (le resta al jugador)
  )),
  amount numeric not null,   -- positivo = suma al saldo del jugador. negativo = resta.
  method text check (method in ('efectivo', 'transferencia', 'mp', 'saldo_favor', 'otro')),
  description text,
  ref_booking_id uuid references bookings(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

comment on table player_ledger is
  'Movimientos de cuenta corriente del jugador con cada complejo. Suma de amount = saldo actual.';
comment on column player_ledger.amount is
  'Positivo = suma al saldo del jugador (crédito). Negativo = resta (débito).';

create index if not exists idx_ledger_player_complex on player_ledger (player_id, complex_id);
create index if not exists idx_ledger_complex_created on player_ledger (complex_id, created_at desc);
create index if not exists idx_ledger_method_created on player_ledger (method, created_at desc)
  where method in ('efectivo', 'transferencia');

-- Función: balance actual de un jugador en un complejo
create or replace function get_player_balance(p_player_id uuid, p_complex_id uuid)
returns numeric as $$
  select coalesce(sum(amount), 0)::numeric
  from player_ledger
  where player_id = p_player_id and complex_id = p_complex_id;
$$ language sql stable security definer;
grant execute on function get_player_balance(uuid, uuid) to authenticated;

-- Función: totales cobrados por método en un rango
create or replace function get_complex_income_by_method(
  p_complex_id uuid, p_from timestamptz, p_to timestamptz
)
returns table(method text, total numeric, count int) as $$
  select method, sum(amount)::numeric as total, count(*)::int as count
  from player_ledger
  where complex_id = p_complex_id
    and method in ('efectivo', 'transferencia', 'mp')
    and kind in ('seña_paid', 'restante_paid')
    and created_at >= p_from and created_at < p_to
  group by method;
$$ language sql stable security definer;
grant execute on function get_complex_income_by_method(uuid, timestamptz, timestamptz) to authenticated;

-- RLS: complex owner ve/edita todo lo de su complejo. Jugador ve sus propios movimientos.
alter table player_ledger enable row level security;

drop policy if exists ledger_complex_owner_all on player_ledger;
create policy ledger_complex_owner_all on player_ledger
  for all using (
    exists (select 1 from complexes c where c.id = complex_id and c.owner_id = auth.uid())
  ) with check (
    exists (select 1 from complexes c where c.id = complex_id and c.owner_id = auth.uid())
  );

drop policy if exists ledger_player_own_select on player_ledger;
create policy ledger_player_own_select on player_ledger
  for select using (player_id = auth.uid());

-- Seña editable por cancha (default toma el precio total si no se define)
alter table courts add column if not exists deposit_amount numeric;
comment on column courts.deposit_amount is
  'Monto de la seña para reservar. Si es NULL, se cobra el precio completo como seña.';

notify pgrst, 'reload schema';
