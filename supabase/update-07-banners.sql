-- ============================================================
-- Actualización 07 — Banners administrables por el CEO
-- Ejecutar UNA VEZ en el SQL Editor de Supabase
-- ============================================================

create table if not exists banners (
  id uuid primary key default gen_random_uuid(),
  section text not null default 'global', -- global | inicio | feed | torneos | ranking | reservas | complejo
  emoji text default '🎾',
  title text not null,                     -- "¡Gana una paleta!"
  subtitle text,                           -- "Meta de 1000 usuarios alcanzada 🎉"
  link_url text,                           -- adónde lleva al tocarlo (opcional)
  link_label text,                         -- "Ver cómo participar"
  active boolean not null default true,
  priority int not null default 0,
  created_at timestamptz not null default now()
);
alter table banners enable row level security;
create policy "banners read" on banners for select using (true);
create policy "banners admin" on banners for all
  using ((select role from profiles where id = auth.uid()) = 'super_admin')
  with check ((select role from profiles where id = auth.uid()) = 'super_admin');

-- ============================================================
-- IMPORTANTE: convertite en CEO (super admin) de la plataforma.
-- Reemplazá TU_USUARIO por tu nombre de usuario de jugador y
-- descomentá (sacale los dos guiones) la línea de abajo:
-- ============================================================
-- update profiles set role = 'super_admin' where username = 'TU_USUARIO';
