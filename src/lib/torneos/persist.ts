'use client';
import { supabase } from '@/lib/supabase/client';
import {
  buildGroups, roundRobinMatches, buildBracket,
  computeStandings, determineWinner, type BracketMatchSpec, type Qualifier
} from './motor';
import type { Round, SetScore, SpecialResult } from './motor/types';

// Funciones de persistencia del motor sobre Supabase.
// Cada función es idempotente cuando corresponde: si el bracket ya está
// generado, no lo duplica. Si el resultado ya está cargado, no crea otro.

export async function generateFullTournament(tournamentId: string, opts?: { seed?: number }) {
  // 1) Traer parejas aprobadas
  const { data: pairs } = await supabase.from('tournament_pairs')
    .select('id, seed, player1_id, player2_id, provisional_p1_name, provisional_p2_name')
    .eq('tournament_id', tournamentId).eq('status', 'aprobada');
  if (!pairs || pairs.length < 3) throw new Error('Se necesitan al menos 3 parejas aprobadas.');

  // 2) Borrar grupos y matches previos (regenerar limpio)
  await supabase.from('tournament_matches').delete().eq('tournament_id', tournamentId);
  await supabase.from('tournament_groups').delete().eq('tournament_id', tournamentId);

  // 3) Armar grupos
  const groupsMotor = buildGroups(
    pairs.map(p => ({ id: p.id, seed: p.seed ?? null })),
    { seed: opts?.seed ?? Date.now() }
  );

  // 4) Persistir grupos + memberships
  const groupsIds: Record<string, string> = {}; // label -> uuid
  for (let i = 0; i < groupsMotor.length; i++) {
    const g = groupsMotor[i];
    const { data: gRow } = await supabase.from('tournament_groups')
      .insert({ tournament_id: tournamentId, label: g.label, size: g.members.length, order_index: i })
      .select().single();
    if (!gRow) continue;
    groupsIds[g.label] = gRow.id;
    // memberships
    await supabase.from('group_memberships').delete().in('pair_id', g.members.map(m => m.id));
    await supabase.from('group_memberships')
      .insert(g.members.map((m, mi) => ({ group_id: gRow.id, pair_id: m.id, seed: m.seed ?? null })));

    // 5) Round robin de matches del grupo
    const rr = roundRobinMatches(g.members);
    if (rr.length) {
      await supabase.from('tournament_matches').insert(rr.map(m => ({
        tournament_id: tournamentId,
        round: `Zona ${g.label}`,
        pair1_id: m.pair1_id,
        pair2_id: m.pair2_id,
        order_index: m.order_index
      })));
    }
  }

  // 6) Persistir tournament status
  await supabase.from('tournaments').update({ status: 'en_juego', engine: 'v2' })
    .eq('id', tournamentId);

  // 7) Audit
  await supabase.from('tournament_audit').insert({
    tournament_id: tournamentId,
    action: 'create_bracket',
    payload: { groups: groupsMotor.map(g => ({ label: g.label, size: g.members.length })) }
  });

  return { groups: groupsMotor.length, matches: groupsMotor.reduce((a, g) => a + (g.members.length * (g.members.length - 1) / 2), 0) };
}

// Genera la fase eliminatoria basada en los standings finales de los grupos.
// Requiere que TODOS los partidos de zona estén jugados.
export async function generateKnockoutStage(tournamentId: string) {
  // 1) Traer grupos + memberships + partidos de zona
  const { data: gs } = await supabase.from('tournament_groups')
    .select('id, label, size, order_index, members:group_memberships(pair_id, seed, final_position)')
    .eq('tournament_id', tournamentId).order('order_index');
  if (!gs || gs.length === 0) throw new Error('No hay grupos generados.');

  const { data: zoneMatches } = await supabase.from('tournament_matches')
    .select('id, round, pair1_id, pair2_id, winner_pair_id, special_result, special_winner_pair_id, order_index, sets:match_sets(t1_games,t2_games,set_number)')
    .eq('tournament_id', tournamentId).like('round', 'Zona %');

  // 2) Verificar que todos los partidos de zona tengan ganador
  const pendientes = (zoneMatches ?? []).filter(m => !m.winner_pair_id && !m.special_winner_pair_id);
  if (pendientes.length) throw new Error(`Faltan cargar ${pendientes.length} resultados de la fase de grupos.`);

  // 3) Calcular standings por grupo y persistir final_position
  const qualifiers: Qualifier[] = [];
  for (const g of gs) {
    const memberIds = (g.members ?? []).map((m: any) => m.pair_id);
    const zoneMs = (zoneMatches ?? [])
      .filter(m => m.round === `Zona ${g.label}`)
      .map(m => ({
        id: m.id, round: 'zona' as Round,
        pair1_id: m.pair1_id, pair2_id: m.pair2_id,
        winner_pair_id: m.winner_pair_id,
        special_result: m.special_result as SpecialResult,
        special_winner_pair_id: m.special_winner_pair_id,
        order_index: m.order_index,
        sets: (m.sets ?? []).sort((a: any, b: any) => a.set_number - b.set_number)
          .map((s: any) => ({ t1: s.t1_games, t2: s.t2_games }))
      }));
    const standings = computeStandings(memberIds, zoneMs);

    // Persistir final_position
    for (const s of standings) {
      await supabase.from('group_memberships').update({ final_position: s.final_position ?? null })
        .eq('group_id', g.id).eq('pair_id', s.pair_id);
    }
    // Extraer clasificados: TODOS los que quedaron 1º, 2º, 3º y 4º
    // (los 3º y 4º juegan preliminar; los 1º y 2º van directo)
    standings.forEach(s => {
      qualifiers.push({
        pair_id: s.pair_id,
        group_label: g.label,
        group_position: s.final_position ?? 999
      });
    });
  }

  // 4) Construir bracket con el motor
  const bracketSpecs = buildBracket(qualifiers);

  // 5) Persistir matches eliminatorios
  const round2sql: Record<Round, string> = {
    'zona': 'Zona', '16avos': '16avos', '8vos': 'Octavos',
    'cuartos': 'Cuartos', 'semi': 'Semifinal', 'final': 'Final'
  };
  const startOrder = 10000; // offset para no chocar con orders de zona
  await supabase.from('tournament_matches').insert(bracketSpecs.map((b, i) => ({
    tournament_id: tournamentId,
    round: round2sql[b.round],
    pair1_id: b.pair1_id,
    pair2_id: b.pair2_id,
    order_index: startOrder + i,
    notes: b.pair1_from || b.pair2_from
      ? `from:${b.pair1_from ?? ''}|${b.pair2_from ?? ''}`
      : null
  })));

  await supabase.from('tournament_audit').insert({
    tournament_id: tournamentId,
    action: 'create_knockout',
    payload: { qualifiers: qualifiers.length, matches: bracketSpecs.length }
  });

  return { matches: bracketSpecs.length };
}

