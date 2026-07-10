-- ============================================================
-- Actualización 02 — Panel completo del complejo
-- Ejecutar UNA VEZ en el SQL Editor de Supabase (después de update-01)
-- ============================================================

-- 1. Reservas manuales: el complejo puede anotar a alguien que reservó
--    por WhatsApp o en el mostrador, aunque no tenga cuenta en la app.
alter table bookings add column if not exists guest_name text;
alter table bookings add column if not exists guest_phone text;

-- 2. Permiso nuevo: el dueño del complejo puede crear CUALQUIER tipo de
--    reserva (normal, manual o bloqueo) sobre sus propias canchas.
drop policy if exists "booking insert" on bookings;

create policy "booking insert" on bookings for insert with check (
  (type = 'reserva' and player_id = auth.uid())
  or owns_complex((select complex_id from courts where id = court_id))
);
