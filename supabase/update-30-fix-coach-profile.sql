-- update-30-fix-coach-profile.sql
-- FIX: registro de entrenadores fallaba con
--   "Could not find the 'academy_name' column of 'profiles' in the schema cache"
-- Causa: la migración update-15-academy-employees.sql nunca se ejecutó en producción.
--
-- Este archivo es 100% idempotente y seguro de correr múltiples veces.

-- 1) Asegurar columnas del perfil de coach (todas 'add column if not exists')
alter table profiles add column if not exists academy_name text;
alter table profiles add column if not exists bio text;

-- 2) Refrescar el schema cache de PostgREST (Supabase) para que reconozca las
--    columnas nuevas sin necesidad de restart manual.
notify pgrst, 'reload schema';

-- ============================================================
-- DIAGNÓSTICO: detectar cuentas huérfanas (auth sin profile).
-- Sólo LISTA, no borra. Ejecutá si querés inspeccionar.
-- ============================================================
--
--   select u.id, u.email, u.created_at
--   from auth.users u
--   left join profiles p on p.id = u.id
--   where p.id is null
--   order by u.created_at desc;
--
