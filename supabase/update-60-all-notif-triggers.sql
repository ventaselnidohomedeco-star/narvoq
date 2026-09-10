-- update-60-all-notif-triggers.sql
-- Migración consolidada: TODOS los triggers de notif que la app necesita.
-- Idempotente — se puede correr varias veces sin problema.

-- =====================================================
-- 1. CHAT SMASHE@ (mensaje entrante)
-- =====================================================
create or replace function notify_new_chat_message()
returns trigger as $$
declare
  chat_row chats%rowtype; target uuid; sender_name text; preview text;
begin
  select * into chat_row from chats where id = new.chat_id;
  if chat_row.id is null then return new; end if;
  target := case when chat_row.user_a = new.sender_id then chat_row.user_b else chat_row.user_a end;
  if target = new.sender_id then return new; end if;
  select coalesce(first_name || ' ' || coalesce(last_name, ''), username, 'Alguien')
    into sender_name from profiles where id = new.sender_id;
  preview := coalesce(nullif(new.text_content, ''), '📷 Foto');
  if length(preview) > 80 then preview := substring(preview, 1, 77) || '…'; end if;
  insert into notifications (user_id, kind, title, body, link, ref_id)
  values (target, 'chat', '💬 ' || trim(sender_name), preview, '/smash/' || new.chat_id, new.chat_id::text);
  return new;
exception when others then return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notif_chat on messages;
create trigger trg_notif_chat after insert on messages
  for each row execute function notify_new_chat_message();

-- =====================================================
-- 2. LIKES en el feed
-- =====================================================
create or replace function notify_post_like()
returns trigger as $$
declare post_author uuid; liker_name text;
begin
  select author_profile_id into post_author from posts where id = new.post_id;
  if post_author is null or post_author = new.player_id then return new; end if;
  select coalesce(first_name || ' ' || last_name, username, 'Alguien')
    into liker_name from profiles where id = new.player_id;
  insert into notifications (user_id, kind, title, body, link)
  values (post_author, 'post_like', 'A ' || liker_name || ' le gustó tu publicación ❤️',
    'Tocá para ver tu post', '/jugador/feed');
  return new;
exception when others then return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_post_like_notif on post_likes;
create trigger trg_post_like_notif after insert on post_likes
  for each row execute function notify_post_like();

-- =====================================================
-- 3. COMENTARIOS en el feed
-- =====================================================
create or replace function notify_post_comment()
returns trigger as $$
declare post_author uuid; commenter_name text; preview text;
begin
  select author_profile_id into post_author from posts where id = new.post_id;
  if post_author is null or post_author = new.player_id then return new; end if;
  select coalesce(first_name || ' ' || last_name, username, 'Alguien')
    into commenter_name from profiles where id = new.player_id;
  preview := substring(new.text_content from 1 for 80);
  insert into notifications (user_id, kind, title, body, link)
  values (post_author, 'post_comment', commenter_name || ' comentó tu publicación 💬',
    preview, '/jugador/feed');
  -- thread: otros que comentaron
  insert into notifications (user_id, kind, title, body, link)
  select distinct pc.player_id, 'post_comment_thread',
    commenter_name || ' también comentó', preview, '/jugador/feed'
  from post_comments pc
  where pc.post_id = new.post_id
    and pc.player_id <> new.player_id and pc.player_id <> post_author;
  return new;
exception when others then return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_post_comment_notif on post_comments;
create trigger trg_post_comment_notif after insert on post_comments
  for each row execute function notify_post_comment();

-- =====================================================
-- 4. FOLLOWS (alguien empezó a seguirte)
-- =====================================================
create or replace function notify_follow()
returns trigger as $$
declare follower_name text; follower_user text;
begin
  select coalesce(first_name || ' ' || last_name, username, 'Alguien'), username
    into follower_name, follower_user from profiles where id = new.follower_id;
  insert into notifications (user_id, kind, title, body, link)
  values (new.followed_id, 'follow', follower_name || ' empezó a seguirte 👥',
    'Ahora ven tus publicaciones', '/u/' || coalesce(follower_user, ''));
  return new;
exception when others then return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_follow_notif on follows;
create trigger trg_follow_notif after insert on follows
  for each row execute function notify_follow();

