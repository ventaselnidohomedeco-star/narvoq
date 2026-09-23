-- Fix del trigger de guest booking + lista de espera para invitados

-- ============================================================
-- 1) FIX del trigger anterior: notifications.ref_id es uuid, no text
-- ============================================================
create or replace function notify_owner_of_guest_booking()
returns trigger language plpgsql security definer as $$
declare
  v_owner uuid;
  v_complex_name text;
  v_court_name text;
begin
  if new.player_id is not null then return new; end if;

  select cx.owner_id, cx.name, ct.name
    into v_owner, v_complex_name, v_court_name
    from courts ct join complexes cx on cx.id = ct.complex_id
    where ct.id = new.court_id;

  if v_owner is null then return new; end if;

  insert into notifications (user_id, kind, title, body, link, ref_id)
  values (
    v_owner,
    'booking_new',
    '📅 Nueva reserva (link público)',
    coalesce(new.guest_name, 'Invitado') || ' · ' || v_court_name ||
      ' · ' || to_char(new.starts_at at time zone 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI') || ' hs' ||
      ' · Tel: ' || coalesce(new.guest_phone, ''),
    '/complejo/calendario',
    new.id  -- uuid directo
  );
  return new;
end $$;

-- ============================================================
-- 2) LISTA DE ESPERA por slot (funciona para invitados Y registrados)
-- ============================================================
create table if not exists slot_waitlist (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references courts(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- Uno de los dos:
  player_id uuid references profiles(id) on delete cascade,
  guest_name text,
  guest_phone text,
  -- Estado
  notified_at timestamptz,           -- cuándo se le avisó que se liberó
  converted_booking_id uuid references bookings(id) on delete set null,  -- si se le asignó una reserva
  created_at timestamptz not null default now(),
  constraint has_identity check (
    player_id is not null
    or (guest_name is not null and guest_phone is not null)
  )
);

create index if not exists idx_slot_waitlist_court_time on slot_waitlist(court_id, starts_at);
create index if not exists idx_slot_waitlist_guest_phone on slot_waitlist(guest_phone) where guest_phone is not null;

alter table slot_waitlist enable row level security;

-- Cualquiera puede leer (para ver cuántos están anotados)
drop policy if exists "slot_waitlist read" on slot_waitlist;
create policy "slot_waitlist read" on slot_waitlist for select using (true);

-- Invitados: INSERT sin auth si tienen guest_name + guest_phone
drop policy if exists "slot_waitlist insert guest" on slot_waitlist;
create policy "slot_waitlist insert guest" on slot_waitlist for insert with check (
  (player_id is null and guest_name is not null and length(trim(guest_name)) >= 3
   and guest_phone is not null and length(regexp_replace(guest_phone, '\D', '', 'g')) >= 8)
  or player_id = auth.uid()
);

-- Delete: propio (guest lo hace por otro flow, aquí solo owner del complejo o el propio player)
drop policy if exists "slot_waitlist delete owner" on slot_waitlist;
create policy "slot_waitlist delete owner" on slot_waitlist for delete using (
  player_id = auth.uid()
  or exists (
    select 1 from courts ct
    join complexes cx on cx.id = ct.complex_id
    where ct.id = slot_waitlist.court_id and cx.owner_id = auth.uid()
  )
);

-- Update (marcar notified_at, converted_booking_id): solo owner del complejo
drop policy if exists "slot_waitlist update owner" on slot_waitlist;
create policy "slot_waitlist update owner" on slot_waitlist for update using (
  exists (
    select 1 from courts ct
    join complexes cx on cx.id = ct.complex_id
    where ct.id = slot_waitlist.court_id and cx.owner_id = auth.uid()
  )
);

-- Notif al dueño del complejo cuando alguien se anota en la lista de espera
create or replace function notify_owner_of_waitlist_join()
returns trigger language plpgsql security definer as $$
declare
  v_owner uuid;
  v_complex_name text;
  v_court_name text;
  v_who text;
begin
  select cx.owner_id, cx.name, ct.name
    into v_owner, v_complex_name, v_court_name
    from courts ct join complexes cx on cx.id = ct.complex_id
    where ct.id = new.court_id;

  if v_owner is null then return new; end if;

  if new.player_id is null then
    v_who := coalesce(new.guest_name, 'Invitado') || ' (Tel: ' || coalesce(new.guest_phone, '') || ')';
  else
    select coalesce(first_name || ' ' || last_name, username, 'Jugador')
      into v_who from profiles where id = new.player_id;
  end if;

  insert into notifications (user_id, kind, title, body, link, ref_id)
  values (
    v_owner,
    'waitlist_available',
    '🕐 Anotado en lista de espera',
    v_who || ' se anotó para ' || v_court_name ||
      ' el ' || to_char(new.starts_at at time zone 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI') || ' hs',
    '/complejo/calendario',
    new.id
  );
  return new;
end $$;

drop trigger if exists trg_notify_owner_waitlist_join on slot_waitlist;
create trigger trg_notify_owner_waitlist_join
after insert on slot_waitlist
for each row execute procedure notify_owner_of_waitlist_join();

notify pgrst, 'reload schema';
