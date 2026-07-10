-- ============================================================
-- Actualización 10 — Notificaciones in-app
-- Ejecutar UNA VEZ en el SQL Editor de Supabase (idempotente).
-- ============================================================

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null,          -- like | comment | reserva_ok | membresia_ok | coach_add | training_new | torneo_nuevo | mencion
  title text not null,
  body text,
  link text,
  ref_id uuid,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;

drop policy if exists "notifications read own" on notifications;
create policy "notifications read own" on notifications for select
  using (user_id = auth.uid());

drop policy if exists "notifications update own" on notifications;
create policy "notifications update own" on notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "notifications delete own" on notifications;
create policy "notifications delete own" on notifications for delete
  using (user_id = auth.uid());

-- Cualquier usuario autenticado puede crear notificaciones para otros
-- (las inserta el cliente después de un like, comentario, etc.).
drop policy if exists "notifications insert authenticated" on notifications;
create policy "notifications insert authenticated" on notifications for insert
  with check (auth.uid() is not null);

create index if not exists idx_notifications_user_unread
  on notifications(user_id, read, created_at desc);
