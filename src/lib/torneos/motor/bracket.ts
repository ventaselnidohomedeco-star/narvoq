import type { Round } from './types';
import { nextPow2 } from './recommend';

// Motor de bracket estilo San Miguel del Monte (v4).
//
// Rondas posibles (según totalPairs):
//   - 8 parejas (2 grupos × 4): SIN preliminar. 1º y 2º van directo a semis.
//     Cruces: 1ºA vs 2ºB, 1ºB vs 2ºA. Luego final. 3º y 4º eliminados.
//
//   - Directos ya potencia de 2 (16 pairs → 8 directos, 32 pairs → 16 directos):
//     SIN preliminar. Los directos entran a la primera ronda KO. 3º/4º eliminados.
//
//   - Directos NO potencia de 2:
//     firstKoSize = nextPow2(directos)
//     slotsFromPrelim = firstKoSize - directos
//     candidates = 3ºs + 4ºs
//     A = candidates - 2 * slotsFromPrelim
//       · A ≤ 0: SÓLO preliminar (posiblemente con BYE si hay pocos candidatos)
//       · A  > 0: PLAY-IN + preliminar
//         - Play-in: A partidos, priorizando 4ºs. Si sobran 4ºs, algunos 3ºs entran.
//         - Preliminar: 3ºs restantes + winners del play-in.
//
// La primera ronda KO SIEMPRE es potencia de 2 (garantía matemática).

export type QualificationPath =
  | 'direct_from_1st'
  | 'direct_from_2nd'
  | 'preliminary_from_3rd'
  | 'preliminary_from_4th';

export interface Qualifier {
  pair_id: string;
  group_label: string;
  group_position: number;   // 1, 2, 3, 4
}

export interface BracketMatchSpec {
  round: Round;
  order_index: number;
  pair1_id: string | null;
  pair2_id: string | null;
  pair1_from?: string;      // tag "<round>:<order_index>"
  pair2_from?: string;
  pair1_path_hint?: QualificationPath;
  pair2_path_hint?: QualificationPath;
}

export function buildBracket(qualifiers: Qualifier[]): BracketMatchSpec[] {
  const firsts = qualifiers.filter(q => q.group_position === 1);
  const seconds = qualifiers.filter(q => q.group_position === 2);
  const thirds = qualifiers.filter(q => q.group_position === 3);
  const fourths = qualifiers.filter(q => q.group_position === 4);
  const groupsCount = firsts.length;

  const matches: BracketMatchSpec[] = [];
  const ord = { i: 0 };
  const nextOrder = () => ord.i++;

  if (groupsCount < 2) return matches;

  // -------- Caso especial: 8 parejas / 2 grupos × 4 --------
  if (groupsCount === 2 && firsts.length === 2 && seconds.length === 2) {
    return build8Pairs(firsts, seconds, nextOrder);
  }

  const directs = 2 * groupsCount;
  const candidates = thirds.length + fourths.length;
  const firstKoSize = nextPow2(directs);
  const slotsFromPrelim = firstKoSize - directs;
  const firstKoRound = koRoundForSize(firstKoSize);

  // Tags de matches preliminares que alimentan los slots de la primera KO.
  // Cada elemento es "{path}:{tag}" — path hint + from-tag.
  const prelimFeed: { fromTag: string; hint: QualificationPath }[] = [];

  if (slotsFromPrelim > 0) {
    const A = candidates - 2 * slotsFromPrelim;

    if (A <= 0) {
      // ---- Sólo preliminar ----
      buildPreliminaryOnly(matches, thirds, fourths, slotsFromPrelim, nextOrder, prelimFeed);
    } else {
      // ---- Play-in + preliminar ----
      buildPlayinAndPreliminary(matches, thirds, fourths, A, slotsFromPrelim, nextOrder, prelimFeed);
    }
  }

  // -------- Primera ronda KO (octavos / cuartos / semi según tamaño) --------
  buildFirstKoRound(matches, firsts, seconds, prelimFeed, firstKoRound, firstKoSize, nextOrder);

  // -------- Cascada hasta la final --------
  const firstKoMatches = matches.filter(m => m.round === firstKoRound);
  buildCascade(matches, firstKoMatches, cascadeAfter(firstKoRound), nextOrder);

  return matches;
}

