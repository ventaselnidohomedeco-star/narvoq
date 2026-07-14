-- ============================================================
-- Actualización 17 — Torneos PRO (motor determinístico)
-- Agrega esquema completo para gestión automática de torneos:
-- grupos, standings, sets, walkover, jugadores provisionales, auditoría.
-- Compatible hacia atrás: no borra tablas viejas.
-- Ejecutar UNA VEZ en el SQL Editor de Supabase (idempotente).
-- ============================================================

-- 1) Extender tournaments para soportar profe como dueño + config del motor
alter table tournaments add column if not exists owner_coach_id uuid references profiles(id) on delete set null;
alter table tournaments add column if not exists owner_type text;   -- 'complex' | 'coach'
alter table tournaments add column if not exists engine text not null default 'v1';   -- 'v1' (legacy) | 'v2' (motor pro)
alter table tournaments add column if not exists points_win int not null default 3;
alter table tournaments add column if not exists points_loss int not null default 0;
alter table tournaments add column if not exists match_format text not null default 'best_of_3_super_tb';
-- 'best_of_3_super_tb' | 'best_of_3_full' | 'single_set' | 'super_tiebreak'
alter table tournaments add column if not exists group_size int not null default 4;   -- tamaño preferido
alter table tournaments add column if not exists tiebreak_rules jsonb not null default
  '["pts","head_to_head","mini_table","set_diff","game_diff","games_won","random"]'::jsonb;
alter table tournaments add column if not exists preview_config jsonb;  -- snapshot del preview antes de generar

-- complex_id ahora puede ser null (si es de un profe)
alter table tournaments alter column complex_id drop not null;

-- Chequeo: al menos uno de los dos dueños
alter table tournaments drop constraint if exists tournaments_owner_check;
alter table tournaments add constraint tournaments_owner_check
  check (complex_id is not null or owner_coach_id is not null);

-- 2) Parejas con jugadores provisionales (sin cuenta en la app)
alter table tournament_pairs alter column player1_id drop not null;
alter table tournament_pairs alter column player2_id drop not null;
alter table tournament_pairs add column if not exists provisional_p1_name text;
alter table tournament_pairs add column if not exists provisional_p2_name text;
alter table tournament_pairs add column if not exists provisional_p1_phone text;
alter table tournament_pairs add column if not exists provisional_p2_phone text;

-- Antes había constraints uniques que ahora estorban si son null
alter table tournament_pairs drop constraint if exists tournament_pairs_tournament_id_player1_id_key;
alter table tournament_pairs drop constraint if exists tournament_pairs_tournament_id_player2_id_key;

-- 3) Grupos físicos (metadata del grupo A, B, C…)
create table if not exists tournament_groups (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  label text not null,         -- 'A', 'B', ...
  size int not null,           -- 3 o 4 parejas
  order_index int not null default 0,
  unique (tournament_id, label)
);
alter table tournament_groups enable row level security;
drop policy if exists "tgroups read" on tournament_groups;
create policy "tgroups read" on tournament_groups for select using (true);
drop policy if exists "tgroups write" on tournament_groups;
create policy "tgroups write" on tournament_groups for all
  using (
    owns_complex((select complex_id from tournaments t where t.id = tournament_id))
    or (select owner_coach_id from tournaments t where t.id = tournament_id) = auth.uid()
    or my_role() = 'super_admin'
  ) with check (
    owns_complex((select complex_id from tournaments t where t.id = tournament_id))
    or (select owner_coach_id from tournaments t where t.id = tournament_id) = auth.uid()
    or my_role() = 'super_admin'
  );

-- 4) Membresías de parejas en grupos (con posición final)
create table if not exists group_memberships (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references tournament_groups(id) on delete cascade,
  pair_id uuid not null references tournament_pairs(id) on delete cascade,
  seed int,                    -- posición sembrada 1..N
  final_position int,          -- posición final en grupo (1..N)
  unique (group_id, pair_id),
  unique (pair_id)             -- pareja pertenece a UN solo grupo
);
alter table group_memberships enable row level security;
drop policy if exists "gmemb read" on group_memberships;
create policy "gmemb read" on group_memberships for select using (true);
drop policy if exists "gmemb write" on group_memberships;
create policy "gmemb write" on group_memberships for all
  using (
    owns_complex((select t.complex_id from tournament_groups g
                  join tournaments t on t.id = g.tournament_id where g.id = group_id))
    or (select t.owner_coach_id from tournament_groups g
        join tournaments t on t.id = g.tournament_id where g.id = group_id) = auth.uid()
    or my_role() = 'super_admin'
  ) with check (
    owns_complex((select t.complex_id from tournament_groups g
                  join tournaments t on t.id = g.tournament_id where g.id = group_id))
    or (select t.owner_coach_id from tournament_groups g
        join tournaments t on t.id = g.tournament_id where g.id = group_id) = auth.uid()
    or my_role() = 'super_admin'
  );

