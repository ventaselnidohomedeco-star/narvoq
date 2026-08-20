-- update-35-club-roster.sql
-- Roster de jugadores del complejo importados por Excel/CSV.
-- Permite cargar puntaje y categoría de gente que todavía no está en NarvoQ.
-- Cuando el jugador se registra, matcheamos por DNI/celu/email y le aplicamos su categoría/puntos.

create table if not exists club_player_roster (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references complexes(id) on delete cascade,
  first_name text not null,
  last_name text,
  phone text,             -- normalizado sin espacios ni guiones
  dni text,
  email text,             -- lowercase
  category int check (category between 1 and 8),
  points numeric default 0,
  notes text,
  matched_player_id uuid references profiles(id) on delete set null,
  matched_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

comment on table club_player_roster is
  'Jugadores importados por el complejo (Excel/CSV). Cuando se registran en NarvoQ, matchean por DNI/celu/email.';

create index if not exists idx_roster_complex on club_player_roster (complex_id);
create index if not exists idx_roster_phone on club_player_roster (phone) where phone is not null;
create index if not exists idx_roster_dni on club_player_roster (dni) where dni is not null;
create index if not exists idx_roster_email on club_player_roster (email) where email is not null;

alter table club_player_roster enable row level security;
drop policy if exists roster_owner_all on club_player_roster;
create policy roster_owner_all on club_player_roster
  for all using (
    exists (select 1 from complexes c where c.id = complex_id and c.owner_id = auth.uid())
  ) with check (
    exists (select 1 from complexes c where c.id = complex_id and c.owner_id = auth.uid())
  );

-- Función: matchear un roster entry con un profile existente y aplicar categoría
create or replace function apply_roster_to_profile(p_profile_id uuid)
returns int as $$
declare
  matched_count int := 0;
  prof_phone text;
  prof_dni text;
  prof_email text;
  best_category int;
begin
  select
    regexp_replace(p.phone, '\D', '', 'g'),
    p.dni,
    lower(u.email)
  into prof_phone, prof_dni, prof_email
  from profiles p
  join auth.users u on u.id = p.id
  where p.id = p_profile_id;

  -- Marcar como matched todos los roster que coincidan por al menos un dato
  update club_player_roster r
  set matched_player_id = p_profile_id, matched_at = now()
  where matched_player_id is null
    and (
      (prof_phone is not null and prof_phone <> '' and regexp_replace(coalesce(r.phone,''), '\D', '', 'g') = prof_phone)
      or (prof_dni is not null and prof_dni <> '' and r.dni = prof_dni)
      or (prof_email is not null and prof_email <> '' and lower(coalesce(r.email,'')) = prof_email)
    );
  get diagnostics matched_count = row_count;

  -- Si tiene categoría en algún roster, usar la más baja (mejor jugador)
  select min(category) into best_category
  from club_player_roster
  where matched_player_id = p_profile_id and category is not null;

  if best_category is not null then
    update profiles set category = best_category where id = p_profile_id;
  end if;

  return matched_count;
end;
$$ language plpgsql security definer;
grant execute on function apply_roster_to_profile(uuid) to authenticated;

-- Añadir dni al profile si no existe
alter table profiles add column if not exists dni text;

notify pgrst, 'reload schema';
