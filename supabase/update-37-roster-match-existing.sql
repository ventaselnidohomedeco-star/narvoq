-- update-37-roster-match-existing.sql
-- Al importar roster, matchear TAMBIÉN contra jugadores que ya están en NarvoQ.

create or replace function apply_roster_matches_for_complex(p_complex_id uuid)
returns int as $$
declare
  matched_count int := 0;
begin
  -- Matchear todas las entradas del roster (aún no vinculadas) contra profiles existentes
  with matches as (
    select r.id as roster_id, p.id as profile_id
    from club_player_roster r
    join auth.users u on true
    join profiles p on p.id = u.id
    where r.complex_id = p_complex_id
      and r.matched_player_id is null
      and (
        (r.phone is not null and r.phone <> ''
          and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') = regexp_replace(r.phone, '\D', '', 'g'))
        or (r.dni is not null and r.dni <> '' and p.dni = r.dni)
        or (r.email is not null and r.email <> '' and lower(coalesce(u.email, '')) = lower(r.email))
      )
  )
  update club_player_roster r
  set matched_player_id = m.profile_id, matched_at = now()
  from matches m
  where r.id = m.roster_id;

  get diagnostics matched_count = row_count;

  -- Además, actualizar categoría de cada profile matcheado con la mejor (mínima) del roster
  update profiles p
  set category = sub.best
  from (
    select matched_player_id as pid, min(category) as best
    from club_player_roster
    where complex_id = p_complex_id
      and matched_player_id is not null
      and category is not null
    group by matched_player_id
  ) sub
  where p.id = sub.pid;

  return matched_count;
end;
$$ language plpgsql security definer;
grant execute on function apply_roster_matches_for_complex(uuid) to authenticated;

notify pgrst, 'reload schema';
