-- ============================================================
-- PadelApp — Schema Supabase (Postgres)
-- Ejecutar en el SQL Editor de Supabase, luego seed.sql
-- ============================================================

-- ---------- ENUMS ----------
create type user_role as enum ('player','complex_admin','super_admin');
create type sex_type as enum ('M','F','X');
create type booking_status as enum ('pendiente','confirmada','completa','cancelada','jugada');
create type booking_type as enum ('reserva','block');
create type tournament_status as enum ('borrador','inscripcion','completo','en_juego','finalizado');
create type tournament_format as enum ('eliminacion','zonas','round_robin','liga');
create type result_status as enum ('pendiente','validado','corregido');
create type training_type as enum ('tecnica','fisico','clase_individual','clase_grupal','partido_entrenamiento');

-- ---------- CIUDADES ----------
create table cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  province text not null default 'Buenos Aires',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- PERFILES (extiende auth.users) ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'player',
  username text unique not null,
  first_name text not null,
  last_name text not null,
  phone text not null,
  age int check (age between 10 and 99),
  sex sex_type not null default 'M',
  city_id uuid references cities(id),
  zone text,                                  -- zona/localidad libre
  category int not null default 8 check (category between 1 and 8), -- 1 mejor, 8 principiante
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ---------- COMPLEJOS ----------
create table complexes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id),  -- rol complex_admin
  name text not null,
  responsible text not null,
  phone text not null,
  email text not null,
  city_id uuid not null references cities(id),
  address text not null,
  logo_url text,
  photos text[] default '{}',
  open_time time not null default '08:00',
  close_time time not null default '00:00',
  slot_minutes int not null default 90,            -- duración del turno
  cancel_hours int not null default 6,             -- horas mínimas para cancelar
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- CANCHAS ----------
create table courts (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references complexes(id) on delete cascade,
  name text not null,                              -- "Cancha 1"
  surface text default 'cemento',                  -- cemento | sintetico | cristal
  covered boolean default false,
  price_per_slot numeric(10,2) not null default 0,
  active boolean not null default true
);

-- ---------- RESERVAS (bloqueos incluidos) ----------
create table bookings (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references courts(id) on delete cascade,
  player_id uuid references profiles(id),          -- null si es bloqueo del complejo
  type booking_type not null default 'reserva',
  status booking_status not null default 'pendiente',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  price numeric(10,2),
  notes text,
  created_at timestamptz not null default now(),
  constraint valid_range check (ends_at > starts_at)
);
-- impide doble reserva sobre la misma cancha
create extension if not exists btree_gist;
alter table bookings add constraint no_overlap
  exclude using gist (
    court_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status <> 'cancelada');

-- ---------- PARTIDOS ----------
create table matches (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete cascade,
  tournament_match_id uuid,                        -- fk lógica a tournament_matches
  creator_id uuid not null references profiles(id),
  suggested_category int check (suggested_category between 1 and 8),
  sex_filter sex_type,                             -- null = abierto
  invite_code text unique not null default substr(md5(random()::text),1,8),
  status booking_status not null default 'pendiente',
  created_at timestamptz not null default now()
);

create table match_players (
  match_id uuid not null references matches(id) on delete cascade,
  player_id uuid not null references profiles(id),
  team int check (team in (1,2)),
  confirmed boolean not null default true,
  primary key (match_id, player_id)
);

create table waitlist (
  match_id uuid not null references matches(id) on delete cascade,
  player_id uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

-- ---------- TORNEOS ----------
create table tournaments (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references complexes(id) on delete cascade,
  template_key text not null,                      -- ej: 'suma_13', 'cat_4', ver plantillas.ts
  name text not null,
  rules text,                                      -- reglamento editable
  format tournament_format not null default 'zonas',
  sex sex_type,                                    -- null = mixto/abierto
  categories int[] default '{}',                   -- categorías permitidas
  sum_target int,                                  -- para torneos suma (10..18)
  sum_exact boolean default false,                 -- suma exacta o mínima
  max_pairs int not null default 16,
  status tournament_status not null default 'borrador',
  starts_on date,
  poster_url text,
  created_at timestamptz not null default now()
);

create table tournament_pairs (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  player1_id uuid not null references profiles(id),
  player2_id uuid not null references profiles(id),
  pair_name text,
  zone text,                                       -- 'A','B',...
  seed int,
  created_at timestamptz not null default now(),
  unique (tournament_id, player1_id),
  unique (tournament_id, player2_id)
);

create table tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  round text not null,                             -- 'Zona A', 'Cuartos', 'Semi', 'Final'
  pair1_id uuid references tournament_pairs(id),
  pair2_id uuid references tournament_pairs(id),
  court_id uuid references courts(id),
  scheduled_at timestamptz,
  winner_pair_id uuid references tournament_pairs(id),
  score text,                                      -- '6-4 3-6 7-5'
  order_index int not null default 0
);

