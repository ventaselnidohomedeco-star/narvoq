-- update-44-waitlist-notif.sql
-- Cuando un jugador se anota en booking_waitlist, notificar al complejo.

create or replace function notify_complex_on_waitlist_join()
returns trigger as $$
declare
  owner_id uuid;
  court_name text;
  player_name text;
  msg text;
begin
  select cx.owner_id, c.name
    into owner_id, court_name
    from courts c join complexes cx on cx.id = c.complex_id
    where c.id = new.court_id;

  if owner_id is null then return new; end if;

  select coalesce(first_name || ' ' || coalesce(last_name, ''), username, 'Alguien')
    into player_name
    from profiles where id = new.player_id;

  msg := trim(coalesce(player_name, 'Un jugador')) ||
    ' se anotó en lista de espera para ' || coalesce(court_name, 'una cancha') ||
    ' el ' || to_char(new.starts_at at time zone 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI') ||
    ' hs.';

  insert into notifications (user_id, kind, title, body, link)
  values (owner_id, 'mencion', '⏳ Nuevo en lista de espera', msg, '/complejo/calendario');

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notif_waitlist on booking_waitlist;
create trigger trg_notif_waitlist
  after insert on booking_waitlist
  for each row execute function notify_complex_on_waitlist_join();

notify pgrst, 'reload schema';
