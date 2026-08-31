-- update-50-complex-precarga.sql
-- Complejos precargados por admin (sales pre-launch). Marcados como "reclamables"
-- para que el dueño real pueda pedir tomar la titularidad de la cuenta.

alter table complexes add column if not exists is_precargado boolean default false;
alter table complexes add column if not exists claim_key text unique;

-- Solicitudes de reclamo
create table if not exists complex_claim_requests (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references complexes(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  message text,
  status text not null default 'pending',   -- pending | approved | rejected
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);
create index if not exists idx_claim_complex on complex_claim_requests (complex_id);
create index if not exists idx_claim_status on complex_claim_requests (status);

alter table complex_claim_requests enable row level security;
drop policy if exists claim_public_insert on complex_claim_requests;
create policy claim_public_insert on complex_claim_requests
  for insert with check (true);   -- cualquiera puede solicitar reclamo
drop policy if exists claim_admin_read on complex_claim_requests;
create policy claim_admin_read on complex_claim_requests
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'super_admin')
  );
drop policy if exists claim_admin_write on complex_claim_requests;
create policy claim_admin_write on complex_claim_requests
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'super_admin')
  );

notify pgrst, 'reload schema';
