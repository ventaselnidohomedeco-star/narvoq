-- update-61-auto-confirm.sql
-- Config del complejo: aceptar reservas automáticamente (sin aprobación manual).

alter table complexes add column if not exists auto_confirm_bookings boolean default false;

notify pgrst, 'reload schema';
