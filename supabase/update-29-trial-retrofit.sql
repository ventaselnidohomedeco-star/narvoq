-- update-29-trial-retrofit.sql
-- Al activar el trial automático de 60 días, damos el mismo beneficio a
-- los usuarios que ya se habían registrado antes (para que no se sientan
-- discriminados vs los nuevos).
--
-- Solo aplica a profiles/complexes que NO son premium hoy.
-- Los que ya son premium por suscripción activa no se tocan.

-- Profiles: dar trial a los que no tienen premium activo
update profiles
set is_premium = true,
    premium_expires_at = now() + interval '60 days'
where (is_premium is null or is_premium = false)
  and id not in (
    select user_id from subscriptions
    where user_id is not null and status in ('active', 'trial')
  );

-- Complexes: dar trial a los que no tienen premium activo
update complexes
set is_premium = true,
    premium_expires_at = now() + interval '60 days'
where (is_premium is null or is_premium = false)
  and id not in (
    select complex_id from subscriptions
    where complex_id is not null and status in ('active', 'trial')
  );
