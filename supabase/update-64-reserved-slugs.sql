-- Fase 1.1: proteger slugs contra colisión con rutas de Next.js
-- (Al mover /r/<slug> a /<slug>/turnosdisponibles, cualquier slug igual a una
-- ruta estática (jugador, complejo, admin...) rompería esa ruta)

create or replace function is_reserved_slug(s text) returns boolean
language sql immutable as $$
  select s = any(array[
    'admin','api','auth','brand','complejo','completar-perfil','favicon.ico',
    'icons','jugador','login','logout','manifest.json','partido','r','recuperar',
    'registro','robots.txt','sitemap.xml','smash','sounds','sw.js','torneo',
    'training','u','turnosdisponibles','_next','static','public'
  ]);
$$;

-- Actualizar trigger de complexes para rechazar slugs reservados y
-- añadir sufijo automático si colisiona
create or replace function complexes_set_slug()
returns trigger language plpgsql as $$
declare
  base_slug text;
  final_slug text;
  n int;
begin
  if new.slug is null or new.slug = '' then
    base_slug := slugify(new.name);
    if base_slug = '' or is_reserved_slug(base_slug) then
      base_slug := 'complejo-' || substr(new.id::text, 1, 6);
    end if;
    final_slug := base_slug;
    n := 1;
    while exists(select 1 from complexes where slug = final_slug and id <> new.id)
       or is_reserved_slug(final_slug) loop
      n := n + 1;
      final_slug := base_slug || '-' || n;
    end loop;
    new.slug := final_slug;
  elsif is_reserved_slug(new.slug) then
    raise exception 'El slug "%" está reservado. Elegí otro.', new.slug
      using errcode = 'P0001';
  end if;
  return new;
end $$;

-- Backfill: si algún complejo tiene un slug reservado (raro pero puede pasar), renombrarlo
do $$
declare
  c record;
  new_slug text;
begin
  for c in select id, name, slug from complexes where is_reserved_slug(slug) loop
    new_slug := slugify(c.name) || '-' || substr(c.id::text, 1, 6);
    update complexes set slug = new_slug where id = c.id;
  end loop;
end $$;

notify pgrst, 'reload schema';
