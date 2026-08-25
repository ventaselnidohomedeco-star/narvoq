-- update-41-push-subscriptions.sql
-- Web Push: guardar suscripciones + trigger para dispararlas cuando entra una notif.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists idx_push_subs_user on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;
drop policy if exists push_subs_own on push_subscriptions;
create policy push_subs_own on push_subscriptions
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Trigger que dispara la Edge Function / API endpoint cuando entra una notif.
-- Requiere la extensión pg_net habilitada.
create extension if not exists pg_net with schema extensions;

create or replace function notify_send_push()
returns trigger as $$
declare
  api_url text;
begin
  -- El endpoint /api/push/send toma el notification_id y lo envía a todas las
  -- suscripciones del usuario.
  api_url := current_setting('app.base_url', true);
  if api_url is null or api_url = '' then
    -- Fallback: hardcode. Cambiá esto al deploy en prod.
    api_url := 'https://narvoq.com.ar';
  end if;

  perform extensions.net.http_post(
    url := api_url || '/api/push/send',
    body := jsonb_build_object('notification_id', new.id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', current_setting('app.push_secret', true)
    )
  );
  return new;
exception when others then
  -- No romper el insert si el push falla
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notif_push on notifications;
create trigger trg_notif_push
  after insert on notifications
  for each row execute function notify_send_push();

notify pgrst, 'reload schema';
