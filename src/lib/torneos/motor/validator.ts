import type { Round } from './types';
import { REQUIRED_PAIRS_PER_ROUND } from './types';
import { toCanonical } from './rounds';

// Validador del cuadro eliminatorio.
// Devuelve errores BLOQUEANTES y ADVERTENCIAS separados.
// Bloqueantes: impiden confirmar el cuadro.
// Advertencias: se muestran pero permiten continuar.

export type ValidationCode =
  // Bloqueantes
  | 'DUPLICATE_PAIR'
  | 'PAIR_WITHOUT_DESTINATION'
  | 'INCOMPLETE_MATCH'
  | 'WINNER_WITHOUT_DESTINATION'
  | 'ELIMINATED_PAIR_REAPPEARS'
  | 'SAME_PAIR_IN_TWO_SLOTS'
  | 'ROUND_WRONG_SIZE'
  // Advertencias
  | 'GROUP_REMATCH'
  | 'TWO_FIRSTS_MEETING'
  | 'TWO_SECONDS_MEETING'
  | 'FOURTH_VS_NON_FIRST'
  | 'BYE_TO_WEAKER_PAIR';

export interface ValidationIssue {
  code: ValidationCode;
  level: 'error' | 'warning';
  message: string;
  matchIndex?: number;   // referencia a bracket[i]
  round?: Round;
  pairIds?: string[];
}

export interface ValidatorMatch {
  round: Round;
  order_index: number;
  pair1_id: string | null;
  pair2_id: string | null;
  pair1_from?: string;                    // "<round>:<order_index>"
  pair2_from?: string;
  pair1_path_hint?: 'direct_from_1st' | 'direct_from_2nd' | 'preliminary_from_3rd' | 'preliminary_from_4th';
  pair2_path_hint?: 'direct_from_1st' | 'direct_from_2nd' | 'preliminary_from_3rd' | 'preliminary_from_4th';
}

export interface GroupPhaseMatch {
  // Partido ya JUGADO en fase de grupos (para detectar revanchas)
  pair1_id: string;
  pair2_id: string;
  group_label?: string;
}

export interface ValidatorInput {
  bracket: ValidatorMatch[];
  allPairIds?: string[];              // universo de parejas inscriptas (para detectar sin-destino)
  eliminatedInGroups?: string[];      // parejas eliminadas en grupos (formato NO-Monte). En Monte queda vacío.
  groupMatches?: GroupPhaseMatch[];   // para detectar revanchas
  pairGroup?: Record<string, string>; // pair_id → group_label
}

export interface ValidationReport {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  ok: boolean;   // ok === errors.length === 0
}

