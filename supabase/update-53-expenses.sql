-- update-53-expenses.sql
-- Gastos del complejo: impactan en rentabilidad. Categorías + recurrentes.

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references complexes(id) on delete cascade,
  category text not null,                           -- Sueldos | Mantenimiento | Servicios | Impuestos | Insumos buffet | Alquiler | Marketing | Otros
  amount integer not null,                          -- ARS
  spent_on date not null default current_date,
  description text,
  receipt_url text,
  is_recurring boolean default false,               -- true = se repite cada mes (auto-crear)
  recurring_day int,                                 -- día del mes en que se repite (1-28)
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_expenses_complex on expenses (complex_id, spent_on desc);
create index if not exists idx_expenses_category on expenses (category);

alter table expenses enable row level security;
drop policy if exists exp_owner_all on expenses;
create policy exp_owner_all on expenses for all using (
  exists (select 1 from complexes c where c.id = complex_id and c.owner_id = auth.uid())
);

notify pgrst, 'reload schema';
