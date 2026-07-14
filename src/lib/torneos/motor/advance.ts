import type { MatchInput, Round, SetScore, SpecialResult } from './types';

// Determina el ganador de un partido en base a sus sets (o resultado especial).
export function determineWinner(m: Pick<MatchInput, 'pair1_id' | 'pair2_id' | 'sets' | 'special_result' | 'special_winner_pair_id'>): string | null {
  if (m.special_result === 'walkover' || m.special_result === 'dq' || m.special_result === 'abandono') {
    return m.special_winner_pair_id ?? null;
  }
  if (m.special_result === 'suspendido') return null;
  const sets = m.sets ?? [];
  if (!sets.length) return null;
  let w1 = 0, w2 = 0;
  sets.forEach(s => s.t1 > s.t2 ? w1++ : s.t2 > s.t1 ? w2++ : null);
  if (w1 === w2) return null;
  return w1 > w2 ? (m.pair1_id ?? null) : (m.pair2_id ?? null);
}

// Valida un score contra el formato configurado.
// Devuelve error string o null si es válido.
export function validateSets(sets: SetScore[], format: string): string | null {
  if (!sets.length) return 'Cargá al menos un set.';
  const totalSets = sets.length;
  if (format === 'single_set' && totalSets !== 1)
    return 'Este torneo es a un set único.';
  if (format === 'super_tiebreak' && totalSets !== 1)
    return 'Este torneo se define con super tiebreak (1 juego).';
  if (format === 'best_of_3_super_tb' && totalSets > 3)
    return 'Máximo 3 sets (con super tiebreak en el 3ro).';
  if (format === 'best_of_3_full' && totalSets > 3)
    return 'Máximo 3 sets.';
  for (const s of sets) {
    if (s.t1 < 0 || s.t2 < 0) return 'Los games no pueden ser negativos.';
    if (s.t1 === s.t2) return `El set ${sets.indexOf(s) + 1} está empatado. Revisá el resultado.`;
  }
  return null;
}

// Actualiza los slots de la ronda siguiente cuando se resuelve un partido.
// Recibe TODOS los partidos del torneo y el id del match resuelto.
// Devuelve la lista de matches que hay que ACTUALIZAR (con nuevo pair1_id/pair2_id).
export function propagateWinner(
  matches: MatchInput[],
  resolvedMatchId: string
): { id: string; slot: 'pair1_id' | 'pair2_id'; value: string }[] {
  const resolved = matches.find(m => m.id === resolvedMatchId);
  if (!resolved) return [];
  const winner = resolved.winner_pair_id ?? resolved.special_winner_pair_id;
  if (!winner) return [];

  // Buscar next round que tenga un "from" apuntando a este match
  // Convención: se usa "<round>:<order_index>" como identificador.
  const tag = `${resolved.round}:${resolved.order_index}`;
  const updates: { id: string; slot: 'pair1_id' | 'pair2_id'; value: string }[] = [];

  matches.forEach(m => {
    const meta = (m as any).meta_from as { pair1_from?: string; pair2_from?: string } | undefined;
    if (!meta) return;
    if (meta.pair1_from === tag && !m.pair1_id) updates.push({ id: m.id, slot: 'pair1_id', value: winner });
    if (meta.pair2_from === tag && !m.pair2_id) updates.push({ id: m.id, slot: 'pair2_id', value: winner });
  });

  return updates;
}

// Convierte round a orden numérico (util para sorting)
export const roundOrder: Record<Round, number> = {
  'zona': 0, '16avos': 1, '8vos': 2, 'cuartos': 3, 'semi': 4, 'final': 5
};
