-- update-59-follows-notif.sql
-- Notif cuando alguien empieza a seguirte + al jugador cuando le confirman reserva.

-- ============ FOLLOWS ============
create or replace function notify_follow()
returns trigger as $$
declare
  follower_name text;
begin
  select coalesce(first_name || ' ' || last_name, username, 'Alguien')
    into follower_name from profiles where id = new.follower_id;
  insert into notifications (user_id, kind, title, body, link)
  values (
    new.followed_id,
    'follow',
    follower_name || ' empezó a seguirte 👥',
    'Ahora ven tus publicaciones en el feed',
    '/u/' || (select username from profiles where id = new.follower_id)
  );
  return new;
exception when others then
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_follow_notif on follows;
create trigger trg_follow_notif
  after insert on follows
  for each row execute function notify_follow();

-- ============ RESERVAS: al jugador cuando el complejo la confirma ============
create or replace function notify_booking_confirmed()
returns trigger as $$
declare
  complex_name text;
  court_name text;
begin
  -- Solo notificamos cuando cambia a 'confirmada' desde otro estado
  if new.status <> 'confirmada' or old.status = 'confirmada' then
    return new;
  end if;
  if new.player_id is null then return new; end if;

  select cx.name, c.name into complex_name, court_name
  from courts c join complexes cx on cx.id = c.complex_id
  where c.id = new.court_id;

  insert into notifications (user_id, kind, title, body, link)
  values (
    new.player_id,
    'booking_confirmed',
    '✅ Reserva confirmada en ' || coalesce(complex_name, 'el complejo'),
    coalesce(court_name, 'Cancha') || ' · ' ||
      to_char(new.starts_at at time zone 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI') || ' hs',
    '/jugador/reservas'
  );
  return new;
exception when others then
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_booking_confirmed_notif on bookings;
create trigger trg_booking_confirmed_notif
  after update of status on bookings
  for each row execute function notify_booking_confirmed();

-- ============ RESERVAS: al complejo cuando se crea una nueva pendiente ============
create or replace function notify_new_booking_to_complex()
returns trigger as $$
declare
  complex_owner uuid;
  player_name text;
begin
  if new.type <> 'reserva' or new.player_id is null then return new; end if;

  select cx.owner_id into complex_owner
  from courts c join complexes cx on cx.id = c.complex_id
  where c.id = new.court_id;

  if complex_owner is null then return new; end if;

  select coalesce(first_name || ' ' || last_name, username, 'Un jugador')
    into player_name from profiles where id = new.player_id;

  insert into notifications (user_id, kind, title, body, link)
  values (
    complex_owner,
    'booking_new',
    '📅 Nueva reserva de ' || player_name,
    to_char(new.starts_at at time zone 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI') || ' hs',
    '/complejo/dashboard'
  );
  return new;
exception when others then
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_new_booking_notif on bookings;
create trigger trg_new_booking_notif
  after insert on bookings
  for each row execute function notify_new_booking_to_complex();

notify pgrst, 'reload schema';
