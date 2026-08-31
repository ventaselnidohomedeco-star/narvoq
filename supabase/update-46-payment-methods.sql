-- update-46-payment-methods.sql
-- Campos para configurar los métodos de pago del complejo.

alter table complexes add column if not exists payment_cash_enabled boolean default true;
alter table complexes add column if not exists payment_cash_discount_pct numeric default 0;
alter table complexes add column if not exists payment_cash_notes text;
alter table complexes add column if not exists payment_transfer_enabled boolean default true;
alter table complexes add column if not exists payment_mp_enabled boolean default false;

-- Retro-compat: los complejos existentes con MP conectado quedan habilitados
update complexes set payment_mp_enabled = true where mp_access_token is not null;

notify pgrst, 'reload schema';
