-- update-22-podium-photos.sql
-- Fotos reales del podio (campeones y sub-campeones) para la imagen de Final.
-- Se guardan como URLs directas. Si el organizador las sube, la imagen
-- generada usa esas fotos en vez de los avatares individuales.

alter table tournaments add column if not exists podium_champion_photo text;
alter table tournaments add column if not exists podium_runnerup_photo text;
