-- ============================================================
-- Actualización 01 — Fotos y descripciones
-- Ejecutar UNA VEZ en el SQL Editor de Supabase
-- ============================================================

-- 1. Las canchas ahora tienen descripción y foto propia
alter table courts add column if not exists description text;
alter table courts add column if not exists photo_url text;

-- 2. Bucket público "media" para todas las imágenes de la app
--    (avatares, logos, fotos de canchas y de publicaciones)
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- 3. Permisos del bucket:
--    cualquiera puede VER las imágenes, solo usuarios logueados pueden SUBIR
create policy "media read" on storage.objects
  for select using (bucket_id = 'media');

create policy "media upload" on storage.objects
  for insert with check (bucket_id = 'media' and auth.uid() is not null);

create policy "media update own" on storage.objects
  for update using (bucket_id = 'media' and owner = auth.uid());

create policy "media delete own" on storage.objects
  for delete using (bucket_id = 'media' and owner = auth.uid());
