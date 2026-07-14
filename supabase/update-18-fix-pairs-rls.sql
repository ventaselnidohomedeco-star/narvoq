-- ============================================================
-- Actualización 18 — Fix RLS tournament_pairs
-- Permite al organizador (complejo O profe dueño) insertar/actualizar
-- parejas del torneo, incluyendo parejas provisionales sin cuenta.
-- Ejecutar UNA VEZ en el SQL Editor de Supabase.
-- ============================================================

drop policy if exists "pairs insert" on tournament_pairs;
create policy "pairs insert" on tournament_pairs for insert with check (
  -- Jugadores registrados se anotan a sí mismos
  player1_id = auth.uid() or player2_id = auth.uid()
  -- O el dueño del torneo (complejo o profe) inscribe a otros / provisionales
  or owns_complex((select complex_id from tournaments where id = tournament_id))
  or (select owner_coach_id from tournaments where id = tournament_id) = auth.uid()
  or my_role() = 'super_admin'
);

drop policy if exists "pairs write organizer" on tournament_pairs;
create policy "pairs write organizer" on tournament_pairs for update
  using (
    owns_complex((select complex_id from tournaments where id = tournament_id))
    or (select owner_coach_id from tournaments where id = tournament_id) = auth.uid()
    or player1_id = auth.uid() or player2_id = auth.uid()
    or my_role() = 'super_admin'
  ) with check (
    owns_complex((select complex_id from tournaments where id = tournament_id))
    or (select owner_coach_id from tournaments where id = tournament_id) = auth.uid()
    or player1_id = auth.uid() or player2_id = auth.uid()
    or my_role() = 'super_admin'
  );

drop policy if exists "pairs delete organizer" on tournament_pairs;
create policy "pairs delete organizer" on tournament_pairs for delete using (
  owns_complex((select complex_id from tournaments where id = tournament_id))
  or (select owner_coach_id from tournaments where id = tournament_id) = auth.uid()
  or my_role() = 'super_admin'
);
