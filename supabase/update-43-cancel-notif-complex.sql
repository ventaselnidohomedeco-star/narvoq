-- update-43-cancel-notif-complex.sql
-- Cuando un jugador cancela su reserva, notificar al dueño del complejo
-- para que revise la lista de espera.

create or replace function notify_complex_on_cancel()
returns trigger as $$
declare
  owner_id uuid;
  cx_name text;
  court_name text;
  starts timestamptz;
  waitlist_count int;
  msg text;
begin
  -- Solo cuando pasa de otro estado a 'cancelada'
  if new.status <> 'cancelada' or old.status = 'cancelada' then return new; end if;
  -- Solo reservas (no bloqueos)
  if new.type <> 'reserva' then return new; end if;
  -- Solo si el actor fue el jugador (no el complejo — el complejo ya ve su propio modal)
  if auth.uid() = new.player_id then
    -- OK, el jugador se autocanceló
    null;
  else
    return new;
  end if;

  select cx.owner_id, cx.name, c.name, new.starts_at
    into owner_id, cx_name, court_name, starts
    from courts c join complexes cx on cx.id = c.complex_id
    where c.id = new.court_id;

  if owner_id is null then return new; end if;

  -- Cuántos hay en waitlist para ese slot
  select count(*) into waitlist_count
  from booking_waitlist
  where court_id = new.court_id
    and starts_at = new.starts_at
    and fulfilled_at is null;

  msg := 'Un jugador canceló su reserva en ' || coalesce(court_name, 'una cancha')
    || ' el ' || to_char(starts at time zone 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI') || ' hs.'
    || case when waitlist_count > 0
        then ' Tenés ' || waitlist_count || ' en lista de espera — contactalos!'
        else ' Turno liberado.' end;

  insert into notifications (user_id, kind, title, body, link)
  values (owner_id, 'mencion', '❌ Reserva cancelada', msg, '/complejo/calendario');

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notif_complex_cancel on bookings;
create trigger trg_notif_complex_cancel
  after update of status on bookings
  for each row execute function notify_complex_on_cancel();

notify pgrst, 'reload schema';
