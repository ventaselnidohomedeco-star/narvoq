-- update-20-bracket-freeze.sql
-- Agrega freeze del cuadro eliminatorio: timestamp de confirmación + snapshot.
-- Idempotente.

alter table tournaments add column if not exists bracket_confirmed_at timestamptz;
alter table tournaments add column if not exists bracket_snapshot jsonb;

-- Nota: al confirmar el bracket, el organizador guarda una copia del estado
-- del cuadro en bracket_snapshot. Cambios posteriores requieren des-confirmar
-- (bracket_confirmed_at = null) para permitir modificaciones normales.
