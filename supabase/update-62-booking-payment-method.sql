-- Agrega payment_method a bookings (faltaba, y rompe el select de /partido/[id])
-- 'efectivo' | 'transferencia' | 'mp' | null
alter table bookings add column if not exists payment_method text;

notify pgrst, 'reload schema';
