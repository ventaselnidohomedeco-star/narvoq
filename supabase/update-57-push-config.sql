-- update-57-push-config.sql
-- Supabase managed no permite ALTER DATABASE SET. Guardamos la config del push
-- en una tabla que solo lee la función security-definer.

create table if not exists app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

alter table app_config enable row level security;
-- Solo super_admin puede leer/escribir desde el cliente. Las funciones
-- security-definer bypasean RLS.
drop policy if exists app_config_admin on app_config;
create policy app_config_admin on app_config for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'super_admin')
);

-- Seteá tus valores acá (podés cambiarlos cuando quieras):
insert into app_config (key, value) values
  ('base_url', 'https://narvoq.com.ar'),
  ('push_secret', 'NarvoQ-9x8h2k4mZ-p3nd3j0-s3cr3t0-A7bK')
on conflict (key) do update set value = excluded.value, updated_at = now();

-- Reemplazar la función para leer de app_config
create or replace function notify_send_push()
returns trigger as $$
declare
  api_url text;
  api_secret text;
begin
  select value into api_url from app_config where key = 'base_url';
  if api_url is null or api_url = '' then api_url := 'https://narvoq.com.ar'; end if;

  select value into api_secret from app_config where key = 'push_secret';

  perform extensions.net.http_post(
    url := api_url || '/api/push/send',
    body := jsonb_build_object('notification_id', new.id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', coalesce(api_secret, '')
    )
  );
  return new;
exception when others then
  return new;
end;
$$ language plpgsql security definer;

notify pgrst, 'reload schema';
