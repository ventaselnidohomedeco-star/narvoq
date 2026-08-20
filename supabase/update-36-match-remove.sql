-- update-36-match-remove.sql
-- Permitir que el CREADOR de un partido pueda sacar jugadores (no solo cada uno a sí mismo).

drop policy if exists "mplayers delete" on match_players;
create policy "mplayers delete" on match_players
  for delete using (
    player_id = auth.uid()
    or exists (
      select 1 from matches m
      where m.id = match_players.match_id
        and m.creator_id = auth.uid()
    )
  );

-- Además, permitir al creador cambiar de equipo (UPDATE) a cualquier jugador de su partido.
drop policy if exists "mplayers update" on match_players;
create policy "mplayers update" on match_players
  for update using (
    player_id = auth.uid()
    or exists (
      select 1 from matches m
      where m.id = match_players.match_id
        and m.creator_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
