-- update-31-complex-status.sql
-- Sistema de aprobación de complejos.
-- Nuevo estado 'status' con máquina de estados: pending_review → active → suspended
-- (o rejected).
--
-- Idempotente: seguro correrlo varias veces.

-- 1) Columna status con default pending_review
alter table complexes add column if not exists status text not null default 'pending_review'
  check (status in ('pending_review', 'active', 'suspended', 'rejected'));

alter table complexes add column if not exists status_updated_at timestamptz;
alter table complexes add column if not exists status_updated_by uuid references auth.users(id) on delete set null;
alter table complexes add column if not exists rejection_reason text;

comment on column complexes.status is
  'pending_review = recién creado, no visible al público. active = aprobado, aparece en búsquedas. suspended = temporalmente fuera. rejected = rechazado por admin.';

-- 2) MIGRACIÓN de complejos existentes: los que ya estaban antes de este cambio
--    se consideran 'active' (para no romper lo que ya funcionaba). Sólo aplica
--    la primera vez que se corre este script.
update complexes set status = 'active'
where status = 'pending_review'
  and created_at < now() - interval '1 minute';

-- 3) Índice para queries frecuentes de "solo active"
create index if not exists idx_complexes_status on complexes (status)
  where status = 'active';

-- 4) Refrescar cache de PostgREST
notify pgrst, 'reload schema';