-- 5) Sets granulares (un partido = varias filas de sets)
create table if not exists match_sets (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references tournament_matches(id) on delete cascade,
  set_number int not null,       -- 1, 2, 3
  t1_games int not null,
  t2_games int not null,
  t1_tiebreak int,               -- si el set fue tiebreak, puntos del tiebreak
  t2_tiebreak int,
  is_super_tiebreak boolean not null default false,
  unique (match_id, set_number)
);
alter table match_sets enable row level security;
drop policy if exists "msets read" on match_sets;
create policy "msets read" on match_sets for select using (true);
drop policy if exists "msets write" on match_sets;
create policy "msets write" on match_sets for all
  using (
    owns_complex((select t.complex_id from tournament_matches tm
                  join tournaments t on t.id = tm.tournament_id where tm.id = match_id))
    or (select t.owner_coach_id from tournament_matches tm
        join tournaments t on t.id = tm.tournament_id where tm.id = match_id) = auth.uid()
    or my_role() = 'super_admin'
  ) with check (
    owns_complex((select t.complex_id from tournament_matches tm
                  join tournaments t on t.id = tm.tournament_id where tm.id = match_id))
    or (select t.owner_coach_id from tournament_matches tm
        join tournaments t on t.id = tm.tournament_id where tm.id = match_id) = auth.uid()
    or my_role() = 'super_admin'
  );

-- 6) Resultados especiales en tournament_matches
alter table tournament_matches add column if not exists special_result text;
-- 'walkover' | 'abandono' | 'dq' | 'suspendido' | null
alter table tournament_matches add column if not exists special_winner_pair_id uuid references tournament_pairs(id);
alter table tournament_matches add column if not exists notes text;

-- 7) Log de auditoría (quién cambió qué)
create table if not exists tournament_audit (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  actor_id uuid references profiles(id),
  action text not null,          -- 'create_bracket','record_result','correct_result','walkover','close','reopen'
  ref_id uuid,                   -- id del match/pair afectado
  payload jsonb,
  created_at timestamptz not null default now()
);
alter table tournament_audit enable row level security;
drop policy if exists "taudit read" on tournament_audit;
create policy "taudit read" on tournament_audit for select using (true);
drop policy if exists "taudit insert" on tournament_audit;
create policy "taudit insert" on tournament_audit for insert with check (auth.uid() is not null);

create index if not exists idx_taudit_tournament on tournament_audit(tournament_id, created_at desc);

-- 8) Actualizar policies de tournaments para permitir owner_coach_id
drop policy if exists "tournament write" on tournaments;
create policy "tournament write" on tournaments for all
  using (
    owns_complex(complex_id)
    or owner_coach_id = auth.uid()
    or my_role() = 'super_admin'
  ) with check (
    owns_complex(complex_id)
    or owner_coach_id = auth.uid()
    or my_role() = 'super_admin'
  );

-- Actualizar policy de tournament_matches también
drop policy if exists "tmatches write" on tournament_matches;
create policy "tmatches write" on tournament_matches for all
  using (
    owns_complex((select complex_id from tournaments where id = tournament_id))
    or (select owner_coach_id from tournaments where id = tournament_id) = auth.uid()
    or my_role() = 'super_admin'
  ) with check (
    owns_complex((select complex_id from tournaments where id = tournament_id))
    or (select owner_coach_id from tournaments where id = tournament_id) = auth.uid()
    or my_role() = 'super_admin'
  );

-- Y policy de tournament_pairs (para que los organizadores puedan aprobar/rechazar)
drop policy if exists "pairs write organizer" on tournament_pairs;
create policy "pairs write organizer" on tournament_pairs for update
  using (
    owns_complex((select complex_id from tournaments where id = tournament_id))
    or (select owner_coach_id from tournaments where id = tournament_id) = auth.uid()
    or my_role() = 'super_admin'
  );
