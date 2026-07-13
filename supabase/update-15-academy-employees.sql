-- ============================================================
-- Actualización 15 — Academia (profes) + empleados de complejo
-- Ejecutar UNA VEZ en el SQL Editor de Supabase (idempotente).
-- ============================================================

-- 1) Campo academy_name en el perfil del profe (opcional).
-- Cuando un profe pertenece a una academia, sus alumnos lo verán así.
alter table profiles add column if not exists academy_name text;
alter table profiles add column if not exists academy_logo_url text;

-- 2) Empleados de complejo. El dueño del complejo (owner_id) invita
-- empleados que pueden gestionar reservas y turnos, pero NO editar el
-- perfil del complejo ni ver la facturación.
create table if not exists complex_employees (
  complex_id uuid not null references complexes(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'staff',   -- 'staff' | 'manager'
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (complex_id, user_id)
);
alter table complex_employees enable row level security;

drop policy if exists "employees read own or owner" on complex_employees;
create policy "employees read own or owner" on complex_employees for select
  using (
    user_id = auth.uid()
    or exists (select 1 from complexes c where c.id = complex_id and c.owner_id = auth.uid())
    or my_role() = 'super_admin'
  );

drop policy if exists "employees write owner" on complex_employees;
create policy "employees write owner" on complex_employees for all
  using (
    exists (select 1 from complexes c where c.id = complex_id and c.owner_id = auth.uid())
    or my_role() = 'super_admin'
  )
  with check (
    exists (select 1 from complexes c where c.id = complex_id and c.owner_id = auth.uid())
    or my_role() = 'super_admin'
  );

-- 3) Función helper: chequea si el usuario actual pertenece al complejo
-- (dueño o empleado activo). Se usa para RLS de otros features.
create or replace function works_at_complex(cid uuid) returns boolean
language sql stable as $$
  select exists (
    select 1 from complexes c where c.id = cid and c.owner_id = auth.uid()
    union
    select 1 from complex_employees e
      where e.complex_id = cid and e.user_id = auth.uid() and e.active = true
  )
$$;

-- 4) Permitir a los empleados operar sobre las reservas y las canchas
-- del complejo donde trabajan (además del dueño).
drop policy if exists "courts write" on courts;
create policy "courts write" on courts for all
  using (works_at_complex(complex_id) or my_role() = 'super_admin')
  with check (works_at_complex(complex_id) or my_role() = 'super_admin');

drop policy if exists "booking insert" on bookings;
create policy "booking insert" on bookings for insert with check (
  (type = 'reserva' and player_id = auth.uid())
  or (type = 'block' and works_at_complex((select complex_id from courts where id = court_id)))
  or (works_at_complex((select complex_id from courts where id = court_id)))
);

drop policy if exists "booking update" on bookings;
create policy "booking update" on bookings for update using (
  player_id = auth.uid()
  or works_at_complex((select complex_id from courts where id = court_id))
  or my_role() = 'super_admin'
);
