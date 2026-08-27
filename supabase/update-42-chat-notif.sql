-- update-42-chat-notif.sql
-- Trigger: cuando llega un mensaje nuevo en un chat de Smashe@, notificar
-- al OTRO usuario (el que no envió).

create or replace function notify_new_chat_message()
returns trigger as $$
declare
  chat_row chats%rowtype;
  target uuid;
  sender_name text;
  preview text;
begin
  select * into chat_row from chats where id = new.chat_id;
  if chat_row.id is null then return new; end if;

  -- El destinatario es el otro
  target := case when chat_row.user_a = new.sender_id then chat_row.user_b else chat_row.user_a end;
  if target = new.sender_id then return new; end if;  -- por las dudas

  -- Nombre del que envía (para el título)
  select coalesce(first_name || ' ' || coalesce(last_name, ''), username, 'Alguien')
    into sender_name from profiles where id = new.sender_id;

  -- Vista previa del contenido
  preview := coalesce(nullif(new.text_content, ''), '📷 Foto');
  if length(preview) > 80 then preview := substring(preview, 1, 77) || '…'; end if;

  insert into notifications (user_id, kind, title, body, link, ref_id)
  values (
    target,
    'mencion',
    '💬 ' || trim(sender_name),
    preview,
    '/smash/' || new.chat_id,
    new.chat_id::text
  );

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notif_chat on messages;
create trigger trg_notif_chat
  after insert on messages
  for each row execute function notify_new_chat_message();

notify pgrst, 'reload schema';
