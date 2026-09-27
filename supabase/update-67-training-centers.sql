-- =====================================================================
-- update-67-training-centers.sql
-- Sprint 1 · Día 1 — Centros de Entrenamiento (Fase 1 del módulo B2B)
--
-- Concepto: entidad "Centro de Entrenamiento" (ej: OLD PRO) que agrupa
-- un Master Coach + N Coaches + N Asistentes + N Alumnos, y trackea
-- horas cumplidas en los 5 pilares (Filosofía, GYM, Psico, Nutri, Cancha)
-- =====================================================================

-- 1) Enum: rango dentro del centro
do $$ begin
  create type center_role as enum ('master','coach','assistant','student');
exception when duplicate_object then null; end $$;

-- 2) Enum: pilares del entrenamiento
do $$ begin
  create type training_pillar as enum ('filosofia','gym','psicologia','nutricion','cancha');
exception when duplicate_object then null; end $$;

-- 3) Tabla principal: training_centers
create table if not exists training_centers (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,                       -- "OLD PRO Training Center"
  brand text,                               -- "OLD PRO" (marca de paletas)
  logo_url text,
  cover_url text,
  address text,
  locality text,
  province text,
  city_id uuid references cities(id),
  phone text,
  whatsapp text,
  email text,
  website text,
  instagram text,
  bio text,                                 -- descripción larga
  hourly_rate numeric(10,2) default 0,      -- precio base de la clase
  complex_id uuid references complexes(id), -- opcional: si opera dentro de un complejo NarvoQ
  created_by uuid references profiles(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Trigger para autogenerar slug desde name
create or replace function training_centers_set_slug()
returns trigger language plpgsql as $$
declare
  base_slug text; final_slug text; n int;
begin
  if new.slug is null or new.slug = '' then
    base_slug := slugify(new.name);
    if base_slug = '' or is_reserved_slug(base_slug) then
      base_slug := 'centro-' || substr(new.id::text, 1, 6);
    end if;
    final_slug := base_slug; n := 1;
    while exists(select 1 from training_centers where slug = final_slug and id <> new.id)
       or exists(select 1 from complexes where slug = final_slug)
       or is_reserved_slug(final_slug) loop
      n := n + 1; final_slug := base_slug || '-' || n;
    end loop;
    new.slug := final_slug;
  end if;
  return new;
end $$;

drop trigger if exists trg_training_centers_set_slug on training_centers;
create trigger trg_training_centers_set_slug
before insert on training_centers
for each row execute procedure training_centers_set_slug();

-- 4) Membresías del centro: quién es master, coach, asistente o alumno
create table if not exists center_members (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references training_centers(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role center_role not null,
  reports_to uuid references profiles(id),       -- coach reporta a master, assistant a coach
  -- Datos "profesionales" opcionales (solo relevante para staff)
  title text,                                    -- "PRO COACH", "MASTER COACH", "Asistente Senior"
  specialty text,                                -- "Competición · Menores · Técnica"
  years_experience int,
  bio text,
  hourly_rate numeric(10,2),                     -- lo que gana por hora (staff)
  -- Cobro mensual al alumno (solo aplica si role='student')
  monthly_fee numeric(10,2),                     -- ej: 1000 ARS/mes
  payment_status text default 'al_dia',          -- al_dia | vencido | prueba | suspendido
  next_billing_date date,                        -- próxima fecha de cobro
  -- Estadísticas (se actualizan por trigger, no manual)
  active boolean not null default true,
  joined_at timestamptz not null default now(),
  unique (center_id, profile_id)
);

create index if not exists idx_center_members_center on center_members(center_id);
create index if not exists idx_center_members_profile on center_members(profile_id);
create index if not exists idx_center_members_reports_to on center_members(reports_to);

-- 5) Sesiones de pilares: cada vez que un alumno completa X horas de un pilar
-- (una clase de cancha, una sesión de GYM, una consulta con la nutricionista…)
create table if not exists pillar_sessions (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references training_centers(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  pillar training_pillar not null,
  date date not null default current_date,
  hours numeric(4,2) not null default 1,          -- ej: 1.5 horas
  coach_id uuid references profiles(id),          -- quién dictó la sesión
  assistant_id uuid references profiles(id),      -- si además hubo asistente
  notes text,
  attended boolean not null default true,         -- false = ausente (cuenta para tasa de ausentismo)
  -- Para pilar 'nutricion': % de cumplimiento del plan semanal
  compliance_pct int check (compliance_pct is null or (compliance_pct between 0 and 100)),
  created_at timestamptz not null default now()
);

create index if not exists idx_pillar_sessions_center on pillar_sessions(center_id);
create index if not exists idx_pillar_sessions_student on pillar_sessions(student_id, date);
create index if not exists idx_pillar_sessions_coach on pillar_sessions(coach_id);
create index if not exists idx_pillar_sessions_pillar on pillar_sessions(pillar);

-- 6) Disponibilidad semanal (jugadores y coaches)
-- day_of_week 0=domingo, 1=lunes, ..., 6=sábado
create table if not exists weekly_availability (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  center_id uuid references training_centers(id) on delete cascade,   -- opcional: dispo específica de este centro
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  constraint valid_availability check (end_time > start_time)
);

create index if not exists idx_weekly_avail_profile on weekly_availability(profile_id);
create index if not exists idx_weekly_avail_center on weekly_availability(center_id);
create index if not exists idx_weekly_avail_day on weekly_availability(day_of_week);

-- =====================================================================
-- RLS
-- =====================================================================
alter table training_centers enable row level security;
alter table center_members enable row level security;
alter table pillar_sessions enable row level security;
alter table weekly_availability enable row level security;

-- Lectura pública (para perfiles de centros y coaches visibles)
create policy "training_centers read" on training_centers for select using (true);
create policy "center_members read" on center_members for select using (true);
create policy "pillar_sessions read own" on pillar_sessions for select using (
  student_id = auth.uid()
  or coach_id = auth.uid()
  or assistant_id = auth.uid()
  or exists (select 1 from center_members where center_id = pillar_sessions.center_id
             and profile_id = auth.uid() and role in ('master','coach','assistant'))
);
create policy "weekly_availability read" on weekly_availability for select using (true);

-- Insert: Master crea el centro (created_by = auth.uid())
create policy "training_centers insert" on training_centers for insert
  with check (created_by = auth.uid());

-- Update: solo el master (o admins) puede modificar el centro
create policy "training_centers update" on training_centers for update using (
  created_by = auth.uid()
  or exists (
    select 1 from center_members
    where center_id = training_centers.id
      and profile_id = auth.uid() and role = 'master'
  )
  or (select role from profiles where id = auth.uid()) = 'super_admin'
);

-- center_members: master invita/gestiona miembros
create policy "center_members insert master" on center_members for insert with check (
  -- El propio usuario puede agregarse como alumno de un centro
  (profile_id = auth.uid() and role = 'student')
  or
  -- El master del centro puede agregar a cualquiera
  exists (
    select 1 from center_members
    where center_id = center_members.center_id
      and profile_id = auth.uid() and role = 'master'
  )
  or
  -- El creador del centro también puede agregar
  exists (
    select 1 from training_centers
    where id = center_members.center_id and created_by = auth.uid()
  )
);

create policy "center_members update master" on center_members for update using (
  exists (
    select 1 from center_members cm
    where cm.center_id = center_members.center_id
      and cm.profile_id = auth.uid() and cm.role = 'master'
  )
);

create policy "center_members delete master" on center_members for delete using (
  exists (
    select 1 from center_members cm
    where cm.center_id = center_members.center_id
      and cm.profile_id = auth.uid() and cm.role = 'master'
  )
);

-- pillar_sessions: coach/master del centro puede insertar/actualizar
create policy "pillar_sessions insert staff" on pillar_sessions for insert with check (
  exists (
    select 1 from center_members
    where center_id = pillar_sessions.center_id
      and profile_id = auth.uid() and role in ('master','coach','assistant')
  )
);

create policy "pillar_sessions update staff" on pillar_sessions for update using (
  exists (
    select 1 from center_members
    where center_id = pillar_sessions.center_id
      and profile_id = auth.uid() and role in ('master','coach','assistant')
  )
);

-- weekly_availability: cada uno gestiona la suya
create policy "weekly_availability write self" on weekly_availability for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- =====================================================================
-- Vistas útiles (para dashboards y perfiles)
-- =====================================================================

-- Estadísticas por miembro del centro (calculadas en vivo, no cacheadas)
create or replace view v_center_member_stats as
select
  cm.center_id,
  cm.profile_id,
  cm.role,
  count(distinct ps.student_id) filter (where ps.coach_id = cm.profile_id or ps.assistant_id = cm.profile_id) as students_taught,
  coalesce(sum(ps.hours) filter (where ps.coach_id = cm.profile_id or ps.assistant_id = cm.profile_id), 0) as total_hours,
  coalesce(sum(ps.hours) filter (where (ps.coach_id = cm.profile_id or ps.assistant_id = cm.profile_id)
    and ps.date >= (current_date - interval '30 days')), 0) as hours_last_30d,
  count(*) filter (where (ps.coach_id = cm.profile_id or ps.assistant_id = cm.profile_id)
    and ps.attended = false) as absences_by_students
from center_members cm
left join pillar_sessions ps on ps.center_id = cm.center_id
where cm.role in ('master','coach','assistant')
group by cm.center_id, cm.profile_id, cm.role;

-- Progreso del alumno por pilar (horas del último mes)
create or replace view v_student_pillar_progress as
select
  ps.center_id,
  ps.student_id,
  ps.pillar,
  coalesce(sum(ps.hours) filter (where ps.date >= (current_date - interval '30 days')), 0) as hours_last_30d,
  coalesce(sum(ps.hours), 0) as hours_total,
  count(*) filter (where ps.attended = false and ps.date >= (current_date - interval '30 days')) as absences_last_30d,
  avg(ps.compliance_pct) filter (where ps.pillar = 'nutricion' and ps.compliance_pct is not null) as avg_nutrition_compliance
from pillar_sessions ps
group by ps.center_id, ps.student_id, ps.pillar;

notify pgrst, 'reload schema';
