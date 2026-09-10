-- update-58-push-sound.sql
-- Preferencia por usuario: recibir notif con sonido o en silencio.

alter table profiles add column if not exists push_sound_enabled boolean default true;

notify pgrst, 'reload schema';
