-- ============================================================
-- Actualización 14 — Smashe@ chat 24hs
-- Chat efímero: mensajes de texto/imagen/video, expiran en 24hs.
-- Ejecutar UNA VEZ en el SQL Editor de Supabase (idempotente).
-- ============================================================

-- 1) Chats 1:1 entre dos usuarios (siempre user_a < user_b para unicidad)
create table if not exists chats (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references profiles(id) on delete cascade,
  user_b uuid not null references profiles(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a < user_b)
);
alter table chats enable row level security;

drop policy if exists "chats read own" on chats;
create policy "chats read own" on chats for select
  using (user_a = auth.uid() or user_b = auth.uid());

drop policy if exists "chats insert own" on chats;
create policy "chats insert own" on chats for insert
  with check (user_a = auth.uid() or user_b = auth.uid());

drop policy if exists "chats update own" on chats;
create policy "chats update own" on chats for update
  using (user_a = auth.uid() or user_b = auth.uid());

-- 2) Mensajes con expiración a las 24 horas
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references chats(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  text_content text,
  image_url text,
  video_url text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
alter table messages enable row level security;

-- Solo se ven mensajes NO expirados de mis chats
drop policy if exists "messages read fresh in own chat" on messages;
create policy "messages read fresh in own chat" on messages for select
  using (
    expires_at > now()
    and exists (select 1 from chats c
                where c.id = chat_id and (c.user_a = auth.uid() or c.user_b = auth.uid()))
  );

drop policy if exists "messages insert own in own chat" on messages;
create policy "messages insert own in own chat" on messages for insert
  with check (
    sender_id = auth.uid()
    and exists (select 1 from chats c
                where c.id = chat_id and (c.user_a = auth.uid() or c.user_b = auth.uid()))
  );

-- Cualquier usuario autenticado puede borrar mensajes expirados
-- (limpieza colaborativa); además el sender puede borrar los suyos.
drop policy if exists "messages delete expired or own" on messages;
create policy "messages delete expired or own" on messages for delete
  using (expires_at <= now() or sender_id = auth.uid());

create index if not exists idx_messages_chat_expires
  on messages(chat_id, expires_at desc);

-- 3) Habilitar Realtime para que la app reciba mensajes en tiempo real.
-- (En Supabase, esto tambien se puede hacer desde Database → Replication.)
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table chats;

-- 4) Función helper para abrir/reusar un chat entre dos usuarios cualquiera.
create or replace function open_chat_with(other_id uuid) returns uuid
language plpgsql security definer as $$
declare
  a uuid; b uuid; cid uuid;
begin
  if other_id = auth.uid() then
    raise exception 'No podés chatear con vos mismo';
  end if;
  if auth.uid() < other_id then a := auth.uid(); b := other_id;
  else a := other_id; b := auth.uid();
  end if;
  select id into cid from chats where user_a = a and user_b = b;
  if cid is null then
    insert into chats (user_a, user_b) values (a, b) returning id into cid;
  end if;
  return cid;
end $$;
