-- ============================================================
-- Seed inicial — correr después de schema.sql
-- ============================================================

-- Ciudad piloto + vecinas para la expansión
insert into cities (name, province) values
  ('San Miguel del Monte', 'Buenos Aires'),
  ('Lobos', 'Buenos Aires'),
  ('Cañuelas', 'Buenos Aires'),
  ('Roque Pérez', 'Buenos Aires');

-- Reglas de ranking globales por defecto (complex_id = null).
-- Cada complejo puede sobreescribirlas con su propio complex_id.
insert into ranking_rules (complex_id, rule_key, points) values
  (null, 'match_won',        10),
  (null, 'match_lost',        3),
  (null, 'tournament_played',15),
  (null, 'champion',        100),
  (null, 'finalist',         60),
  (null, 'semifinalist',     35),
  (null, 'set_diff',          2),
  (null, 'game_diff',         1),
  (null, 'monthly_activity', 10),
  (null, 'no_show',         -15),
  (null, 'vs_higher_cat',     5),
  (null, 'participation',     5);
