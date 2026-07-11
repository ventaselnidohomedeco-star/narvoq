-- ============================================================
-- Actualización 11 — Marketplace (productos de pádel)
-- Ejecutar UNA VEZ en el SQL Editor de Supabase (idempotente).
-- ============================================================

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text,
  price numeric(10,2) not null default 0,
  currency text not null default 'ARS',
  photos text[] default '{}',
  contact_phone text,
  category text,           -- 'paleta' | 'accesorios' | 'ropa' | 'pelotas' | 'otros'
  condition text,          -- 'nuevo' | 'usado'
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table products enable row level security;

drop policy if exists "products read" on products;
create policy "products read" on products for select using (active = true or seller_id = auth.uid() or my_role() = 'super_admin');

drop policy if exists "products insert own" on products;
create policy "products insert own" on products for insert with check (seller_id = auth.uid());

drop policy if exists "products update own" on products;
create policy "products update own" on products for update using (seller_id = auth.uid() or my_role() = 'super_admin');

drop policy if exists "products delete own" on products;
create policy "products delete own" on products for delete using (seller_id = auth.uid() or my_role() = 'super_admin');

create index if not exists idx_products_active_created on products(active, created_at desc);
