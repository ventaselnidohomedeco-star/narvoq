-- update-25-mp-email.sql
-- Permitir que el usuario asocie un email de Mercado Pago DISTINTO
-- al email de su cuenta NarvoQ. Sin esto, tienen que hacer coincidir
-- ambos emails o crear una cuenta nueva en NarvoQ.
--
-- Uso:
--   - Si mp_email está seteado → se usa para el payer_email en MP
--   - Si es null → se usa el email de auth.users como fallback

alter table profiles add column if not exists mp_email text;

comment on column profiles.mp_email is
  'Email para cobros de Mercado Pago (opcional). Si es null, se usa el email de auth.users.';
