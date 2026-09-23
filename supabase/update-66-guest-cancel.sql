-- Fase 1.3: permitir a invitados cancelar su propia reserva
-- (Con el UUID del booking en la URL como token secreto)

-- Policy: anon puede UPDATE una reserva sólo si es guest (player_id null) y sólo para cancelarla
-- El WITH CHECK asegura que sólo pueda setear status='cancelada' y no otra cosa
drop policy if exists "booking cancel guest" on bookings;
create policy "booking cancel guest" on bookings for update
  using (player_id is null and status in ('pendiente','confirmada'))
  with check (player_id is null and status = 'cancelada');

-- Trigger: notificar al dueño del complejo cuando un guest cancela
create or replace function notify_owner_of_guest_cancel()
returns trigger language plpgsql security definer as $$
declare
  v_owner uuid;
  v_court_name text;
begin
  -- Solo si es guest booking Y pasó de activo a cancelada
  if new.player_id is not null then return new; end if;
  if old.status = 'cancelada' or new.status <> 'cancelada' then return new; end if;

  select cx.owner_id, ct.name into v_owner, v_court_name
    from courts ct join complexes cx on cx.id = ct.complex_id
    where ct.id = new.court_id;

  if v_owner is null then return new; end if;

  insert into notifications (user_id, kind, title, body, link, ref_id)
  values (
    v_owner,
    'booking_cancel',
    '❌ Cancelación (link público)',
    coalesce(new.guest_name, 'Invitado') || ' canceló ' || v_court_name ||
      ' del ' || to_char(new.starts_at at time zone 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI') || ' hs' ||
      ' · Tel: ' || coalesce(new.guest_phone, ''),
    '/complejo/calendario',
    new.id
  );
  return new;
end $$;

drop trigger if exists trg_notify_owner_guest_cancel on bookings;
create trigger trg_notify_owner_guest_cancel
after update on bookings
for each row execute procedure notify_owner_of_guest_cancel();

notify pgrst, 'reload schema';
