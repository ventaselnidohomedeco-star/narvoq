-- update-54-admin-pin.sql
-- PIN del dueño del complejo (4 dígitos). Protege Rentabilidad y Gastos
-- del acceso de empleados/ayudantes que compartan la cuenta.

alter table complexes add column if not exists admin_pin text;

notify pgrst, 'reload schema';
