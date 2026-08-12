-- update-27-tournament-entry-fee.sql
-- Cada torneo puede tener un precio de inscripción por pareja.
-- La plataforma se queda con un % de comisión (default 2%).
-- El cobro real vendrá en fase posterior (MP Split Payments).

alter table tournaments add column if not exists entry_fee_ars integer default 0 not null;
alter table tournaments add column if not exists platform_commission_pct numeric(5,2) default 2.0 not null;
alter table tournaments add column if not exists poster_image_url text;

comment on column tournaments.entry_fee_ars is
  'Precio de inscripción por pareja, en pesos argentinos. 0 = torneo gratis.';
comment on column tournaments.platform_commission_pct is
  'Porcentaje que se lleva NarvoQ por cada inscripción cobrada (default 2%).';
comment on column tournaments.poster_image_url is
  'URL de la imagen promocional del torneo (opcional, la puede subir el organizador).';