// ==================== Caso 8 parejas ====================
function build8Pairs(firsts: Qualifier[], seconds: Qualifier[], nextOrder: () => number): BracketMatchSpec[] {
  const [fA, fB] = firsts;
  const sOfOtherGroup1 = seconds.find(s => s.group_label !== fA?.group_label);
  const sOfOtherGroup2 = seconds.find(s => s.group_label !== fB?.group_label);
  const matches: BracketMatchSpec[] = [];
  if (fA && fB && sOfOtherGroup1 && sOfOtherGroup2) {
    matches.push({
      round: 'semi', order_index: nextOrder(),
      pair1_id: fA.pair_id, pair2_id: sOfOtherGroup1.pair_id,
      pair1_path_hint: 'direct_from_1st', pair2_path_hint: 'direct_from_2nd'
    });
    matches.push({
      round: 'semi', order_index: nextOrder(),
      pair1_id: fB.pair_id, pair2_id: sOfOtherGroup2.pair_id,
      pair1_path_hint: 'direct_from_1st', pair2_path_hint: 'direct_from_2nd'
    });
    const s1 = matches[0], s2 = matches[1];
    matches.push({
      round: 'final', order_index: nextOrder(),
      pair1_id: null, pair2_id: null,
      pair1_from: `semi:${s1.order_index}`, pair2_from: `semi:${s2.order_index}`
    });
  }
  return matches;
}

// ==================== Sólo preliminar (sin play-in) ====================
function buildPreliminaryOnly(
  matches: BracketMatchSpec[],
  thirds: Qualifier[],
  fourths: Qualifier[],
  slotsFromPrelim: number,
  nextOrder: () => number,
  prelimFeed: { fromTag: string; hint: QualificationPath }[]
) {
  // Emparejar 4ºs con 3ºs de otros grupos primero, cruzando grupos.
  // Si sobran (BYE), los mejor puestos pasan solos.
  const pool: { q: Qualifier; hint: QualificationPath }[] = [
    ...fourths.map(q => ({ q, hint: 'preliminary_from_4th' as const })),
    ...thirds.map(q => ({ q, hint: 'preliminary_from_3rd' as const }))
  ];

  const created: BracketMatchSpec[] = [];

  // Emparejar hasta slotsFromPrelim matches
  for (let i = 0; i < slotsFromPrelim; i++) {
    if (pool.length === 0) break;
    const a = pool.shift()!;
    // Buscar rival de otro grupo, prioridad al que juegue con 4º (rival = 3º)
    let bIdx = pool.findIndex(x => x.q.group_label !== a.q.group_label);
    if (bIdx < 0) bIdx = 0;
    const b = pool.length ? pool.splice(bIdx, 1)[0] : null;

    if (b) {
      const m: BracketMatchSpec = {
        round: '16avos', order_index: nextOrder(),
        pair1_id: a.q.pair_id, pair2_id: b.q.pair_id,
        pair1_path_hint: a.hint, pair2_path_hint: b.hint
      };
      created.push(m);
      matches.push(m);
    } else {
      // BYE: pareja "juega sola", pasa directo. Creamos un match con pair2_id=null.
      const m: BracketMatchSpec = {
        round: '16avos', order_index: nextOrder(),
        pair1_id: a.q.pair_id, pair2_id: null,
        pair1_path_hint: a.hint
      };
      created.push(m);
      matches.push(m);
    }
  }

  created.forEach(m => {
    const hint = m.pair1_path_hint === 'preliminary_from_4th' || m.pair2_path_hint === 'preliminary_from_4th'
      ? 'preliminary_from_4th' : 'preliminary_from_3rd';
    prelimFeed.push({ fromTag: `16avos:${m.order_index}`, hint });
  });
}

