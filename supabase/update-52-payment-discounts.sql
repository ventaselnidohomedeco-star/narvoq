-- update-52-payment-discounts.sql
-- Descuentos por forma de pago en el POS del complejo (% off según método).

alter table complexes add column if not exists pos_discount_efectivo numeric(5,2) default 0;
alter table complexes add column if not exists pos_discount_transferencia numeric(5,2) default 0;
alter table complexes add column if not exists pos_discount_debito numeric(5,2) default 0;
alter table complexes add column if not exists pos_discount_credito numeric(5,2) default 0;
alter table complexes add column if not exists pos_discount_mp numeric(5,2) default 0;

notify pgrst, 'reload schema';
