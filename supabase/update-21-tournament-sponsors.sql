-- update-21-tournament-sponsors.sql
-- Agrega auspiciantes al torneo. Estructura simple JSON:
--   sponsors: [{ name: string, logo_url: string, url?: string }]
-- El organizador carga hasta N auspiciantes desde el panel; se dibujan
-- automáticamente en la parte inferior de las imágenes compartibles.

alter table tournaments add column if not exists sponsors jsonb default '[]'::jsonb;

comment on column tournaments.sponsors is
  'Lista JSON de auspiciantes: [{name, logo_url, url?}]. Se muestran en las imágenes generadas.';
