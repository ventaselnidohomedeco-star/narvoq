-- ============================================================
-- DEMO — Simulación de 6 meses de uso en San Miguel del Monte
-- Crea: 6 complejos + 40 jugadores + reservas + partidos +
-- resultados validados (ranking real) + torneos + feed + entrenamientos
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase.
-- Tarda 1-2 minutos. Todas las cuentas usan contraseña: demo123
--   Jugadores: jugador01@demo.com ... jugador40@demo.com
--   Complejos: complejo1@demo.com ... complejo6@demo.com
-- ============================================================

create extension if not exists pgcrypto;

do $$
declare
  v_city uuid;
  v_uid uuid;
  v_cx uuid;
  v_court uuid;
  v_booking uuid;
  v_match uuid;
  v_result uuid;
  v_pair uuid;
  v_post uuid;
  v_tid uuid;
  players uuid[] := '{}';
  cxs uuid[] := '{}';
  cx_courts uuid[];
  four uuid[];
  pool uuid[];
  first_names text[] := array['Matías','Lucas','Juan','Franco','Nicolás','Federico','Gonzalo','Martín','Agustín','Ezequiel',
    'Ramiro','Bruno','Diego','Pablo','Sebastián','Tomás','Ignacio','Facundo','Leandro','Maximiliano',
    'Sofía','Valentina','Camila','Martina','Lucía','Julieta','Agustina','Carolina','Florencia','Milagros',
    'Rocío','Antonella','Micaela','Paula','Daniela','Josefina','Guadalupe','Brenda','Celeste','Marina'];
  last_names text[] := array['Hernández','González','Rodríguez','Fernández','López','Martínez','Pérez','Gómez','Díaz','Torres',
    'Álvarez','Ruiz','Romero','Suárez','Benítez','Acosta','Medina','Herrera','Aguirre','Molina',
    'Castro','Ortiz','Silva','Núñez','Rojas','Vega','Cabrera','Ríos','Ferreyra','Sosa',
    'Ponce','Luna','Juárez','Campos','Vera','Peralta','Bravo','Paz','Quiroga','Villalba'];
  cx_names text[] := array['Monte Pádel Club','El Muro Pádel','La Cantera Pádel','Pádel del Parque','X3 Pádel Monte','Las Palmeras Pádel'];
  cx_addr text[] := array['Av. Costanera 1250','Belgrano 445','Ruta 3 km 108','San Martín 890','Alsina 233','Av. Eva Perón 1580'];
  rackets text[] := array['Bullpadel Vertex 04','Babolat Air Viper','Nox AT10 Luxury','Adidas Metalbone','Head Speed Pro','Siux Electra','Bullpadel Hack 03','Wilson Bela Pro'];
  bios text[] := array['Siempre listo para un partido 🎾','Drive letal, revés en obras 😅','El pádel es vida','Jugando desde 2020','Fanático del Monte pádel','Busco pareja para torneos','De lunes a lunes en la cancha','La bandeja es mi religión'];
  coaches text[] := array['Profe Martín','Profe Caro','Profe Seba','Academia Monte Pádel'];
  goals_arr text[] := array['Mejorar bandeja','Salida de pared','Volea más agresiva','Físico y movilidad','Víbora','Saque y subida'];
  post_texts text[] := array['Tremendo partido hoy, se definió en el super tie-break 🔥','¿Alguien para jugar el finde? Cat 5-6','Nueva paleta, a estrenar el sábado 🎾','Qué lindo está quedando el club','Tercer torneo del año, vamos por más','Golazo de ángulo hoy… digo, ganchazo 😂','Se viene el torneo suma, ¿quién se prende?','Gran nivel el de anoche en el Monte Pádel'];
  comment_texts text[] := array['Vamos! 💪','Qué nivel 🔥','Me prendo!','Grande!','Jaja buenísimo','A la final directo 🏆','Golazo','Avisá para la revancha'];
  i int; d int; h int; j int; k int;
  cat1 int; cat2 int; wt int; nsets int;
  v_sets jsonb;
  v_day date;
  v_start timestamptz;
  v_price numeric;
  n_courts int;
  is_future boolean;
