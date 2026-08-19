-- update-32-booking-ttl.sql
-- Fase 1: TTL de reservas.
-- Si el jugador no sube comprobante en X horas, la reserva se cancela sola.

-- 1) Config en complejos: horas para subir comprobante (default 2h)
alter table complexes add column if not exists booking_payment_timeout_hours integer not null default 2
  check (booking_payment_timeout_hours between 1 and 72);

comment on column complexes.booking_payment_timeout_hours is
  'Horas que tiene el jugador para subir el comprobante de pago. Vencido, la reserva se auto-cancela.';

-- 2) Deadline por reserva
alter table bookings add column if not exists payment_deadline_at timestamptz;

comment on column bookings.payment_deadline_at is
  'Momento límite para subir el comprobante. Si pasa y payment_status sigue pendiente, la reserva se cancela.';

-- 3) Índice para el cleanup
create index if not exists idx_bookings_deadline_pending
  on bookings (payment_deadline_at)
  where status = 'pendiente' and payment_status = 'pendiente';

-- 4) Función para auto-cancelar reservas vencidas.
-- Devuelve la lista de (booking_id, player_id, court_id, starts_at) canceladas
-- para que el cliente pueda enviar notificaciones. Usa security definer para
-- que la pueda llamar cualquier complex_admin autenticado (o un cron).
create or replace function cancel_expired_bookings()
returns table(booking_id uuid, player_id uuid, court_id uuid, starts_at timestamptz, complex_id uuid) as $$
begin
  return query
  with expired as (
    select b.id, b.player_id, b.court_id, b.starts_at, c.complex_id
    from bookings b
    join courts c on c.id = b.court_id
    where b.status = 'pendiente'
      and b.payment_status = 'pendiente'
      and b.payment_deadline_at is not null
      and b.payment_deadline_at < now()
      and b.starts_at > now() - interval '1 day'
  ),
  updated as (
    update bookings set status = 'cancelada'
    where id in (select id from expired)
    returning id
  )
  select e.id, e.player_id, e.court_id, e.starts_at, e.complex_id
  from expired e;
end;
$$ language plpgsql security definer;

grant execute on function cancel_expired_bookings() to authenticated;

notify pgrst, 'reload schema';
