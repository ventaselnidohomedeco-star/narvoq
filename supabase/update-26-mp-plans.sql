-- update-26-mp-plans.sql
-- Migración a Preapproval Plans de Mercado Pago.
-- En vez de crear un Preapproval por cada usuario (que fuerza payer_email),
-- creamos UN plan por cada subscription_plan y todos los usuarios se
-- suscriben a ese plan. MP no valida el email del pagador → cualquier cuenta
-- MP puede pagar sin importar el email de NarvoQ.

alter table subscription_plans add column if not exists mp_plan_id text;
alter table subscription_plans add column if not exists mp_init_point text;
alter table subscription_plans add column if not exists mp_synced_at timestamptz;

comment on column subscription_plans.mp_plan_id is
  'ID del preapproval_plan en Mercado Pago (creado vía POST /preapproval_plan).';
comment on column subscription_plans.mp_init_point is
  'URL de checkout de MP. Los usuarios se suscriben acá con ?external_reference=<subscription.id>.';