export function validateBracket(input: ValidatorInput): ValidationReport {
  const issues: ValidationIssue[] = [];
  const { bracket, allPairIds, eliminatedInGroups, groupMatches, pairGroup } = input;

  // ---------- 1) Partidos incompletos ----------
  // Un partido está incompleto si NO tiene pareja concreta ni referencia 'from' en algún slot,
  // excepto los BYE explícitos (pair2_id === null Y no hay pair2_from — se marcarán aparte).
  bracket.forEach((m, i) => {
    const p1Missing = !m.pair1_id && !m.pair1_from;
    const p2Missing = !m.pair2_id && !m.pair2_from;
    if (p1Missing && p2Missing) {
      issues.push({
        code: 'INCOMPLETE_MATCH', level: 'error',
        message: `Partido ${i + 1} (${roundLabel(m.round)}) no tiene parejas ni referencias.`,
        matchIndex: i, round: m.round
      });
    }
  });

  // ---------- 2) Pareja duplicada en la misma ronda ----------
  const byRound: Record<string, Set<string>> = {};
  bracket.forEach((m, i) => {
    const key = m.round;
    const set = (byRound[key] ||= new Set());
    [m.pair1_id, m.pair2_id].forEach(pid => {
      if (!pid) return;
      if (set.has(pid)) {
        issues.push({
          code: 'DUPLICATE_PAIR', level: 'error',
          message: `La pareja aparece dos veces en ${roundLabel(m.round)}.`,
          matchIndex: i, round: m.round, pairIds: [pid]
        });
      }
      set.add(pid);
    });
  });

  // ---------- 3) Dos slots distintos con la misma pareja (todo el bracket) ----------
  // Sólo cuenta si NO es propagación válida (mismo pair_id en rondas distintas es OK
  // porque una pareja avanza). El chequeo real: misma pareja como pair1_id/pair2_id
  // "concreta" (no via 'from') dos veces en cualquier lado del mismo nivel.
  // Ya cubierto por 2), aquí sólo chequeamos slots con IDs duplicados directos.

  // ---------- 4) Sizes por ronda (16/8/4/2) ----------
  const roundSizes = countMatchesPerRound(bracket);
  Object.entries(roundSizes).forEach(([round, count]) => {
    const canonical = toCanonical(round as Round);
    const required = REQUIRED_PAIRS_PER_ROUND[canonical];
    if (required) {
      const pairsInRound = count * 2;
      if (pairsInRound !== required) {
        issues.push({
          code: 'ROUND_WRONG_SIZE', level: 'error',
          message: `${roundLabel(round as Round)} tiene ${pairsInRound} parejas. Deben ser ${required}.`,
          round: round as Round
        });
      }
    }
  });

  // ---------- 5) Ganador sin destino ----------
  // Un match cuyo winner no está referenciado por NINGÚN 'from' de otro match
  // — EXCEPTO la FINAL, cuyo ganador no propaga.
  const referencedTags = new Set<string>();
  bracket.forEach(m => {
    if (m.pair1_from) referencedTags.add(m.pair1_from);
    if (m.pair2_from) referencedTags.add(m.pair2_from);
  });
  bracket.forEach((m, i) => {
    if (m.round === 'final') return;
    const tag = `${m.round}:${m.order_index}`;
    if (!referencedTags.has(tag)) {
      issues.push({
        code: 'WINNER_WITHOUT_DESTINATION', level: 'error',
        message: `El ganador del partido ${i + 1} (${roundLabel(m.round)}) no tiene próximo destino.`,
        matchIndex: i, round: m.round
      });
    }
  });

  // ---------- 6) Pareja sin destino (inscripta pero sin ubicar) ----------
  if (allPairIds && allPairIds.length) {
    const placed = new Set<string>();
    bracket.forEach(m => {
      if (m.pair1_id) placed.add(m.pair1_id);
      if (m.pair2_id) placed.add(m.pair2_id);
    });
    const eliminated = new Set(eliminatedInGroups ?? []);
    allPairIds.forEach(pid => {
      if (!placed.has(pid) && !eliminated.has(pid)) {
        issues.push({
          code: 'PAIR_WITHOUT_DESTINATION', level: 'error',
          message: `Hay una pareja inscripta que no aparece en el cuadro ni fue eliminada en grupos.`,
          pairIds: [pid]
        });
      }
    });
  }

  // ---------- 7) Pareja eliminada que reaparece ----------
  if (eliminatedInGroups && eliminatedInGroups.length) {
    const elim = new Set(eliminatedInGroups);
    bracket.forEach((m, i) => {
      [m.pair1_id, m.pair2_id].forEach(pid => {
        if (pid && elim.has(pid)) {
          issues.push({
            code: 'ELIMINATED_PAIR_REAPPEARS', level: 'error',
            message: `Una pareja eliminada en la fase de grupos aparece en ${roundLabel(m.round)}.`,
            matchIndex: i, round: m.round, pairIds: [pid]
          });
        }
      });
    });
  }

  // ---------- 8) ADVERTENCIA: revancha del mismo grupo ----------
  if (groupMatches && groupMatches.length) {
    const played = new Set<string>();
    groupMatches.forEach(gm => {
      played.add(keyPair(gm.pair1_id, gm.pair2_id));
    });
    bracket.forEach((m, i) => {
      if (!m.pair1_id || !m.pair2_id) return;
      if (played.has(keyPair(m.pair1_id, m.pair2_id))) {
        issues.push({
          code: 'GROUP_REMATCH', level: 'warning',
          message: `El cruce de ${roundLabel(m.round)} repite un partido de la fase de grupos.`,
          matchIndex: i, round: m.round, pairIds: [m.pair1_id, m.pair2_id]
        });
      }
    });
  }

  // ---------- 9) ADVERTENCIA: dos primeros / dos segundos enfrentándose en primera KO ----------
  bracket.forEach((m, i) => {
    if (m.pair1_path_hint === 'direct_from_1st' && m.pair2_path_hint === 'direct_from_1st') {
      issues.push({
        code: 'TWO_FIRSTS_MEETING', level: 'warning',
        message: `En ${roundLabel(m.round)} se enfrentan dos primeros de grupo.`,
        matchIndex: i, round: m.round
      });
    }
    if (m.pair1_path_hint === 'direct_from_2nd' && m.pair2_path_hint === 'direct_from_2nd') {
      issues.push({
        code: 'TWO_SECONDS_MEETING', level: 'warning',
        message: `En ${roundLabel(m.round)} se enfrentan dos segundos de grupo.`,
        matchIndex: i, round: m.round
      });
    }
    // ADVERTENCIA: un "4º sobreviviente" que enfrenta a alguien que NO es 1º
    if (m.pair1_path_hint === 'preliminary_from_4th' && m.pair2_path_hint && m.pair2_path_hint !== 'direct_from_1st') {
      issues.push({
        code: 'FOURTH_VS_NON_FIRST', level: 'warning',
        message: `En ${roundLabel(m.round)}, el ganador de un 4º de grupo no enfrenta a un 1º (regla Monte).`,
        matchIndex: i, round: m.round
      });
    }
    if (m.pair2_path_hint === 'preliminary_from_4th' && m.pair1_path_hint && m.pair1_path_hint !== 'direct_from_1st') {
      issues.push({
        code: 'FOURTH_VS_NON_FIRST', level: 'warning',
        message: `En ${roundLabel(m.round)}, el ganador de un 4º de grupo no enfrenta a un 1º (regla Monte).`,
        matchIndex: i, round: m.round
      });
    }
  });

  // ---------- 10) ADVERTENCIA: mismo grupo enfrentándose fuera de zona ----------
  // Los cruces primeros vs segundos deberían ser de OTRO grupo. Si se detecta mismo grupo, warn.
  if (pairGroup) {
    bracket.forEach((m, i) => {
      if (!m.pair1_id || !m.pair2_id) return;
      const g1 = pairGroup[m.pair1_id];
      const g2 = pairGroup[m.pair2_id];
      if (g1 && g2 && g1 === g2) {
        issues.push({
          code: 'GROUP_REMATCH', level: 'warning',
          message: `En ${roundLabel(m.round)} se enfrentan dos parejas del mismo grupo (${g1}).`,
          matchIndex: i, round: m.round
        });
      }
    });
  }

  const errors = issues.filter(i => i.level === 'error');
  const warnings = issues.filter(i => i.level === 'warning');
  return { errors, warnings, ok: errors.length === 0 };
}

// ---- Helpers ----
function countMatchesPerRound(bracket: ValidatorMatch[]): Record<string, number> {
  const acc: Record<string, number> = {};
  bracket.forEach(m => { acc[m.round] = (acc[m.round] ?? 0) + 1; });
  return acc;
}

function keyPair(a: string, b: string): string {
  return [a, b].sort().join('|');
}

function roundLabel(r: Round): string {
  if (r === 'zona') return 'Grupos';
  if (r === '32avos') return 'Play-in';
  if (r === '16avos') return 'Preliminar';
  if (r === '8vos') return 'Octavos';
  if (r === 'cuartos') return 'Cuartos';
  if (r === 'semi') return 'Semifinal';
  if (r === 'final') return 'Final';
  return r;
}