-- =====================================================
-- 5. RESERVA CONFIRMADA por el complejo (al jugador)
-- =====================================================
create or replace function notify_booking_confirmed()
returns trigger as $$
declare complex_name text; court_name text;
begin
  if new.status <> 'confirmada' or old.status = 'confirmada' then return new; end if;
  if new.player_id is null then return new; end if;
  select cx.name, c.name into complex_name, court_name
    from courts c join complexes cx on cx.id = c.complex_id where c.id = new.court_id;
  insert into notifications (user_id, kind, title, body, link)
  values (new.player_id, 'booking_confirmed',
    '✅ Reserva confirmada en ' || coalesce(complex_name, 'el complejo'),
    coalesce(court_name, 'Cancha') || ' · ' ||
      to_char(new.starts_at at time zone 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI') || ' hs',
    '/jugador/reservas');
  return new;
exception when others then return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_booking_confirmed_notif on bookings;
create trigger trg_booking_confirmed_notif after update of status on bookings
  for each row execute function notify_booking_confirmed();

-- =====================================================
-- 6. NUEVA RESERVA (al complejo)
-- =====================================================
create or replace function notify_new_booking_to_complex()
returns trigger as $$
declare complex_owner uuid; player_name text;
begin
  if new.type <> 'reserva' or new.player_id is null then return new; end if;
  select cx.owner_id into complex_owner
    from courts c join complexes cx on cx.id = c.complex_id where c.id = new.court_id;
  if complex_owner is null then return new; end if;
  select coalesce(first_name || ' ' || last_name, username, 'Un jugador')
    into player_name from profiles where id = new.player_id;
  insert into notifications (user_id, kind, title, body, link)
  values (complex_owner, 'booking_new',
    '📅 Nueva reserva de ' || player_name,
    to_char(new.starts_at at time zone 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI') || ' hs',
    '/complejo/dashboard');
  return new;
exception when others then return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_new_booking_notif on bookings;
create trigger trg_new_booking_notif after insert on bookings
  for each row execute function notify_new_booking_to_complex();

-- =====================================================
-- 7. INVITACIÓN a un partido (te sumaron)
-- =====================================================
create or replace function notify_match_invite()
returns trigger as $$
declare inviter_name text;
begin
  -- Solo notif si te agregaron a un match ya creado (no auto-add)
  if new.player_id is null then return new; end if;
  insert into notifications (user_id, kind, title, body, link)
  values (new.player_id, 'match_invite',
    '🎾 Te sumaron a un partido',
    'Confirmá tu presencia',
    '/partido/' || new.match_id);
  return new;
exception when others then return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_match_invite_notif on match_players;
create trigger trg_match_invite_notif after insert on match_players
  for each row execute function notify_match_invite();

-- =====================================================
-- 8. TORNEO NUEVO — a los seguidores del organizador o del complejo
-- =====================================================
create or replace function notify_new_tournament()
returns trigger as $$
declare organizer_id uuid; organizer_name text;
begin
  -- Solo notificamos cuando el torneo está en estado inscripción
  if new.status <> 'inscripcion' then return new; end if;

  -- Organizador: complex owner o profe
  if new.complex_id is not null then
    select owner_id, name into organizer_id, organizer_name from complexes where id = new.complex_id;
  elsif new.owner_coach_id is not null then
    organizer_id := new.owner_coach_id;
    select coalesce(first_name || ' ' || last_name, username, 'Profe')
      into organizer_name from profiles where id = organizer_id;
  else
    return new;
  end if;
  if organizer_id is null then return new; end if;

  insert into notifications (user_id, kind, title, body, link)
  select f.follower_id, 'tournament_new',
    '🏆 Nuevo torneo en ' || coalesce(organizer_name, 'un complejo'),
    coalesce(new.name, 'Ver detalles'),
    '/torneo/' || new.id
  from follows f where f.followed_id = organizer_id;

  return new;
exception when others then return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_new_tournament_notif on tournaments;
create trigger trg_new_tournament_notif after insert on tournaments
  for each row execute function notify_new_tournament();

-- =====================================================
-- 9. POST del complejo — notif a sus seguidores
-- =====================================================
create or replace function notify_complex_post()
returns trigger as $$
declare complex_name text; complex_owner uuid;
begin
  if new.author_complex_id is null then return new; end if;
  select name, owner_id into complex_name, complex_owner from complexes where id = new.author_complex_id;
  if complex_owner is null then return new; end if;

  -- Emoji según tipo
  insert into notifications (user_id, kind, title, body, link)
  select f.follower_id, 'complex_post',
    case new.kind
      when 'promo' then '🔥 Promo en ' || coalesce(complex_name, 'un complejo')
      when 'evento' then '🎉 Evento en ' || coalesce(complex_name, 'un complejo')
      when 'torneo_abierto' then '🏆 Torneo abierto en ' || coalesce(complex_name, 'un complejo')
      else '📢 ' || coalesce(complex_name, 'Un complejo')
    end,
    substring(coalesce(new.text_content, ''), 1, 100),
    '/jugador/feed'
  from follows f where f.followed_id = complex_owner;

  return new;
exception when others then return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_complex_post_notif on posts;
create trigger trg_complex_post_notif after insert on posts
  for each row execute function notify_complex_post();

notify pgrst, 'reload schema';
