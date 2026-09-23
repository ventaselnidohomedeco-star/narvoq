-- Fase 1: Reservas públicas por link (sin cuenta, sin descargar app)
-- El complejo comparte narvoq.com.ar/r/<slug> y el jugador reserva con nombre+celu

-- 1) Slug único por complejo (para el link corto)
alter table complexes add column if not exists slug text unique;

-- Requiere unaccent (viene con Supabase)
create extension if not exists unaccent;

-- 2) Función para slugificar nombre (quita acentos, espacios, símbolos)
create or replace function slugify(txt text) returns text
language sql stable as $$
  select regexp_replace(
    regexp_replace(
      lower(unaccent(coalesce(txt, ''))),
      '[^a-z0-9]+', '-', 'g'
    ),
    '(^-+|-+$)', '', 'g'
  );
$$;

-- 3) Backfill: generar slug único para complejos existentes que no tengan
do $$
declare
  c record;
  base_slug text;
  final_slug text;
  n int;
begin
  for c in select id, name from complexes where slug is null loop
    base_slug := slugify(c.name);
    if base_slug = '' then base_slug := 'complejo'; end if;
    final_slug := base_slug;
    n := 1;
    while exists(select 1 from complexes where slug = final_slug) loop
      n := n + 1;
      final_slug := base_slug || '-' || n;
    end loop;
    update complexes set slug = final_slug where id = c.id;
  end loop;
end $$;

-- 4) Trigger para autogenerar slug al insertar un complejo nuevo
create or replace function complexes_set_slug()
returns trigger language plpgsql as $$
declare
  base_slug text;
  final_slug text;
  n int;
begin
  if new.slug is null or new.slug = '' then
    base_slug := slugify(new.name);
    if base_slug = '' then base_slug := 'complejo'; end if;
    final_slug := base_slug;
    n := 1;
    while exists(select 1 from complexes where slug = final_slug and id <> new.id) loop
      n := n + 1;
      final_slug := base_slug || '-' || n;
    end loop;
    new.slug := final_slug;
  end if;
  return new;
end $$;

drop trigger if exists trg_complexes_set_slug on complexes;
create trigger trg_complexes_set_slug
before insert on complexes
for each row execute procedure complexes_set_slug();

-- 5) RLS: permitir INSERT anónimo de bookings SOLO como guest
-- (player_id null + guest_name + guest_phone obligatorios, sin dueño)
create policy "booking insert guest" on bookings for insert with check (
  type = 'reserva'
  and player_id is null
  and guest_name is not null and length(trim(guest_name)) >= 3
  and guest_phone is not null and length(regexp_replace(guest_phone, '\D', '', 'g')) >= 8
  and status = 'pendiente'
);

-- 6) Sin límite de reservas por teléfono (el complejo cancela manual si detecta abuso)

-- 7) Cuando se crea reserva de guest → notif in-app al dueño del complejo
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
    new.id::text
  );
  return new;
end $$;

drop trigger if exists trg_notify_owner_guest_booking on bookings;
create trigger trg_notify_owner_guest_booking
after insert on bookings
for each row execute procedure notify_owner_of_guest_booking();

notify pgrst, 'reload schema';
