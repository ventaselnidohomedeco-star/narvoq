-- update-38-roster-notif.sql
-- Cuando un complejo VINCULA (o REVINCULA) a un jugador en su roster,
-- le llega una notificación con la categoría y puntos asignados.

create or replace function notify_roster_match()
returns trigger as $$
declare
  cx_name text;
  msg text;
begin
  -- Solo dispara cuando pasa de sin-match a con-match
  if new.matched_player_id is null then return new; end if;
  if tg_op = 'UPDATE' and old.matched_player_id = new.matched_player_id then return new; end if;

  select name into cx_name from complexes where id = new.complex_id;

  msg := coalesce(cx_name, 'Un complejo') || ' te agregó a su base de jugadores';
  if new.category is not null then
    msg := msg || ' · Categoría ' || new.category;
  end if;
  if new.points is not null and new.points > 0 then
    msg := msg || ' · ' || new.points || ' pts';
  end if;

  insert into notifications (user_id, kind, title, body, link, ref_id)
  values (
    new.matched_player_id,
    'roster_add',
    '🎾 Te agregaron a un club',
    msg,
    '/jugador/perfil',
    new.id::text
  )
  on conflict do nothing;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_roster_match on club_player_roster;
create trigger trg_notify_roster_match
  after insert or update on club_player_roster
  for each row execute function notify_roster_match();

notify pgrst, 'reload schema';
