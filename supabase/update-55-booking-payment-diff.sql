-- update-55-booking-payment-diff.sql
-- Recargos / descuentos por forma de pago al reservar cancha.
-- Ej: efectivo $7000, transferencia $7100 (recargo 1.4%), MP $7500 (recargo ~7%).
-- Se guarda como % — positivo = recargo, negativo = descuento. 0 = sin cambio.

alter table complexes add column if not exists booking_pct_efectivo numeric(5,2) default 0;
alter table complexes add column if not exists booking_pct_transferencia numeric(5,2) default 0;
alter table complexes add column if not exists booking_pct_debito numeric(5,2) default 0;
alter table complexes add column if not exists booking_pct_credito numeric(5,2) default 0;
alter table complexes add column if not exists booking_pct_mp numeric(5,2) default 0;

notify pgrst, 'reload schema';