// ==================== Play-in + preliminar ====================
function buildPlayinAndPreliminary(
  matches: BracketMatchSpec[],
  thirds: Qualifier[],
  fourths: Qualifier[],
  A: number,                       // matches de play-in
  slotsFromPrelim: number,         // matches de preliminar (y clasificados finales)
  nextOrder: () => number,
  prelimFeed: { fromTag: string; hint: QualificationPath }[]
) {
  // Play-in: 2A parejas jugando. Priorizamos 4ºs. Si sobran, se completa con 3ºs.
  const playinPlayers = 2 * A;
  const fourthsInPlayin = Math.min(fourths.length, playinPlayers);
  const thirdsInPlayinCount = playinPlayers - fourthsInPlayin;

  const fourthsPlaying = fourths.slice(0, fourthsInPlayin);
  const thirdsPlayingInPlayin = thirds.slice(0, thirdsInPlayinCount);
  const thirdsInPrelim = thirds.slice(thirdsInPlayinCount);

  // Construir play-in cruzando grupos si es posible.
  // Pool de parejas del play-in, todas serán "preliminary_from_4th" a nivel
  // deportivo (el rival "sale" del play-in y enfrenta un 1º/2º con mejor
  // ventaja deportiva). Como hint interno guardamos su posición original.
  const playinPool: { q: Qualifier; hint: QualificationPath }[] = [
    ...fourthsPlaying.map(q => ({ q, hint: 'preliminary_from_4th' as const })),
    ...thirdsPlayingInPlayin.map(q => ({ q, hint: 'preliminary_from_3rd' as const }))
  ];

  const playinMatches: BracketMatchSpec[] = [];
  for (let i = 0; i < A; i++) {
    if (playinPool.length < 2) break;
    const a = playinPool.shift()!;
    let bIdx = playinPool.findIndex(x => x.q.group_label !== a.q.group_label);
    if (bIdx < 0) bIdx = 0;
    const b = playinPool.splice(bIdx, 1)[0];
    const m: BracketMatchSpec = {
      round: '32avos', order_index: nextOrder(),
      pair1_id: a.q.pair_id, pair2_id: b.q.pair_id,
      pair1_path_hint: a.hint, pair2_path_hint: b.hint
    };
    playinMatches.push(m);
    matches.push(m);
  }

  // Preliminar: thirdsInPrelim (con pair concreta) vs winners del play-in.
  // slotsFromPrelim matches; usaremos hasta 2*slotsFromPrelim "slots".
  // slotsAssigned = thirdsInPrelim + winnersDelPlayin (que llenamos con pair_from).
  const winnerSlots: string[] = playinMatches.map(m => `32avos:${m.order_index}`);
  const thirdsPool: Qualifier[] = [...thirdsInPrelim];

  const prelimMatches: BracketMatchSpec[] = [];
  for (let i = 0; i < slotsFromPrelim; i++) {
    // Intentamos: pair1 = un 3º concreto, pair2 = winner del play-in
    const t = thirdsPool.shift() ?? null;
    const w = winnerSlots.shift() ?? null;

    if (t && w) {
      const m: BracketMatchSpec = {
        round: '16avos', order_index: nextOrder(),
        pair1_id: t.pair_id, pair2_id: null,
        pair1_path_hint: 'preliminary_from_3rd',
        pair2_from: w,
        pair2_path_hint: 'preliminary_from_4th'
      };
      prelimMatches.push(m);
      matches.push(m);
    } else if (t && !w) {
      // Ya no quedan winners, este 3º juega vs otro 3º restante
      const t2 = thirdsPool.shift();
      if (t2) {
        const m: BracketMatchSpec = {
          round: '16avos', order_index: nextOrder(),
          pair1_id: t.pair_id, pair2_id: t2.pair_id,
          pair1_path_hint: 'preliminary_from_3rd',
          pair2_path_hint: 'preliminary_from_3rd'
        };
        prelimMatches.push(m);
        matches.push(m);
      } else {
        // BYE
        const m: BracketMatchSpec = {
          round: '16avos', order_index: nextOrder(),
          pair1_id: t.pair_id, pair2_id: null,
          pair1_path_hint: 'preliminary_from_3rd'
        };
        prelimMatches.push(m);
        matches.push(m);
      }
    } else if (!t && w) {
      // No hay 3ºs libres; enfrentamos dos winners del play-in
      const w2 = winnerSlots.shift();
      if (w2) {
        const m: BracketMatchSpec = {
          round: '16avos', order_index: nextOrder(),
          pair1_id: null, pair2_id: null,
          pair1_from: w, pair1_path_hint: 'preliminary_from_4th',
          pair2_from: w2, pair2_path_hint: 'preliminary_from_4th'
        };
        prelimMatches.push(m);
        matches.push(m);
      }
    }
  }

  prelimMatches.forEach(m => {
    prelimFeed.push({
      fromTag: `16avos:${m.order_index}`,
      hint: 'preliminary_from_3rd'
    });
  });
}

