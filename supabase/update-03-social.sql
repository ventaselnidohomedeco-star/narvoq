-- ============================================================
-- Actualización 03 — Perfiles completos y reposts
-- Ejecutar UNA VEZ en el SQL Editor de Supabase
-- ============================================================

-- 1. Perfil estilo Instagram: paleta que usa y una mini bio
alter table profiles add column if not exists racket text;
alter table profiles add column if not exists bio text;

-- 2. Reposts: una publicación puede referenciar a otra (como retweet)
alter table posts add column if not exists repost_of uuid references posts(id) on delete cascade;
