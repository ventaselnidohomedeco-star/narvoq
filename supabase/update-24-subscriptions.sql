-- update-24-subscriptions.sql
-- Módulo de suscripciones NarvoQ Verificado.
-- - Tabla subscription_plans: los planes disponibles, precios editables desde admin
-- - Tabla subscriptions: suscripciones activas de usuarios/complejos
-- - Columnas rápidas en profiles: is_premium + premium_expires_at

-- ============ Planes (editables desde /admin/planes) ============
create table if not exists subscription_plans (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('player', 'coach', 'complex_admin')),
  billing_period text not null check (billing_period in ('monthly', 'yearly')),
  price_ars integer not null check (price_ars >= 0),
  active boolean default true,
  features jsonb default '[]'::jsonb,   -- lista de features incluidas (para mostrar en /planes)
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (role, billing_period)          -- 1 plan mensual y 1 anual por rol
);

-- Trigger auto-update updated_at
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_subscription_plans_updated on subscription_plans;
create trigger trg_subscription_plans_updated
  before update on subscription_plans
  for each row execute function set_updated_at();

-- Seed inicial: precios propuestos (editables después desde /admin/planes)
insert into subscription_plans (role, billing_period, price_ars, features) values
  ('player',        'monthly',   3000, '["Badge Verificado","Estadísticas avanzadas","Filtros avanzados de ranking","Priority en torneos populares","Fotos ilimitadas en Smash"]'::jsonb),
  ('player',        'yearly',   30000, '["Badge Verificado","Estadísticas avanzadas","Filtros avanzados de ranking","Priority en torneos populares","Fotos ilimitadas en Smash","2 meses gratis"]'::jsonb),
  ('coach',         'monthly',   5000, '["Badge Verificado","Alumnos ilimitados","Academia (marketplace de clases)","Crear torneos propios"]'::jsonb),
  ('coach',         'yearly',   50000, '["Badge Verificado","Alumnos ilimitados","Academia (marketplace de clases)","Crear torneos propios","2 meses gratis"]'::jsonb),
  ('complex_admin', 'monthly',  25000, '["Badge Verificado","Canchas ilimitadas","Cobro automático con MP","Torneos ilimitados","Membresías/Socios","Empleados con roles","Rentabilidad","Promos al feed"]'::jsonb),
  ('complex_admin', 'yearly',  250000, '["Badge Verificado","Canchas ilimitadas","Cobro automático con MP","Torneos ilimitados","Membresías/Socios","Empleados con roles","Rentabilidad","Promos al feed","2 meses gratis"]'::jsonb)
on conflict (role, billing_period) do nothing;

-- ============ Suscripciones activas ============
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,      -- usuario que suscribe (jugador/coach)
  complex_id uuid references complexes(id) on delete cascade,    -- si aplica al complejo entero
  plan_id uuid references subscription_plans(id) on delete restrict,
  status text not null check (status in ('trial', 'active', 'past_due', 'cancelled', 'expired')),
  starts_at timestamptz default now() not null,
  expires_at timestamptz not null,
  cancelled_at timestamptz,
  -- IDs de Mercado Pago (se llenan cuando activemos la integración en Sesión 2)
  mp_preapproval_id text,
  mp_last_payment_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- Un usuario o complejo puede tener solo UNA suscripción activa a la vez
  constraint one_target check ((user_id is not null) or (complex_id is not null))
);

drop trigger if exists trg_subscriptions_updated on subscriptions;
create trigger trg_subscriptions_updated
  before update on subscriptions
  for each row execute function set_updated_at();

create index if not exists idx_subscriptions_user on subscriptions (user_id) where user_id is not null;
create index if not exists idx_subscriptions_complex on subscriptions (complex_id) where complex_id is not null;
create index if not exists idx_subscriptions_status on subscriptions (status, expires_at);

-- ============ Vista rápida en profiles ============
alter table profiles add column if not exists is_premium boolean default false;
alter table profiles add column if not exists premium_expires_at timestamptz;

-- Mismo para complejos
alter table complexes add column if not exists is_premium boolean default false;
alter table complexes add column if not exists premium_expires_at timestamptz;

-- ============ RLS ============
-- subscription_plans: TODOS los usuarios logueados pueden leer (para ver planes disponibles)
alter table subscription_plans enable row level security;
drop policy if exists "plans read all" on subscription_plans;
create policy "plans read all" on subscription_plans for select using (true);

drop policy if exists "plans write admin only" on subscription_plans;
create policy "plans write admin only" on subscription_plans for all
  using ((select role from profiles where id = auth.uid()) = 'super_admin')
  with check ((select role from profiles where id = auth.uid()) = 'super_admin');

-- subscriptions: usuario ve las suyas, super_admin ve todas
alter table subscriptions enable row level security;
drop policy if exists "subs read own" on subscriptions;
create policy "subs read own" on subscriptions for select using (
  user_id = auth.uid()
  or complex_id in (select id from complexes where owner_id = auth.uid())
  or (select role from profiles where id = auth.uid()) = 'super_admin'
);

drop policy if exists "subs write admin only" on subscriptions;
create policy "subs write admin only" on subscriptions for all
  using ((select role from profiles where id = auth.uid()) = 'super_admin')
  with check ((select role from profiles where id = auth.uid()) = 'super_admin');

-- ============ Helper para sincronizar is_premium ============
-- Cuando cambia una suscripción, actualiza el flag rápido en profiles/complexes.
create or replace function sync_premium_flag() returns trigger as $$
begin
  if NEW.user_id is not null then
    update profiles set
      is_premium = (NEW.status in ('active', 'trial') and NEW.expires_at > now()),
      premium_expires_at = case when NEW.status in ('active', 'trial') and NEW.expires_at > now() then NEW.expires_at else null end
    where id = NEW.user_id;
  end if;
  if NEW.complex_id is not null then
    update complexes set
      is_premium = (NEW.status in ('active', 'trial') and NEW.expires_at > now()),
      premium_expires_at = case when NEW.status in ('active', 'trial') and NEW.expires_at > now() then NEW.expires_at else null end
    where id = NEW.complex_id;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_subs_sync_premium on subscriptions;
create trigger trg_subs_sync_premium
  after insert or update on subscriptions
  for each row execute function sync_premium_flag();
