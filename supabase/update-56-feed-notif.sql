-- update-56-feed-notif.sql
-- Notificaciones al autor del post cuando alguien le da like o comenta.
-- IMPORTANTE: no notificamos posts nuevos del feed (evitar spam) — solo
-- interacciones sobre TUS posts.

-- ============ LIKES ============
create or replace function notify_post_like()
returns trigger as $$
declare
  post_author uuid;
  liker_name text;
begin
  select author_profile_id into post_author from posts where id = new.post_id;
  if post_author is null or post_author = new.player_id then
    return new;   -- posts de complejo (sin author_profile_id) o self-like: no notificamos
  end if;
  select coalesce(first_name || ' ' || last_name, username, 'Alguien')
    into liker_name from profiles where id = new.player_id;
  insert into notifications (user_id, kind, title, body, link)
  values (
    post_author,
    'post_like',
    'A ' || liker_name || ' le gustó tu publicación ❤️',
    'Tocá para ver tu post',
    '/jugador/feed'
  );
  return new;
exception when others then
  return new;   -- no romper el insert si notif falla
end;
$$ language plpgsql security definer;

drop trigger if exists trg_post_like_notif on post_likes;
create trigger trg_post_like_notif
  after insert on post_likes
  for each row execute function notify_post_like();

-- ============ COMENTARIOS ============
create or replace function notify_post_comment()
returns trigger as $$
declare
  post_author uuid;
  commenter_name text;
  preview text;
begin
  select author_profile_id into post_author from posts where id = new.post_id;
  if post_author is null or post_author = new.player_id then
    return new;
  end if;
  select coalesce(first_name || ' ' || last_name, username, 'Alguien')
    into commenter_name from profiles where id = new.player_id;
  preview := substring(new.text_content from 1 for 80);
  insert into notifications (user_id, kind, title, body, link)
  values (
    post_author,
    'post_comment',
    commenter_name || ' comentó tu publicación 💬',
    preview,
    '/jugador/feed'
  );

  -- También notificar a otros que comentaron el post (thread activity)
  insert into notifications (user_id, kind, title, body, link)
  select distinct pc.player_id, 'post_comment_thread',
    commenter_name || ' también comentó',
    preview,
    '/jugador/feed'
  from post_comments pc
  where pc.post_id = new.post_id
    and pc.player_id <> new.player_id
    and pc.player_id <> post_author;

  return new;
exception when others then
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_post_comment_notif on post_comments;
create trigger trg_post_comment_notif
  after insert on post_comments
  for each row execute function notify_post_comment();

notify pgrst, 'reload schema';
