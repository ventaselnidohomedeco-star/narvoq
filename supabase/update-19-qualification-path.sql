-- ============================================================
-- Actualización 19 — qualification_path en group_memberships
-- Guarda de dónde clasificó cada pareja: 1º, 2º, 3º (vía prelim), 4º (vía prelim).
-- Ejecutar UNA VEZ en el SQL Editor de Supabase.
-- ============================================================

alter table group_memberships add column if not exists qualification_path text;
-- Valores: 'direct_from_1st' | 'direct_from_2nd' | 'preliminary_from_3rd' | 'preliminary_from_4th'

-- Nota: la app rellena este campo al ejecutar generateKnockoutStage().