-- ---------- RESULTADOS ----------
create table results (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  reported_by uuid not null references profiles(id),
  sets jsonb not null,                             -- [{"t1":6,"t2":4},...]
  winner_team int not null check (winner_team in (1,2)),
  status result_status not null default 'pendiente',
  validated_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- RANKING ----------
-- Variables editables por complejo (null complex_id = reglas globales default)
create table ranking_rules (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid references complexes(id) on delete cascade,
  rule_key text not null,      -- 'match_won','match_lost','tournament_played','champion',
                               -- 'finalist','semifinalist','set_diff','game_diff',
                               -- 'monthly_activity','no_show','vs_higher_cat','participation'
  points int not null,
  unique (complex_id, rule_key)
);

-- Ledger: cada evento suma/resta puntos. El ranking es un SUM.
create table ranking_points (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references profiles(id),
  complex_id uuid references complexes(id),
  rule_key text not null,
  points int not null,
  ref_match_id uuid references matches(id),
  ref_tournament_id uuid references tournaments(id),
  created_at timestamptz not null default now()
);
create index idx_ranking_player on ranking_points(player_id);
create index idx_ranking_complex on ranking_points(complex_id);

-- Vista de ranking general (filtrable por ciudad/categoría/sexo desde el cliente)
create view v_ranking as
select p.id as player_id, p.username, p.first_name, p.last_name,
       p.category, p.sex, p.city_id,
       rp.complex_id,
       sum(rp.points)::int as points
from ranking_points rp
join profiles p on p.id = rp.player_id
group by p.id, rp.complex_id;

-- ---------- ENTRENAMIENTOS ----------
create table trainings (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references profiles(id) on delete cascade,
  type training_type not null,
  date date not null default current_date,
  duration_min int not null default 60,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- FEED ----------
create table posts (
  id uuid primary key default gen_random_uuid(),
  author_profile_id uuid references profiles(id),
  author_complex_id uuid references complexes(id),
  kind text not null default 'manual',  -- reserva_confirmada | busco_jugadores | partido_completo
                                        -- resultado | inscripcion | torneo_abierto | fixture
                                        -- campeones | ranking | promo | evento | entrenamiento | manual
  text_content text,
  image_url text,
  ref_match_id uuid references matches(id),
  ref_tournament_id uuid references tournaments(id),
  tagged_players uuid[] default '{}',
  created_at timestamptz not null default now(),
  check (author_profile_id is not null or author_complex_id is not null)
);

create table post_likes (
  post_id uuid references posts(id) on delete cascade,
  player_id uuid references profiles(id) on delete cascade,
  primary key (post_id, player_id)
);

create table post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  player_id uuid not null references profiles(id),
  text_content text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles enable row level security;
alter table complexes enable row level security;
alter table courts enable row level security;
alter table bookings enable row level security;
alter table matches enable row level security;
alter table match_players enable row level security;
alter table waitlist enable row level security;
alter table tournaments enable row level security;
alter table tournament_pairs enable row level security;
alter table tournament_matches enable row level security;
alter table results enable row level security;
alter table ranking_rules enable row level security;
alter table ranking_points enable row level security;
alter table trainings enable row level security;
alter table posts enable row level security;
alter table post_likes enable row level security;
alter table post_comments enable row level security;
alter table cities enable row level security;

-- helpers
create or replace function my_role() returns user_role language sql stable as
$$ select role from profiles where id = auth.uid() $$;

create or replace function owns_complex(cid uuid) returns boolean language sql stable as
$$ select exists(select 1 from complexes where id = cid and owner_id = auth.uid()) $$;

-- Lectura pública de catálogo
create policy "cities read" on cities for select using (true);
create policy "complexes read" on complexes for select using (true);
create policy "courts read" on courts for select using (true);
create policy "profiles read" on profiles for select using (true);
create policy "tournaments read" on tournaments for select using (true);
create policy "pairs read" on tournament_pairs for select using (true);
create policy "tmatches read" on tournament_matches for select using (true);
create policy "posts read" on posts for select using (true);
create policy "likes read" on post_likes for select using (true);
create policy "comments read" on post_comments for select using (true);
create policy "ranking read" on ranking_points for select using (true);
create policy "rules read" on ranking_rules for select using (true);
create policy "bookings read" on bookings for select using (true);  -- necesario para grilla de disponibilidad
create policy "matches read" on matches for select using (true);
create policy "mplayers read" on match_players for select using (true);
create policy "waitlist read" on waitlist for select using (true);

-- Escritura
create policy "profiles self" on profiles for insert with check (id = auth.uid());
create policy "profiles update self" on profiles for update using (id = auth.uid());

create policy "complex insert" on complexes for insert with check (owner_id = auth.uid());
create policy "complex update" on complexes for update using (owner_id = auth.uid() or my_role() = 'super_admin');

create policy "courts write" on courts for all
  using (owns_complex(complex_id) or my_role() = 'super_admin')
  with check (owns_complex(complex_id) or my_role() = 'super_admin');

create policy "booking insert" on bookings for insert with check (
  (type = 'reserva' and player_id = auth.uid())
  or (type = 'block' and owns_complex((select complex_id from courts where id = court_id)))
);
create policy "booking update" on bookings for update using (
  player_id = auth.uid()
  or owns_complex((select complex_id from courts where id = court_id))
  or my_role() = 'super_admin'
);

create policy "match insert" on matches for insert with check (creator_id = auth.uid());
create policy "match update" on matches for update using (creator_id = auth.uid() or my_role() <> 'player');
create policy "mplayers write" on match_players for insert with check (player_id = auth.uid());
create policy "mplayers delete" on match_players for delete using (player_id = auth.uid());
create policy "waitlist write" on waitlist for insert with check (player_id = auth.uid());

create policy "tournament write" on tournaments for all
  using (owns_complex(complex_id) or my_role() = 'super_admin')
  with check (owns_complex(complex_id) or my_role() = 'super_admin');
create policy "pairs insert" on tournament_pairs for insert with check (
  player1_id = auth.uid() or player2_id = auth.uid()
  or owns_complex((select complex_id from tournaments where id = tournament_id))
);
create policy "tmatches write" on tournament_matches for all
  using (owns_complex((select complex_id from tournaments where id = tournament_id)))
  with check (owns_complex((select complex_id from tournaments where id = tournament_id)));

create policy "results insert" on results for insert with check (reported_by = auth.uid());
create policy "results validate" on results for update using (
  owns_complex((select c.complex_id from matches m
                join bookings b on b.id = m.booking_id
                join courts c on c.id = b.court_id
                where m.id = match_id))
  or my_role() = 'super_admin'
);

create policy "rules write" on ranking_rules for all
  using (owns_complex(complex_id) or my_role() = 'super_admin')
  with check (owns_complex(complex_id) or my_role() = 'super_admin');

-- Los puntos se insertan por trigger (security definer), no por el cliente
create policy "points no client write" on ranking_points for insert with check (my_role() = 'super_admin');

create policy "trainings all self" on trainings for all
  using (player_id = auth.uid()) with check (player_id = auth.uid());

create policy "posts insert" on posts for insert with check (
  author_profile_id = auth.uid()
  or (author_complex_id is not null and owns_complex(author_complex_id))
);
create policy "likes write" on post_likes for all
  using (player_id = auth.uid()) with check (player_id = auth.uid());
create policy "comments write" on post_comments for insert with check (player_id = auth.uid());

-- ============================================================
-- TRIGGER: al validar un resultado, impacta el ranking
-- ============================================================
create or replace function apply_result_points() returns trigger
language plpgsql security definer as $$
declare
  cx uuid;
  pts_won int; pts_lost int; pts_setdiff int;
  s jsonb; sets_t1 int := 0; sets_t2 int := 0;
  pl record;
begin
  if new.status = 'validado' and old.status = 'pendiente' then
    select c.complex_id into cx
      from matches m
      join bookings b on b.id = m.booking_id
      join courts c on c.id = b.court_id
      where m.id = new.match_id;

    -- reglas del complejo o default global (complex_id null)
    select coalesce(
      (select points from ranking_rules where complex_id = cx and rule_key='match_won'),
      (select points from ranking_rules where complex_id is null and rule_key='match_won'), 10) into pts_won;
    select coalesce(
      (select points from ranking_rules where complex_id = cx and rule_key='match_lost'),
      (select points from ranking_rules where complex_id is null and rule_key='match_lost'), 3) into pts_lost;
    select coalesce(
      (select points from ranking_rules where complex_id = cx and rule_key='set_diff'),
      (select points from ranking_rules where complex_id is null and rule_key='set_diff'), 2) into pts_setdiff;

    for s in select * from jsonb_array_elements(new.sets) loop
      if (s->>'t1')::int > (s->>'t2')::int then sets_t1 := sets_t1 + 1;
      else sets_t2 := sets_t2 + 1; end if;
    end loop;

    for pl in select player_id, team from match_players where match_id = new.match_id loop
      if pl.team = new.winner_team then
        insert into ranking_points(player_id, complex_id, rule_key, points, ref_match_id)
        values (pl.player_id, cx, 'match_won', pts_won, new.match_id),
               (pl.player_id, cx, 'set_diff', pts_setdiff * abs(sets_t1 - sets_t2), new.match_id);
      else
        insert into ranking_points(player_id, complex_id, rule_key, points, ref_match_id)
        values (pl.player_id, cx, 'match_lost', pts_lost, new.match_id);
      end if;
    end loop;

    update matches set status = 'jugada' where id = new.match_id;
  end if;
  return new;
end $$;

create trigger trg_apply_result_points
after update on results
for each row execute function apply_result_points();
