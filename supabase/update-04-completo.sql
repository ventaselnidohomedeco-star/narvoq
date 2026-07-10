-- ============================================================
-- Actualización 04 — Perfiles completos, complejo con redes,
-- entrenamientos con profesor
-- Ejecutar UNA VEZ en el SQL Editor de Supabase
-- ============================================================

-- Jugador: paleta con foto y lado preferido
alter table profiles add column if not exists racket_photo_url text;
alter table profiles add column if not exists side text default 'ambos'; -- drive | reves | ambos

-- Complejo: contacto, redes y servicios
alter table complexes add column if not exists whatsapp text;
alter table complexes add column if not exists instagram text;
alter table complexes add column if not exists maps_url text;
alter table complexes add column if not exists services text; -- "Buffet, Vestuarios, Estacionamiento"

-- Entrenamientos: profesor y objetivos
alter table trainings add column if not exists coach text;
alter table trainings add column if not exists goals text;
