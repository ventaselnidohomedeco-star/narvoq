-- update-39-match-notif-trigger.sql
-- Notificaciones server-side por trigger cuando alguien es agregado/sacado de un partido.
-- Antes se dependía del cliente (podía fallar y no llegar). Con trigger, siempre llega.

create or replace function notify_match_player_change()
returns trigger as $$
declare
  actor uuid := auth.uid();
  target uuid;
  match_row matches%rowtype;
  cx_name text;
  court_name text;
  starts_at timestamptz;
  msg text;
begin
  if tg_op = 'INSERT' then
    target := new.player_id;
  else
    target := old.player_id;
  end if;

  -- No notificar si el jugador se está sumando/saliendo por sí mismo
  if target = actor then return coalesce(new, old); end if;

  select * into match_row from matches where id = coalesce(new.match_id, old.match_id);
  if match_row.id is null then return coalesce(new, old); end if;

  select c.name, cx.name, b.starts_at
    into court_name, cx_name, starts_at
    from bookings b
    join courts c on c.id = b.court_id
    join complexes cx on cx.id = c.complex_id
    where b.id = match_row.booking_id;

  if tg_op = 'INSERT' then
    msg := coalesce(cx_name, '') || ' · ' || coalesce(court_name, '')
      || ' · ' || to_char(starts_at at time zone 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI')
      || ' hs · Equipo ' || new.team;
    insert into notifications (user_id, kind, title, body, link, ref_id)
    values (target, 'match_add', '🎾 Te sumaron a un partido', msg,
      '/partido/' || match_row.id, match_row.id::text);
  else
    msg := coalesce(cx_name, '') || ' · ' || to_char(starts_at at time zone 'America/Argentina/Buenos_Aires', 'DD/MM');
    insert into notifications (user_id, kind, title, body, link, ref_id)
    values (target, 'match_kick', 'Te sacaron de un partido', msg,
      '/partido/' || match_row.id, match_row.id::text);
  end if;

  return coalesce(new, old);
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_match_player_insert on match_players;
create trigger trg_notify_match_player_insert
  after insert on match_players
  for each row execute function notify_match_player_change();

drop trigger if exists trg_notify_match_player_delete on match_players;
create trigger trg_notify_match_player_delete
  after delete on match_players
  for each row execute function notify_match_player_change();

notify pgrst, 'reload schema';
