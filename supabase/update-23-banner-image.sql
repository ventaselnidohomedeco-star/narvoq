-- update-23-banner-image.sql
-- Agrega soporte para imagen en banners de sección.
-- Si image_url tiene valor, el banner se renderea como tira full-width
-- con la imagen; si es null, sigue como barra de texto con emoji.

alter table banners add column if not exists image_url text;
