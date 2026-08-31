-- update-51-relax-complexes.sql
-- Relaja columnas viejas de complexes que ya no son obligatorias
-- (city_id reemplazado por province+locality, email/phone opcionales para precarga)

alter table complexes alter column city_id drop not null;
alter table complexes alter column email drop not null;
alter table complexes alter column phone drop not null;
alter table complexes alter column responsible drop not null;

notify pgrst, 'reload schema';