begin
  select id into v_city from cities where name = 'San Miguel del Monte' limit 1;

  -- ============ 6 COMPLEJOS ============
  for i in 1..6 loop
    v_uid := gen_random_uuid();
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current)
    values (v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'complejo' || i || '@demo.com', crypt('demo123', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now() - interval '190 days', now(), '', '', '', '', '');

    insert into profiles (id, role, username, first_name, last_name, phone, age, sex, category, city_id)
    values (v_uid, 'complex_admin', 'complejo' || i, cx_names[i], '-', '2271-40' || (1000 + i * 111), 40, 'X', 8, v_city);

    insert into complexes (owner_id, name, responsible, phone, email, city_id, address,
      open_time, close_time, slot_minutes, whatsapp, instagram, services, logo_url, created_at)
    values (v_uid, cx_names[i], first_names[i] || ' ' || last_names[i], '2271-40' || (1000 + i * 111),
      'complejo' || i || '@demo.com', v_city, cx_addr[i] || ', San Miguel del Monte',
      '09:00', '23:00', 60, '54922714' || (10000 + i * 1111), replace(lower(cx_names[i]), ' ', ''),
      'Buffet, Vestuarios, Estacionamiento', 'https://api.dicebear.com/9.x/shapes/png?seed=' || replace(cx_names[i],' ',''), now() - interval '190 days')
    returning id into v_cx;
    cxs := cxs || v_cx;

    n_courts := 2 + (i % 3); -- 2, 3 o 4 canchas
    for j in 1..n_courts loop
      insert into courts (complex_id, name, surface, covered, price_per_slot, description)
      values (v_cx, 'Cancha ' || j,
        case when j = 1 then 'cristal' else 'cemento' end, j <= 2,
        16000 + i * 1000 + j * 500,
        case when j = 1 then 'Cancha de cristal panorámico con iluminación LED.' else 'Cancha techada de cemento alisado.' end);
    end loop;
  end loop;

  -- ============ 40 JUGADORES ============
  for i in 1..40 loop
    v_uid := gen_random_uuid();
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current)
    values (v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'jugador' || lpad(i::text, 2, '0') || '@demo.com', crypt('demo123', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now() - interval '185 days', now(), '', '', '', '', '');

    insert into profiles (id, role, username, first_name, last_name, phone, age, sex, city_id, zone, category,
      racket, side, bio, avatar_url)
    values (v_uid, 'player', 'jugador' || lpad(i::text, 2, '0'),
      first_names[i], last_names[i], '2271-5' || (10000 + i * 137),
      18 + (i * 7 % 40),
      (case when i <= 20 then 'M' else 'F' end)::sex_type,
      v_city, 'Centro', 2 + (i % 7),
      rackets[1 + (i % 8)],
      (array['drive','reves','ambos'])[1 + (i % 3)],
      bios[1 + (i % 8)],
      'https://api.dicebear.com/9.x/adventurer/png?seed=jugador' || i);
    players := players || v_uid;
  end loop;

  -- ============ 6 MESES DE RESERVAS + PARTIDOS + RESULTADOS ============
  for i in 1..6 loop
    v_cx := cxs[i];
    select array_agg(id) into cx_courts from courts where complex_id = v_cx;
    for d in 0..180 loop
      v_day := current_date - 180 + d;
      is_future := v_day >= current_date;
      exit when v_day > current_date + 6;
      foreach v_court in array cx_courts loop
        for h in 18..21 loop
          if random() < 0.28 then
            v_start := (v_day + make_time(h, 0, 0)) at time zone 'America/Argentina/Buenos_Aires';
            select price_per_slot into v_price from courts where id = v_court;
            insert into bookings (court_id, player_id, type, status, starts_at, ends_at, price)
            values (v_court, players[1 + floor(random() * 40)::int], 'reserva',
              (case when is_future then 'confirmada' else 'jugada' end)::booking_status,
              v_start, v_start + interval '60 minutes', v_price)
            returning id, player_id into v_booking, v_uid;

            -- partido con 4 jugadores (para el 55% de las reservas pasadas y todas las futuras)
            if is_future or random() < 0.55 then
              insert into matches (booking_id, creator_id, suggested_category, status)
              values (v_booking, v_uid, (select category from profiles where id = v_uid),
                (case when is_future then 'confirmada' else 'jugada' end)::booking_status)
              returning id into v_match;

              select array_agg(x) into four from (
                select unnest(players) as x order by random() limit 4
              ) q;
              -- asegurar que el creador esté
              if not v_uid = any(four) then four[1] := v_uid; end if;

              for j in 1..(case when is_future then 2 + floor(random() * 3)::int else 4 end) loop
                insert into match_players (match_id, player_id, team)
                values (v_match, four[j], case when j <= 2 then 1 else 2 end)
                on conflict do nothing;
              end loop;

              -- resultado validado solo para partidos pasados
              if not is_future then
                wt := 1 + floor(random() * 2)::int;
                nsets := 2 + floor(random() * 2)::int;
                if nsets = 2 then
                  v_sets := jsonb_build_array(
                    jsonb_build_object('t1', case when wt = 1 then 6 else floor(random() * 5)::int end,
                                       't2', case when wt = 2 then 6 else floor(random() * 5)::int end),
                    jsonb_build_object('t1', case when wt = 1 then 6 else floor(random() * 5)::int end,
                                       't2', case when wt = 2 then 6 else floor(random() * 5)::int end));
                else
                  v_sets := jsonb_build_array(
                    jsonb_build_object('t1', case when wt = 1 then 6 else 3 end, 't2', case when wt = 2 then 6 else 3 end),
                    jsonb_build_object('t1', case when wt = 1 then 4 else 6 end, 't2', case when wt = 2 then 4 else 6 end),
                    jsonb_build_object('t1', case when wt = 1 then 7 else 5 end, 't2', case when wt = 2 then 7 else 5 end));
                end if;
                insert into results (match_id, reported_by, sets, winner_team, status)
                values (v_match, four[1], v_sets, wt, 'pendiente')
                returning id into v_result;
                -- validar dispara el trigger que carga los puntos de ranking
                update results set status = 'validado', validated_by = (select owner_id from complexes where id = v_cx)
                where id = v_result;
              end if;
            end if;
          end if;
        end loop;
      end loop;
    end loop;
  end loop;

  -- ============ TORNEOS (6 finalizados + 2 abiertos) ============
  for i in 1..8 loop
    v_cx := cxs[1 + (i % 6)];
    insert into tournaments (complex_id, template_key, name, rules, format, sex, categories, sum_target, max_pairs, status, created_at)
    values (v_cx,
      case when i % 2 = 0 then 'suma_' || (11 + i) else 'cat_' || (2 + (i % 5)) end,
      case when i % 2 = 0 then 'Torneo Suma ' || (11 + i) else 'Torneo ' || (array['2da','3ra','4ta','5ta','6ta'])[1 + (i % 5)] end
        || case when i % 3 = 0 then ' Femenino' when i % 3 = 1 then ' Masculino' else '' end,
      'Zonas de 3 + cruces. Partidos a 2 sets con super tie-break.',
      'zonas',
      (case when i % 3 = 0 then 'F' when i % 3 = 1 then 'M' else null end)::sex_type,
      '{1,2,3,4,5,6,7,8}',
      case when i % 2 = 0 then 11 + i else null end,
      8,
      (case when i <= 6 then 'finalizado' else 'inscripcion' end)::tournament_status,
      now() - (interval '1 day' * (180 - i * 22)))
    returning id into v_tid;

    -- 8 parejas (16 jugadores distintos)
    select array_agg(x) into pool from (select unnest(players) as x order by random() limit 16) q;
    for j in 1..8 loop
      insert into tournament_pairs (tournament_id, player1_id, player2_id, zone)
      values (v_tid, pool[j * 2 - 1], pool[j * 2], chr(64 + ((j - 1) % 3 + 1)))
      returning id into v_pair;
    end loop;

    if i <= 6 then
      -- puntos de torneo: campeones, finalistas y participación
      for j in 1..16 loop
        insert into ranking_points (player_id, complex_id, rule_key, points, ref_tournament_id)
        values (pool[j], v_cx, 'tournament_played', 15, v_tid);
      end loop;
      insert into ranking_points (player_id, complex_id, rule_key, points, ref_tournament_id)
      values (pool[1], v_cx, 'champion', 100, v_tid), (pool[2], v_cx, 'champion', 100, v_tid),
             (pool[3], v_cx, 'finalist', 60, v_tid), (pool[4], v_cx, 'finalist', 60, v_tid);
      insert into posts (author_complex_id, kind, text_content, ref_tournament_id, created_at)
      select v_cx, 'campeones',
        '🥇 ¡Campeones! ' || p1.first_name || ' ' || p1.last_name || ' y ' || p2.first_name || ' ' || p2.last_name || ' se quedaron con el torneo. ¡Felicitaciones!',
        v_tid, now() - (interval '1 day' * (170 - i * 22))
      from profiles p1, profiles p2 where p1.id = pool[1] and p2.id = pool[2];
    else
      insert into posts (author_complex_id, kind, text_content, ref_tournament_id)
      values (v_cx, 'torneo_abierto', '🏆 ¡Inscripción abierta! Anotate con tu pareja desde la app.', v_tid);
    end if;
  end loop;

  -- ============ FEED: posts de jugadores + promos + likes + comentarios ============
  for i in 1..35 loop
    insert into posts (author_profile_id, kind, text_content, created_at)
    values (players[1 + floor(random() * 40)::int], 'manual',
      post_texts[1 + (i % 8)], now() - (interval '1 hour' * floor(random() * 2000)))
    returning id into v_post;
    -- likes
    for j in 1..floor(random() * 9)::int loop
      insert into post_likes (post_id, player_id)
      values (v_post, players[1 + floor(random() * 40)::int]) on conflict do nothing;
    end loop;
    -- comentarios
    for j in 1..floor(random() * 3)::int loop
      insert into post_comments (post_id, player_id, text_content)
      values (v_post, players[1 + floor(random() * 40)::int], comment_texts[1 + floor(random() * 8)::int]);
    end loop;
  end loop;

  for i in 1..6 loop
    insert into posts (author_complex_id, kind, text_content, created_at)
    values (cxs[i], 'promo', '🔥 Happy hour en ' || cx_names[i] || ': 20% off en turnos de 14 a 17 hs.',
      now() - (interval '1 day' * floor(random() * 20)));
  end loop;

  -- ============ ENTRENAMIENTOS ============
  for i in 1..40 loop
    for j in 1..(4 + floor(random() * 10)::int) loop
      insert into trainings (player_id, type, date, duration_min, coach, goals, notes)
      values (players[i],
        (array['tecnica','fisico','clase_individual','clase_grupal','partido_entrenamiento'])[1 + floor(random() * 5)::int]::training_type,
        current_date - floor(random() * 180)::int,
        60 + 30 * floor(random() * 3)::int,
        coaches[1 + floor(random() * 4)::int],
        goals_arr[1 + floor(random() * 6)::int],
        null);
    end loop;
  end loop;

end $$;

-- Resumen final para verificar
select 'complejos' as tabla, count(*) from complexes
union all select 'canchas', count(*) from courts
union all select 'jugadores', count(*) from profiles where role = 'player'
union all select 'reservas', count(*) from bookings
union all select 'partidos', count(*) from matches
union all select 'resultados', count(*) from results
union all select 'puntos ranking', count(*) from ranking_points
union all select 'torneos', count(*) from tournaments
union all select 'posts', count(*) from posts
union all select 'entrenamientos', count(*) from trainings;
