-- ============================================================
-- Demo: torneos finalizados de ejemplo
-- Genera 4 torneos históricos (americano, suma, cat4, semanal) con
-- parejas, fixture, resultados y campeones para poblar la sección
-- de torneos con datos reales de demostración.
--
-- REQUIERE:
--   - Ya haber corrido schema.sql, seed.sql y las migraciones update-*
--   - Al menos 1 complejo y 16 jugadores en la base
--   - (Ideal: correr después de demo-data.sql, que ya trae 40 jugadores)
--
-- Es idempotente por convención: usa nombres únicos y borra los
-- torneos previos que se generaron con este mismo script.
-- ============================================================

-- Limpiamos torneos demo previos (si se re-corre este script)
delete from tournaments where name in (
  'Americano de Verano · Enero',
  'Suma 13 · Febrero',
  'Circuito Cat. 4ta · Marzo',
  'Semanal Nocturno · Abril'
);

do $$
declare
  cx_id uuid;
  players uuid[];
  n int;
  t1 uuid; t2 uuid; t3 uuid; t4 uuid;
  p_ids uuid[];
begin
  -- Elegimos un complejo cualquiera (el primero activo)
  select id into cx_id from complexes where active limit 1;
  if cx_id is null then
    raise notice 'No hay complejo activo, saltando demo de torneos.';
    return;
  end if;

  -- Tomamos 16 jugadores cualesquiera
  select array_agg(id) into players from (
    select id from profiles where role = 'player' order by created_at limit 16
  ) as p;

  n := coalesce(array_length(players, 1), 0);
  if n < 8 then
    raise notice 'Solo hay % jugadores. Se saltea el demo (necesita >= 8).', n;
    return;
  end if;

  -- ==========================================================
  -- TORNEO 1: Americano de verano (formato liga rotativa)
  -- ==========================================================
  insert into tournaments (complex_id, template_key, name, rules, format, sex, categories, max_pairs, status, starts_on)
  values (cx_id, 'americano', 'Americano de Verano · Enero',
    'Formato americano: cada jugador rota compañero. Suma sus partidos ganados individuales.',
    'liga', null, '{}', 8, 'finalizado', current_date - interval '90 days')
  returning id into t1;

  -- Parejas rotativas (usamos 8 jugadores, formando 4 parejas fijas para simplificar)
  insert into tournament_pairs (tournament_id, player1_id, player2_id, pair_name, zone, status)
    values
    (t1, players[1], players[2], 'Amigos del pueblo', 'A', 'aprobada'),
    (t1, players[3], players[4], 'Los Halcones', 'A', 'aprobada'),
    (t1, players[5], players[6], 'Doble Bandeja', 'A', 'aprobada'),
    (t1, players[7], players[8], 'Rebote Rápido', 'A', 'aprobada');

  select array_agg(id order by created_at) into p_ids from tournament_pairs where tournament_id = t1;

  -- Partidos: todos contra todos (6 partidos)
  insert into tournament_matches (tournament_id, round, pair1_id, pair2_id, winner_pair_id, score, order_index) values
    (t1, 'Zona A', p_ids[1], p_ids[2], p_ids[1], '6-3 6-4', 1),
    (t1, 'Zona A', p_ids[3], p_ids[4], p_ids[3], '7-5 6-2', 2),
    (t1, 'Zona A', p_ids[1], p_ids[3], p_ids[3], '4-6 6-3 7-5', 3),
    (t1, 'Zona A', p_ids[2], p_ids[4], p_ids[2], '6-4 6-4', 4),
    (t1, 'Zona A', p_ids[1], p_ids[4], p_ids[1], '6-2 6-1', 5),
    (t1, 'Zona A', p_ids[2], p_ids[3], p_ids[3], '3-6 7-5 6-3', 6),
    (t1, 'Final', p_ids[3], p_ids[1], p_ids[3], '6-4 3-6 6-4', 7);

  -- ==========================================================
  -- TORNEO 2: Suma 13 · Febrero (zonas + eliminatorias)
  -- ==========================================================
  insert into tournaments (complex_id, template_key, name, rules, format, sex, categories, sum_target, sum_exact, max_pairs, status, starts_on)
  values (cx_id, 'suma_13', 'Suma 13 · Febrero',
    'Cat. suma exacta 13 entre los dos jugadores. Fase de grupos + semi + final.',
    'zonas', null, '{}', 13, true, 8, 'finalizado', current_date - interval '60 days')
  returning id into t2;

  insert into tournament_pairs (tournament_id, player1_id, player2_id, pair_name, zone, seed, status) values
    (t2, players[1], players[10], 'Bandeja Combinada', 'A', 1, 'aprobada'),
    (t2, players[3], players[12], 'Cachetazo', 'A', 4, 'aprobada'),
    (t2, players[5], players[14], 'Muralla', 'A', null, 'aprobada'),
    (t2, players[7], players[16], 'Reves de Oro', 'A', null, 'aprobada'),
    (t2, players[2], players[9],  'Volea Fina', 'B', 2, 'aprobada'),
    (t2, players[4], players[11], 'Fondo Blanco', 'B', 3, 'aprobada'),
    (t2, players[6], players[13], 'Presionadores', 'B', null, 'aprobada'),
    (t2, players[8], players[15], 'Tuco y Timba', 'B', null, 'aprobada');

  select array_agg(id order by created_at) into p_ids from tournament_pairs where tournament_id = t2;

  insert into tournament_matches (tournament_id, round, pair1_id, pair2_id, winner_pair_id, score, order_index) values
    -- Zona A
    (t2, 'Zona A', p_ids[1], p_ids[2], p_ids[1], '6-3 6-4', 1),
    (t2, 'Zona A', p_ids[3], p_ids[4], p_ids[4], '7-5 6-4', 2),
    (t2, 'Zona A', p_ids[1], p_ids[3], p_ids[1], '6-2 6-1', 3),
    (t2, 'Zona A', p_ids[2], p_ids[4], p_ids[2], '6-4 6-4', 4),
    (t2, 'Zona A', p_ids[1], p_ids[4], p_ids[1], '6-4 6-2', 5),
    (t2, 'Zona A', p_ids[2], p_ids[3], p_ids[2], '6-3 4-6 6-3', 6),
    -- Zona B
    (t2, 'Zona B', p_ids[5], p_ids[6], p_ids[5], '6-4 6-2', 7),
    (t2, 'Zona B', p_ids[7], p_ids[8], p_ids[7], '6-3 7-6', 8),
    (t2, 'Zona B', p_ids[5], p_ids[7], p_ids[5], '7-5 6-3', 9),
    (t2, 'Zona B', p_ids[6], p_ids[8], p_ids[6], '6-3 6-3', 10),
    (t2, 'Zona B', p_ids[5], p_ids[8], p_ids[5], '6-2 6-2', 11),
    (t2, 'Zona B', p_ids[6], p_ids[7], p_ids[7], '4-6 6-3 6-4', 12),
    -- Semis (1º A vs 2º B, 1º B vs 2º A)
    (t2, 'Semifinal', p_ids[1], p_ids[6], p_ids[1], '6-4 7-5', 13),
    (t2, 'Semifinal', p_ids[5], p_ids[2], p_ids[5], '3-6 6-3 6-4', 14),
    -- Final
    (t2, 'Final', p_ids[1], p_ids[5], p_ids[1], '6-3 4-6 7-5', 15);

  -- ==========================================================
  -- TORNEO 3: Cat 4ta · Marzo (eliminación directa)
  -- ==========================================================
  insert into tournaments (complex_id, template_key, name, rules, format, sex, categories, max_pairs, status, starts_on)
  values (cx_id, 'cat_4', 'Circuito Cat. 4ta · Marzo',
    'Categoría 4ta masculino. Eliminación directa 8 parejas.',
    'eliminacion', 'M', ARRAY[4], 8, 'finalizado', current_date - interval '30 days')
  returning id into t3;

  insert into tournament_pairs (tournament_id, player1_id, player2_id, pair_name, seed, status) values
    (t3, players[1], players[2], null, 1, 'aprobada'),
    (t3, players[3], players[4], null, 2, 'aprobada'),
    (t3, players[5], players[6], null, 3, 'aprobada'),
    (t3, players[7], players[8], null, 4, 'aprobada'),
    (t3, players[9], players[10], null, null, 'aprobada'),
    (t3, players[11], players[12], null, null, 'aprobada'),
    (t3, players[13], players[14], null, null, 'aprobada'),
    (t3, players[15], players[16], null, null, 'aprobada');

  select array_agg(id order by created_at) into p_ids from tournament_pairs where tournament_id = t3;

  insert into tournament_matches (tournament_id, round, pair1_id, pair2_id, winner_pair_id, score, order_index) values
    (t3, 'Cuartos', p_ids[1], p_ids[8], p_ids[1], '6-2 6-3', 1),
    (t3, 'Cuartos', p_ids[4], p_ids[5], p_ids[4], '6-4 7-5', 2),
    (t3, 'Cuartos', p_ids[3], p_ids[6], p_ids[3], '6-3 6-4', 3),
    (t3, 'Cuartos', p_ids[2], p_ids[7], p_ids[2], '6-2 6-2', 4),
    (t3, 'Semifinal', p_ids[1], p_ids[4], p_ids[1], '7-5 6-3', 5),
    (t3, 'Semifinal', p_ids[3], p_ids[2], p_ids[2], '4-6 6-3 6-4', 6),
    (t3, 'Final', p_ids[1], p_ids[2], p_ids[2], '6-4 3-6 7-6', 7);

  -- ==========================================================
  -- TORNEO 4: Semanal Nocturno · Abril (formato liga corta)
  -- ==========================================================
  insert into tournaments (complex_id, template_key, name, rules, format, sex, categories, max_pairs, status, starts_on)
  values (cx_id, 'semanal', 'Semanal Nocturno · Abril',
    'Semanal exprés: 4 parejas fijas, todos contra todos en una noche.',
    'round_robin', null, '{}', 4, 'finalizado', current_date - interval '10 days')
  returning id into t4;

  insert into tournament_pairs (tournament_id, player1_id, player2_id, pair_name, zone, status) values
    (t4, players[1], players[9],  'La 1 y la 9',   'Única', 'aprobada'),
    (t4, players[2], players[10], 'Pares y Nones', 'Única', 'aprobada'),
    (t4, players[3], players[11], 'Nocturnos',     'Única', 'aprobada'),
    (t4, players[4], players[12], 'Los del Bar',   'Única', 'aprobada');

  select array_agg(id order by created_at) into p_ids from tournament_pairs where tournament_id = t4;

  insert into tournament_matches (tournament_id, round, pair1_id, pair2_id, winner_pair_id, score, order_index) values
    (t4, 'Zona Única', p_ids[1], p_ids[2], p_ids[2], '4-6 6-3 6-4', 1),
    (t4, 'Zona Única', p_ids[3], p_ids[4], p_ids[3], '6-3 6-2', 2),
    (t4, 'Zona Única', p_ids[1], p_ids[3], p_ids[1], '6-4 6-3', 3),
    (t4, 'Zona Única', p_ids[2], p_ids[4], p_ids[2], '6-2 6-4', 4),
    (t4, 'Zona Única', p_ids[1], p_ids[4], p_ids[1], '6-1 6-3', 5),
    (t4, 'Zona Única', p_ids[2], p_ids[3], p_ids[2], '7-5 6-4', 6),
    (t4, 'Final', p_ids[2], p_ids[1], p_ids[2], '7-6 4-6 6-3', 7);

  raise notice 'Demo de torneos generado: 4 torneos, 28 parejas, 42 partidos.';
end $$;
