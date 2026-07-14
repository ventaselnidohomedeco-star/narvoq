-- ============================================================
-- Demo: Torneo estilo Mundial (16 parejas, 32 jugadores)
-- Formato: Fase de grupos (4 grupos de 4) → 8vos → 4tos → Semis → Final
-- Requiere al menos 32 jugadores en profiles (correr demo-data.sql primero)
-- ============================================================

-- Limpieza previa (idempotente)
delete from tournaments where name = 'Mundial NarvoQ · Edición 2026';

do $$
declare
  cx_id uuid;
  players uuid[];
  t uuid;
  p uuid[];
begin
  select id into cx_id from complexes where active limit 1;
  if cx_id is null then raise notice 'No hay complejo, saltando.'; return; end if;

  select array_agg(id) into players from (
    select id from profiles where role = 'player' order by created_at limit 32
  ) as pp;

  if coalesce(array_length(players, 1), 0) < 32 then
    raise notice 'Se necesitan 32 jugadores. Se saltea el demo.';
    return;
  end if;

  insert into tournaments (complex_id, template_key, name, rules, format, sex, categories, max_pairs, status, starts_on, ends_on)
  values (cx_id, 'mundial', 'Mundial NarvoQ · Edición 2026',
    'Formato mundial: 4 grupos de 4 parejas, top-2 clasifica a 8vos, luego 4tos, semis y final.',
    'zonas', null, '{}', 16, 'finalizado', current_date - interval '30 days', current_date - interval '3 days')
  returning id into t;

  -- 16 parejas distribuidas en 4 grupos de 4 (A B C D)
  insert into tournament_pairs (tournament_id, player1_id, player2_id, pair_name, zone, seed, status) values
    -- GRUPO A
    (t, players[1],  players[17], 'Los Cracks',      'A', 1,   'aprobada'),
    (t, players[2],  players[18], 'Bandeja Total',   'A', null,'aprobada'),
    (t, players[3],  players[19], 'Muro y Trueno',   'A', null,'aprobada'),
    (t, players[4],  players[20], 'Doble Amenaza',   'A', null,'aprobada'),
    -- GRUPO B
    (t, players[5],  players[21], 'Volea Fina',      'B', 2,   'aprobada'),
    (t, players[6],  players[22], 'Los Fantasmas',   'B', null,'aprobada'),
    (t, players[7],  players[23], 'Rojas y Blancos', 'B', null,'aprobada'),
    (t, players[8],  players[24], 'Cañones',         'B', null,'aprobada'),
    -- GRUPO C
    (t, players[9],  players[25], 'Presión Alta',    'C', 3,   'aprobada'),
    (t, players[10], players[26], 'Los Reyes',       'C', null,'aprobada'),
    (t, players[11], players[27], 'Río de la Plata', 'C', null,'aprobada'),
    (t, players[12], players[28], 'Contragolpe',     'C', null,'aprobada'),
    -- GRUPO D
    (t, players[13], players[29], 'Los Silenciosos', 'D', 4,   'aprobada'),
    (t, players[14], players[30], 'Reverso',         'D', null,'aprobada'),
    (t, players[15], players[31], 'Chiquiterapia',   'D', null,'aprobada'),
    (t, players[16], players[32], 'Sin Piedad',      'D', null,'aprobada');

  select array_agg(id order by created_at) into p from tournament_pairs where tournament_id = t;
  -- p[1..4] = grupo A, p[5..8] = B, p[9..12] = C, p[13..16] = D

  -- ==== FASE DE GRUPOS (6 partidos por grupo, todos contra todos) ====
  -- Grupo A: p[1] p[2] p[3] p[4]
  insert into tournament_matches (tournament_id, round, pair1_id, pair2_id, winner_pair_id, score, order_index) values
    (t, 'Zona A', p[1], p[2], p[1], '6-3 6-4', 1),
    (t, 'Zona A', p[3], p[4], p[3], '7-5 6-2', 2),
    (t, 'Zona A', p[1], p[3], p[1], '6-4 6-4', 3),
    (t, 'Zona A', p[2], p[4], p[2], '6-3 6-3', 4),
    (t, 'Zona A', p[1], p[4], p[1], '6-1 6-2', 5),
    (t, 'Zona A', p[2], p[3], p[3], '4-6 6-3 6-4', 6),
  -- Grupo B: p[5] p[6] p[7] p[8]
    (t, 'Zona B', p[5], p[6], p[5], '6-4 7-5', 7),
    (t, 'Zona B', p[7], p[8], p[8], '4-6 6-3 6-2', 8),
    (t, 'Zona B', p[5], p[7], p[5], '6-3 6-4', 9),
    (t, 'Zona B', p[6], p[8], p[6], '7-5 6-4', 10),
    (t, 'Zona B', p[5], p[8], p[5], '6-2 6-3', 11),
    (t, 'Zona B', p[6], p[7], p[6], '6-4 6-4', 12),
  -- Grupo C: p[9] p[10] p[11] p[12]
    (t, 'Zona C', p[9],  p[10], p[9],  '6-4 6-3', 13),
    (t, 'Zona C', p[11], p[12], p[11], '7-6 6-4', 14),
    (t, 'Zona C', p[9],  p[11], p[9],  '6-2 6-1', 15),
    (t, 'Zona C', p[10], p[12], p[10], '4-6 7-5 6-3', 16),
    (t, 'Zona C', p[9],  p[12], p[9],  '6-3 6-2', 17),
    (t, 'Zona C', p[10], p[11], p[10], '6-4 6-4', 18),
  -- Grupo D: p[13] p[14] p[15] p[16]
    (t, 'Zona D', p[13], p[14], p[13], '6-3 6-4', 19),
    (t, 'Zona D', p[15], p[16], p[15], '6-4 6-2', 20),
    (t, 'Zona D', p[13], p[15], p[13], '7-5 6-3', 21),
    (t, 'Zona D', p[14], p[16], p[14], '6-4 4-6 6-2', 22),
    (t, 'Zona D', p[13], p[16], p[13], '6-1 6-3', 23),
    (t, 'Zona D', p[14], p[15], p[15], '4-6 7-6 6-3', 24);

  -- Clasificados (top-2 de cada grupo según los resultados de arriba):
  -- A: 1º p[1] (Los Cracks), 2º p[3] (Muro y Trueno) — ambos con 3 wins
  -- B: 1º p[5] (Volea Fina) 3W, 2º p[6] (Los Fantasmas) 2W
  -- C: 1º p[9] (Presión Alta) 3W, 2º p[10] (Los Reyes) 2W
  -- D: 1º p[13] (Los Silenciosos) 3W, 2º p[15] (Chiquiterapia) 2W

  -- ==== OCTAVOS DE FINAL (llaves cruzando grupos) ====
  -- Como somos 8 clasificados, es directo a cuartos, pero para mostrar
  -- "16avos → 8vos → 4tos → semis → final" agregamos también 16vos ficticios
  -- que ya se completaron (ranking + cabezas de serie).
  -- Simulamos que hubo 16vos previos donde entraron los 32 jugadores como
  -- 16 parejas y bajaron a las 8 que muestra fase de grupos.
  -- OPCIÓN práctica: mostrar solo los 4 grupos → 8vos → 4tos → semis → final.

  -- ==== OCTAVOS DE FINAL ====
  -- 8vos: cruzan 1ºA vs 2ºB, 1ºB vs 2ºA, 1ºC vs 2ºD, 1ºD vs 2ºC, y las repes al revés.
  -- Como tenemos solo 8 clasificados, hacemos 4 partidos de 8vos que decidirán 4tos.
  insert into tournament_matches (tournament_id, round, pair1_id, pair2_id, winner_pair_id, score, order_index) values
    (t, 'Octavos', p[1],  p[6],  p[1],  '6-4 6-4', 25),   -- 1ºA vs 2ºB
    (t, 'Octavos', p[5],  p[3],  p[5],  '7-5 6-3', 26),   -- 1ºB vs 2ºA
    (t, 'Octavos', p[9],  p[15], p[9],  '6-4 3-6 6-4', 27), -- 1ºC vs 2ºD
    (t, 'Octavos', p[13], p[10], p[13], '6-2 6-4', 28);   -- 1ºD vs 2ºC

  -- ==== CUARTOS DE FINAL ====
  insert into tournament_matches (tournament_id, round, pair1_id, pair2_id, winner_pair_id, score, order_index) values
    (t, 'Cuartos', p[1], p[5],  p[1],  '6-3 4-6 6-4', 29),
    (t, 'Cuartos', p[9], p[13], p[13], '6-4 6-3',    30);

  -- ==== SEMIFINALES ====
  insert into tournament_matches (tournament_id, round, pair1_id, pair2_id, winner_pair_id, score, order_index) values
    (t, 'Semifinal', p[1], p[13], p[1], '7-5 6-4', 31);

  -- ==== FINAL ====
  insert into tournament_matches (tournament_id, round, pair1_id, pair2_id, winner_pair_id, score, order_index) values
    (t, 'Final', p[1], p[5], p[1], '6-4 3-6 6-4', 32);
  -- p[1] = "Los Cracks" campeón del Mundial NarvoQ

  raise notice 'Mundial NarvoQ 2026 generado: 16 parejas, 4 grupos + 8vos + 4tos + semis + final.';
end $$;