// Registra el resultado de un partido y avanza al ganador si corresponde.
export async function recordMatchResult(
  matchId: string,
  sets: SetScore[] | null,
  special?: { type: SpecialResult; winnerPairId: string }
) {
  const { data: match } = await supabase.from('tournament_matches')
    .select('id, tournament_id, round, pair1_id, pair2_id, order_index, notes')
    .eq('id', matchId).single();
  if (!match) throw new Error('Partido no encontrado.');

  // Borrar sets previos (para poder corregir)
  await supabase.from('match_sets').delete().eq('match_id', matchId);

  let winnerPairId: string | null = null;

  if (special?.type) {
    winnerPairId = special.winnerPairId;
    await supabase.from('tournament_matches').update({
      special_result: special.type,
      special_winner_pair_id: special.winnerPairId,
      winner_pair_id: special.winnerPairId,
      score: special.type.toUpperCase()
    }).eq('id', matchId);
  } else if (sets && sets.length) {
    const w = determineWinner({
      pair1_id: match.pair1_id, pair2_id: match.pair2_id, sets, special_result: null, special_winner_pair_id: null
    });
    winnerPairId = w;
    // Insertar sets
    await supabase.from('match_sets').insert(sets.map((s, i) => ({
      match_id: matchId, set_number: i + 1,
      t1_games: s.t1, t2_games: s.t2,
      t1_tiebreak: s.t1TieBreak ?? null, t2_tiebreak: s.t2TieBreak ?? null,
      is_super_tiebreak: !!s.isSuperTB
    })));
    await supabase.from('tournament_matches').update({
      winner_pair_id: w,
      special_result: null,
      special_winner_pair_id: null,
      score: sets.map(s => `${s.t1}-${s.t2}`).join(' ')
    }).eq('id', matchId);
  }

  // Avance de ganador: buscar en la próxima ronda un match con notes "from:X|Y"
  if (winnerPairId && match.notes == null) {
    // este match está en fase de grupos: no avanza automáticamente aquí (se genera knockout con generateKnockoutStage)
  }
  if (winnerPairId) {
    const tag = `${match.round}:${match.order_index}`;
    const { data: nextMatches } = await supabase.from('tournament_matches')
      .select('id, notes, pair1_id, pair2_id')
      .eq('tournament_id', match.tournament_id).not('notes', 'is', null);
    for (const nm of nextMatches ?? []) {
      if (!nm.notes) continue;
      // formato notes: "from:<pair1From>|<pair2From>"
      const m = String(nm.notes).match(/^from:([^|]*)\|(.*)$/);
      if (!m) continue;
      const [, p1From, p2From] = m;
      if (p1From === tag && !nm.pair1_id) {
        await supabase.from('tournament_matches').update({ pair1_id: winnerPairId }).eq('id', nm.id);
      }
      if (p2From === tag && !nm.pair2_id) {
        await supabase.from('tournament_matches').update({ pair2_id: winnerPairId }).eq('id', nm.id);
      }
    }
  }

  await supabase.from('tournament_audit').insert({
    tournament_id: match.tournament_id,
    action: special ? 'walkover' : 'record_result',
    ref_id: matchId,
    payload: special ? { type: special.type, winner: special.winnerPairId } : { sets }
  });

  return { winnerPairId };
}

// Chequea si el torneo terminó (final tiene ganador) y actualiza status.
export async function checkAndCloseTournament(tournamentId: string) {
  const { data: finals } = await supabase.from('tournament_matches')
    .select('winner_pair_id, round').eq('tournament_id', tournamentId).eq('round', 'Final');
  const finalMatch = finals?.[0];
  if (finalMatch?.winner_pair_id) {
    await supabase.from('tournaments').update({ status: 'finalizado' }).eq('id', tournamentId);
    await supabase.from('tournament_audit').insert({
      tournament_id: tournamentId, action: 'close', payload: { winner: finalMatch.winner_pair_id }
    });
    return true;
  }
  return false;
}
