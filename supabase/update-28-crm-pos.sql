-- update-28-crm-pos.sql
-- CRM Fase 1: Productos + Clientes + Punto de Venta + Ventas.
-- Solo disponible para complejos Premium (enforcement en la UI).

-- ============ PRODUCTOS ============
create table if not exists pos_products (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references complexes(id) on delete cascade,
  name text not null,
  category text,                                    -- 'bebida', 'snack', 'indumentaria', 'accesorio', 'servicio', etc.
  price integer not null default 0,                 -- precio de venta ARS
  cost integer default 0,                           -- costo unitario ARS (para calcular margen)
  stock integer default 0,                          -- stock actual (unidades)
  min_stock integer default 0,                      -- alerta de stock bajo
  sku text,                                          -- código interno del complejo (auto-generado)
  ean text,                                          -- código de barras estándar (13 dígitos)
  photo_url text,
  active boolean default true,
  is_service boolean default false,                 -- true = servicio (no descuenta stock)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_pos_products_complex on pos_products (complex_id);
create index if not exists idx_pos_products_ean on pos_products (ean) where ean is not null;
create index if not exists idx_pos_products_sku on pos_products (sku) where sku is not null;

drop trigger if exists trg_pos_products_updated on pos_products;
create trigger trg_pos_products_updated
  before update on pos_products
  for each row execute function set_updated_at();

-- ============ CLIENTES ============
create table if not exists pos_clients (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references complexes(id) on delete cascade,
  -- Si el cliente ES un usuario de NarvoQ, linkeamos. Sino solo guardamos datos sueltos.
  profile_id uuid references profiles(id) on delete set null,
  name text not null,
  phone text,
  email text,
  notes text,
  total_spent integer default 0,                    -- se actualiza cuando registra ventas
  visits_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_pos_clients_complex on pos_clients (complex_id);
create index if not exists idx_pos_clients_profile on pos_clients (profile_id) where profile_id is not null;

drop trigger if exists trg_pos_clients_updated on pos_clients;
create trigger trg_pos_clients_updated
  before update on pos_clients
  for each row execute function set_updated_at();

-- ============ VENTAS ============
create table if not exists pos_sales (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references complexes(id) on delete cascade,
  client_id uuid references pos_clients(id) on delete set null,
  cashier_id uuid references auth.users(id) on delete set null,   -- quién vendió
  subtotal integer not null default 0,              -- suma de items antes de descuentos
  discount integer default 0,                       -- descuento total ARS (por forma de pago o manual)
  total integer not null default 0,                 -- subtotal - discount
  payment_method text not null default 'efectivo', -- 'efectivo', 'transferencia', 'debito', 'credito', 'mp', 'seña'
  paid_amount integer default 0,                    -- cuánto pagó (menor que total = queda pendiente)
  status text not null default 'completada',        -- 'completada', 'pendiente', 'cancelada'
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_pos_sales_complex on pos_sales (complex_id, created_at desc);
create index if not exists idx_pos_sales_status on pos_sales (status) where status != 'completada';

-- ============ ITEMS DE VENTA ============
create table if not exists pos_sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references pos_sales(id) on delete cascade,
  product_id uuid references pos_products(id) on delete set null,
  product_name text not null,                       -- snapshot del nombre al momento de vender
  qty integer not null default 1,
  unit_price integer not null default 0,            -- snapshot del precio al momento de vender
  subtotal integer not null default 0                -- qty * unit_price
);

create index if not exists idx_pos_sale_items_sale on pos_sale_items (sale_id);
create index if not exists idx_pos_sale_items_product on pos_sale_items (product_id) where product_id is not null;

-- ============ RLS ============
alter table pos_products enable row level security;
alter table pos_clients enable row level security;
alter table pos_sales enable row level security;
alter table pos_sale_items enable row level security;

-- Productos: solo el dueño del complejo o super_admin puede ver/editar
drop policy if exists "pos_products owner rw" on pos_products;
create policy "pos_products owner rw" on pos_products for all using (
  complex_id in (select id from complexes where owner_id = auth.uid())
  or (select role from profiles where id = auth.uid()) = 'super_admin'
) with check (
  complex_id in (select id from complexes where owner_id = auth.uid())
  or (select role from profiles where id = auth.uid()) = 'super_admin'
);

drop policy if exists "pos_clients owner rw" on pos_clients;
create policy "pos_clients owner rw" on pos_clients for all using (
  complex_id in (select id from complexes where owner_id = auth.uid())
  or (select role from profiles where id = auth.uid()) = 'super_admin'
) with check (
  complex_id in (select id from complexes where owner_id = auth.uid())
  or (select role from profiles where id = auth.uid()) = 'super_admin'
);

drop policy if exists "pos_sales owner rw" on pos_sales;
create policy "pos_sales owner rw" on pos_sales for all using (
  complex_id in (select id from complexes where owner_id = auth.uid())
  or (select role from profiles where id = auth.uid()) = 'super_admin'
) with check (
  complex_id in (select id from complexes where owner_id = auth.uid())
  or (select role from profiles where id = auth.uid()) = 'super_admin'
);

drop policy if exists "pos_sale_items owner rw" on pos_sale_items;
create policy "pos_sale_items owner rw" on pos_sale_items for all using (
  sale_id in (
    select id from pos_sales where complex_id in (select id from complexes where owner_id = auth.uid())
  )
  or (select role from profiles where id = auth.uid()) = 'super_admin'
) with check (
  sale_id in (
    select id from pos_sales where complex_id in (select id from complexes where owner_id = auth.uid())
  )
  or (select role from profiles where id = auth.uid()) = 'super_admin'
);

-- ============ TRIGGER: descontar stock al vender + actualizar cliente ============
create or replace function on_pos_sale_item_insert() returns trigger as $$
begin
  -- Descontar stock si es producto (no servicio)
  if NEW.product_id is not null then
    update pos_products
    set stock = stock - NEW.qty
    where id = NEW.product_id and is_service = false;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_pos_sale_item_stock on pos_sale_items;
create trigger trg_pos_sale_item_stock
  after insert on pos_sale_items
  for each row execute function on_pos_sale_item_insert();

-- Trigger: actualizar total_spent y visits del cliente cuando se completa venta
create or replace function on_pos_sale_complete() returns trigger as $$
begin
  if NEW.status = 'completada' and NEW.client_id is not null and
     (OLD.status is null or OLD.status != 'completada') then
    update pos_clients
    set total_spent = total_spent + NEW.total,
        visits_count = visits_count + 1
    where id = NEW.client_id;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_pos_sale_client_stats on pos_sales;
create trigger trg_pos_sale_client_stats
  after insert or update on pos_sales
  for each row execute function on_pos_sale_complete();
