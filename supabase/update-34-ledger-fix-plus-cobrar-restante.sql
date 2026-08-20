-- update-34-ledger-fix-plus-cobrar-restante.sql
-- Fix: separar el monto en efectivo/transferencia (cash flow del complejo)
-- del impacto sobre el saldo del jugador. Antes se mezclaba y quedaba mal.
--
-- Semántica nueva:
--   - amount ALWAYS positivo
--   - kind determina el signo del impacto en el saldo
--   - kind determina si es ingreso al complejo (cobro) o no

-- Reescribir get_player_balance para usar signos según kind
create or replace function get_player_balance(p_player_id uuid, p_complex_id uuid)
returns numeric as $$
  select coalesce(sum(
    case
      when kind in ('refund', 'manual_credit') then amount              -- suma al jugador
      when kind in ('manual_debit', 'used_credit') then -abs(amount)    -- resta al jugador
      else 0  -- seña_paid, restante_paid no afectan saldo (el jugador ya pagó lo que debía)
    end
  ), 0)::numeric
  from player_ledger
  where player_id = p_player_id and complex_id = p_complex_id;
$$ language sql stable security definer;

-- get_complex_income: usa abs(amount) para los ingresos reales
create or replace function get_complex_income_by_method(
  p_complex_id uuid, p_from timestamptz, p_to timestamptz
)
returns table(method text, total numeric, count int) as $$
  select method, sum(abs(amount))::numeric as total, count(*)::int as count
  from player_ledger
  where complex_id = p_complex_id
    and method in ('efectivo', 'transferencia', 'mp')
    and kind in ('seña_paid', 'restante_paid')
    and created_at >= p_from and created_at < p_to
  group by method;
$$ language sql stable security definer;

-- Normalizar entradas viejas: manual_debit con amount negativo → positivo
update player_ledger set amount = abs(amount)
where kind in ('manual_debit', 'used_credit') and amount < 0;

-- seña_paid con amount 0 → recuperar del monto de la reserva referenciada
update player_ledger l
set amount = coalesce(b.price, 0)
from bookings b
where l.ref_booking_id = b.id
  and l.kind = 'seña_paid'
  and l.amount = 0;

-- Función helper: cuánto ya se cobró de una reserva (seña + restantes)
create or replace function get_booking_paid(p_booking_id uuid)
returns numeric as $$
  select coalesce(sum(abs(amount)), 0)::numeric
  from player_ledger
  where ref_booking_id = p_booking_id
    and kind in ('seña_paid', 'restante_paid');
$$ language sql stable security definer;
grant execute on function get_booking_paid(uuid) to authenticated;

notify pgrst, 'reload schema';
