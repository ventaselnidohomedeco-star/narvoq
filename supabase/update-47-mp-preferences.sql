-- update-47-mp-preferences.sql
-- Preferencias adicionales del complejo para pagos por MP.

alter table complexes add column if not exists mp_exclude_credit boolean default true;

-- Default: excluye crédito (evita comisiones altas). Cada complejo puede activarlo si quiere.
notify pgrst, 'reload schema';