// ==================== Primera ronda KO ====================
function buildFirstKoRound(
  matches: BracketMatchSpec[],
  firsts: Qualifier[],
  seconds: Qualifier[],
  prelimFeed: { fromTag: string; hint: QualificationPath }[],
  round: Round,
  size: number,
  nextOrder: () => number
) {
  // Los slots que recibirán winners del preliminar enfrentan un 1º (SMM: winner-de-4º vs 1º).
  // Los directos restantes se emparejan 1º-vs-2º evitando mismo grupo.
  const firstsPool = [...firsts];
  const secondsPool = [...seconds];

  const pickAvoiding = (pool: Qualifier[], avoid: string[]) => {
    if (pool.length === 0) return null;
    let idx = pool.findIndex(q => !avoid.includes(q.group_label));
    if (idx < 0) idx = 0;
    return pool.splice(idx, 1)[0];
  };

  // 1) Slots preliminar → rival preferido: 1º de otro grupo
  for (const feed of prelimFeed) {
    const rival = pickAvoiding(firstsPool, []) ?? pickAvoiding(secondsPool, []);
    if (!rival) break;
    matches.push({
      round, order_index: nextOrder(),
      pair1_id: null, pair2_id: rival.pair_id,
      pair1_from: feed.fromTag, pair1_path_hint: feed.hint,
      pair2_path_hint: rival.group_position === 1 ? 'direct_from_1st' : 'direct_from_2nd'
    });
  }

  // 2) 1ºs restantes vs 2ºs restantes (evitando mismo grupo)
  while (firstsPool.length && secondsPool.length) {
    const f = firstsPool.shift()!;
    const s = pickAvoiding(secondsPool, [f.group_label]);
    if (!s) break;
    matches.push({
      round, order_index: nextOrder(),
      pair1_id: f.pair_id, pair2_id: s.pair_id,
      pair1_path_hint: 'direct_from_1st', pair2_path_hint: 'direct_from_2nd'
    });
  }

  // 3) Sobrantes (raro): parear entre sí
  const rest = [...firstsPool, ...secondsPool];
  while (rest.length >= 2) {
    const a = rest.shift()!;
    const b = rest.shift()!;
    matches.push({
      round, order_index: nextOrder(),
      pair1_id: a.pair_id, pair2_id: b.pair_id,
      pair1_path_hint: a.group_position === 1 ? 'direct_from_1st' : 'direct_from_2nd',
      pair2_path_hint: b.group_position === 1 ? 'direct_from_1st' : 'direct_from_2nd'
    });
  }
}

// ==================== Cascada de rondas siguientes ====================
function buildCascade(
  allMatches: BracketMatchSpec[],
  prevRoundMatches: BracketMatchSpec[],
  rounds: Round[],
  nextOrder: () => number
) {
  let prev = prevRoundMatches;
  let prevRoundName: Round = prev[0]?.round ?? '8vos';

  for (const nr of rounds) {
    const count = prev.length;
    if (count <= 1) return;
    const nextCount = Math.floor(count / 2);
    const hasBye = count % 2 === 1;

    const created: BracketMatchSpec[] = [];
    for (let i = 0; i < nextCount; i++) {
      const a = prev[i * 2];
      const b = prev[i * 2 + 1];
      created.push({
        round: nr, order_index: nextOrder(),
        pair1_id: null, pair2_id: null,
        pair1_from: a ? `${prevRoundName}:${a.order_index}` : undefined,
        pair2_from: b ? `${prevRoundName}:${b.order_index}` : undefined
      });
    }
    if (hasBye) {
      const byePrev = prev[prev.length - 1];
      created.push({
        round: nr, order_index: nextOrder(),
        pair1_id: null, pair2_id: null,
        pair1_from: `${prevRoundName}:${byePrev.order_index}`
      });
    }
    allMatches.push(...created);
    prev = created;
    prevRoundName = nr;
  }
}

// ==================== Helpers ====================
function koRoundForSize(size: number): Round {
  if (size >= 16) return '8vos';
  if (size === 8) return 'cuartos';
  if (size === 4) return 'semi';
  return 'final';
}

function cascadeAfter(round: Round): Round[] {
  if (round === '8vos') return ['cuartos', 'semi', 'final'];
  if (round === 'cuartos') return ['semi', 'final'];
  if (round === 'semi') return ['final'];
  return [];
}
