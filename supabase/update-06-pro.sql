-- ============================================================
-- Actualización 06 — Amigos, torneos pro, circuitos, ascensos y membresías
-- Ejecutar UNA VEZ en el SQL Editor de Supabase
-- ============================================================

-- ---------- 1. AMIGOS / SEGUIR ----------
create table if not exists follows (
  follower_id uuid not null references profiles(id) on delete cascade,
  followed_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);
alter table follows enable row level security;
create policy "follows read" on follows for select using (true);
create policy "follows insert" on follows for insert with check (follower_id = auth.uid());
create policy "follows delete" on follows for delete using (follower_id = auth.uid());

-- El creador del partido puede agregar amigos directamente
drop policy if exists "mplayers write" on match_players;
create policy "mplayers write" on match_players for insert with check (
  player_id = auth.uid()
  or exists (select 1 from matches m where m.id = match_id and m.creator_id = auth.uid())
);

-- ---------- 2. TORNEOS: precio, fechas, aprobación y comprobantes ----------
alter table tournaments add column if not exists price numeric(10,2) default 0;
alter table tournaments add column if not exists ends_on date;

alter table tournament_pairs add column if not exists status text not null default 'pendiente'; -- pendiente | aprobada | rechazada
alter table tournament_pairs add column if not exists payment_proof_url text;

drop policy if exists "pairs update" on tournament_pairs;
create policy "pairs update" on tournament_pairs for update using (
  player1_id = auth.uid() or player2_id = auth.uid()
  or owns_complex((select complex_id from tournaments t where t.id = tournament_id))
);
drop policy if exists "pairs delete" on tournament_pairs;
create policy "pairs delete" on tournament_pairs for delete using (
  player1_id = auth.uid() or player2_id = auth.uid()
  or owns_complex((select complex_id from tournaments t where t.id = tournament_id))
);

-- ---------- 3. CIRCUITOS ANUALES ----------
create table if not exists circuits (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references complexes(id) on delete cascade,
  name text not null,
  year int not null default extract(year from now()),
  created_at timestamptz not null default now()
);
alter table tournaments add column if not exists circuit_id uuid references circuits(id) on delete set null;
alter table circuits enable row level security;
create policy "circuits read" on circuits for select using (true);
create policy "circuits write" on circuits for all
  using (owns_complex(complex_id)) with check (owns_complex(complex_id));

-- ---------- 4. OBSERVAR Y ASCENDER ----------
create table if not exists watchlist (
  complex_id uuid not null references complexes(id) on delete cascade,
  player_id uuid not null references profiles(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  primary key (complex_id, player_id)
);
alter table watchlist enable row level security;
create policy "watchlist all" on watchlist for all
  using (owns_complex(complex_id)) with check (owns_complex(complex_id));

-- Función segura para ascender de categoría con un clic
create or replace function promote_player(pid uuid, new_cat int) returns void
language plpgsql security definer as $$
begin
  if (select role from profiles where id = auth.uid()) not in ('complex_admin', 'super_admin') then
    raise exception 'Solo los complejos pueden ascender jugadores';
  end if;
  if new_cat < 1 or new_cat > 8 then
    raise exception 'Categoría inválida';
  end if;
  update profiles set category = new_cat where id = pid and role = 'player';
end $$;

-- ---------- 5. MEMBRESÍAS PARA SOCIOS ----------
create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references complexes(id) on delete cascade,
  name text not null,                 -- "Socio Full", "Socio Pleno"
  price numeric(10,2) not null default 0,
  benefits text,                      -- "10% off en turnos, prioridad en torneos, 1 clase mensual"
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists membership_members (
  membership_id uuid not null references memberships(id) on delete cascade,
  player_id uuid not null references profiles(id) on delete cascade,
  since date not null default current_date,
  primary key (membership_id, player_id)
);
alter table memberships enable row level security;
alter table membership_members enable row level security;
create policy "memberships read" on memberships for select using (true);
create policy "memberships write" on memberships for all
  using (owns_complex(complex_id)) with check (owns_complex(complex_id));
create policy "members read" on membership_members for select using (true);
create policy "members write" on membership_members for all
  using (owns_complex((select complex_id from memberships m where m.id = membership_id)))
  with check (owns_complex((select complex_id from memberships m where m.id = membership_id)));

-- ---------- 6. FUNCIÓN SEGURA: repartir puntos al finalizar un torneo ----------
create or replace function award_tournament_points(t_id uuid, rows_json jsonb) returns void
language plpgsql security definer as $$
declare r jsonb;
begin
  if not exists (
    select 1 from tournaments t join complexes c on c.id = t.complex_id
    where t.id = t_id and (c.owner_id = auth.uid()
      or (select role from profiles where id = auth.uid()) = 'super_admin')
  ) then
    raise exception 'Solo el complejo dueño del torneo puede repartir puntos';
  end if;
  delete from ranking_points where ref_tournament_id = t_id; -- evita duplicar si se repite
  for r in select * from jsonb_array_elements(rows_json) loop
    insert into ranking_points (player_id, complex_id, rule_key, points, ref_tournament_id)
    values ((r->>'player_id')::uuid, (r->>'complex_id')::uuid, r->>'rule_key', (r->>'points')::int, t_id);
  end loop;
end $$;
