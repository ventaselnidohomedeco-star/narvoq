-- ============================================================
-- Actualización 16 — Fix: policy SELECT en results
-- CRÍTICO: los resultados se estaban insertando pero no se leían
-- (RLS habilitado sin policy SELECT = 0 filas visibles).
-- Ejecutar UNA VEZ en el SQL Editor de Supabase.
-- ============================================================

drop policy if exists "results read" on results;
create policy "results read" on results for select using (true);
-- Los resultados son públicos: cualquiera puede ver el resultado de un partido
-- (los partidos, matches y match_players ya son públicos).
