-- update-48-mp-only-deposit.sql
-- Toggle "solo aceptar seña por MP" — el complejo no permite pagar el turno completo por MP,
-- solo la seña, para minimizar comisiones.

alter table complexes add column if not exists mp_only_deposit boolean default false;

notify pgrst, 'reload schema';
