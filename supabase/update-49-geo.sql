-- update-49-geo.sql
-- Agrega provincia + localidad al perfil, y coordenadas a complejos para
-- búsqueda por cercanía.

alter table profiles add column if not exists province text;
alter table profiles add column if not exists locality text;

alter table complexes add column if not exists lat numeric;
alter table complexes add column if not exists lng numeric;
alter table complexes add column if not exists province text;
alter table complexes add column if not exists locality text;

-- Índice para orden por distancia (opcional, mejora perf)
create index if not exists idx_complexes_latlng on complexes (lat, lng) where lat is not null and lng is not null;

notify pgrst, 'reload schema';
