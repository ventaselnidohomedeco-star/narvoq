-- update-45-no-double-booking.sql
-- Prevenir doble reserva del mismo slot cuando 2 jugadores intentan reservar al mismo tiempo.
-- Usamos un constraint EXCLUDE con GIST — lo mejor para overlaps de tiempo en Postgres.

-- Necesitamos la extensión btree_gist para poder mezclar uuid + rango
create extension if not exists btree_gist;

-- Añadimos una columna computada de rango si no está
alter table bookings drop constraint if exists no_overlap_bookings;

-- El constraint: para el mismo court, no pueden haber 2 bookings NO cancelados
-- cuyos intervalos [starts_at, ends_at) se solapen.
alter table bookings
  add constraint no_overlap_bookings
  exclude using gist (
    court_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status <> 'cancelada');

-- Nota: si al agregar el constraint tirás error porque ya hay solapamientos
-- históricos en tu DB, primero corré esta query para ver cuáles son:
--
-- select b1.id, b1.court_id, b1.starts_at, b1.ends_at, b1.status,
--        b2.id, b2.starts_at, b2.ends_at, b2.status
-- from bookings b1
-- join bookings b2 on b1.court_id = b2.court_id
--   and b1.id < b2.id
--   and b1.status <> 'cancelada' and b2.status <> 'cancelada'
--   and tstzrange(b1.starts_at, b1.ends_at, '[)') && tstzrange(b2.starts_at, b2.ends_at, '[)');
--
-- Y limpiá cancelando las duplicadas antes de agregar el constraint.
