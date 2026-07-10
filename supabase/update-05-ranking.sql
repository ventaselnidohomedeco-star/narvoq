-- ============================================================
-- Actualización 05 — Ranking solo por torneos + borrar posteos
-- Ejecutar UNA VEZ en el SQL Editor de Supabase
-- ============================================================

-- 1. Borrar publicaciones: el autor (jugador), el dueño del complejo
--    o el super admin pueden eliminar un posteo. Los likes, comentarios
--    y reposts del posteo se borran en cascada.
drop policy if exists "posts delete" on posts;
create policy "posts delete" on posts for delete using (
  author_profile_id = auth.uid()
  or (author_complex_id is not null and owns_complex(author_complex_id))
  or my_role() = 'super_admin'
);

-- 2. RANKING SOLO POR TORNEOS.
--    Los partidos de reserva siguen guardando puntos en el ledger
--    (sirven para las ESTADÍSTICAS del jugador: ganados/perdidos),
--    pero el RANKING solo suma filas que provienen de un torneo.
create or replace view v_ranking as
select p.id as player_id, p.username, p.first_name, p.last_name,
       p.category, p.sex, p.city_id,
       rp.complex_id,
       sum(rp.points)::int as points
from ranking_points rp
join profiles p on p.id = rp.player_id
where rp.ref_tournament_id is not null      -- <<< solo torneos
group by p.id, rp.complex_id;
