import type { Round, PairRef } from './types';

// Genera la fase eliminatoria adaptándose a cualquier cantidad de parejas.
// Regla base San Miguel del Monte:
//   - 1º y 2º de cada grupo van al bracket principal.
//   - 3º y 4º juegan preliminar (16avos) SOLO si hacen falta para
//     completar un bracket redondo (potencia de 2).
//   - Si los directos (2 * grupos) ya son potencia de 2, no hay preliminar.
//   - Cruces evitan mismo grupo, 1º vs 1º, 2º vs 2º cuando es posible.

export interface Qualifier {
  pair_id: string;
  group_label: string;
  group_position: number;
}

export interface BracketMatchSpec {
  round: Round;
  order_index: number;
  pair1_id: string | null;
  pair2_id: string | null;
  pair1_from?: string;
  pair2_from?: string;
}

export function buildBracket(qualifiers: Qualifier[]): BracketMatchSpec[] {
  const firsts = qualifiers.filter(q => q.group_position === 1);
  const seconds = qualifiers.filter(q => q.group_position === 2);
  const thirds = qualifiers.filter(q => q.group_position === 3);
  const fourths = qualifiers.filter(q => q.group_position === 4);

  const direct = [...firsts, ...seconds];
  const potentialPrelim = Math.min(thirds.length, fourths.length);

  // Bracket target: potencia de 2 que:
  //  1) NO sea menor que direct.length (nadie clasificado pierde su lugar)
  //  2) preferimos la mayor entre direct y direct+prelim que sea potencia de 2
  //  3) si ninguna encaja, tomamos la potencia de 2 HACIA ARRIBA de direct
  let bracketSize = 0;
  if (isPow2(direct.length)) {
    bracketSize = direct.length; // No hace falta preliminar
  } else if (isPow2(direct.length + potentialPrelim)) {
    bracketSize = direct.length + potentialPrelim;
  } else {
    bracketSize = nextPow2Up(direct.length);
  }
  bracketSize = Math.max(2, bracketSize);

  // Cuántas preliminares necesitamos
  const prelimNeeded = Math.max(0, bracketSize - direct.length);
  const prelimUsed = Math.min(prelimNeeded, potentialPrelim);

  // Ronda de arranque según bracketSize
  const startingRound = nameForSize(bracketSize);
  const allRounds = roundsCascade(bracketSize);

  const matches: BracketMatchSpec[] = [];
  let order = 0;

  // ==== 1) PRELIMINARES (opcional) ====
  const prelimPairs: { fourth: Qualifier; third: Qualifier }[] = [];
  const fs = [...fourths].sort(() => 0);
  const ts = [...thirds].sort(() => 0);
  for (let i = 0; i < prelimUsed; i++) {
    const f = fs.shift()!;
    const tIdx = ts.findIndex(t => t.group_label !== f.group_label);
    const t = tIdx >= 0 ? ts.splice(tIdx, 1)[0] : ts.shift()!;
    prelimPairs.push({ fourth: f, third: t });
  }
  prelimPairs.forEach(pr => {
    matches.push({
      round: '16avos', order_index: order++,
      pair1_id: pr.fourth.pair_id, pair2_id: pr.third.pair_id
    });
  });

  // ==== 2) BRACKET PRINCIPAL ====
  // Slots: directQualifiers + prelim winners
  // Pareamos siguiendo la regla: 4º-preliminar vs 1º (de otro grupo)
  //                              3º-preliminar vs 2º (de otro grupo)
  //                              1º vs 2º (de otros grupos)
  const firstsPool = [...firsts];
  const secondsPool = [...seconds];
  const pickAvoiding = (pool: Qualifier[], avoidGroup: string) => {
    const idx = pool.findIndex(q => q.group_label !== avoidGroup);
    if (idx >= 0) return pool.splice(idx, 1)[0];
    return pool.length ? pool.shift()! : null;
  };

  const bracketMatches: BracketMatchSpec[] = [];

  // Slots para ganadores de preliminares
  prelimPairs.forEach((pr, prelIdx) => {
    // Ganador viene del 4º → cruza con 1º de otro grupo
    const rival = pickAvoiding(firstsPool, pr.fourth.group_label);
    if (rival) {
      bracketMatches.push({
        round: startingRound, order_index: order++,
        pair1_id: null, pair2_id: rival.pair_id,
        pair1_from: `16avos:${prelIdx}`
      });
    }
  });

  // 1ºs restantes vs 2ºs (de otros grupos)
  while (firstsPool.length && secondsPool.length) {
    const f = firstsPool.shift()!;
    const s = pickAvoiding(secondsPool, f.group_label);
    if (!s) break;
    bracketMatches.push({
      round: startingRound, order_index: order++,
      pair1_id: f.pair_id, pair2_id: s.pair_id
    });
  }

  // Sobrantes (si quedaron 1ºs o 2ºs sueltos): parear entre sí
  const rest = [...firstsPool, ...secondsPool];
  while (rest.length >= 2) {
    bracketMatches.push({
      round: startingRound, order_index: order++,
      pair1_id: rest.shift()!.pair_id, pair2_id: rest.shift()!.pair_id
    });
  }

  // Emparejar potencial déficit con BYE si por alguna razón faltan
  while (bracketMatches.length < bracketSize / 2) {
    bracketMatches.push({
      round: startingRound, order_index: order++,
      pair1_id: null, pair2_id: null
    });
  }

  matches.push(...bracketMatches);

  // ==== 3) RONDAS SIGUIENTES CON PLACEHOLDERS ====
  const idxOfStart = allRounds.indexOf(startingRound);
  const nextRounds = allRounds.slice(idxOfStart + 1);
  let prevRound: Round = startingRound;
  let prevMatches = bracketMatches;
  for (const nr of nextRounds) {
    const nextCount = Math.max(1, Math.floor(prevMatches.length / 2));
    const created: BracketMatchSpec[] = [];
    for (let i = 0; i < nextCount; i++) {
      const a = prevMatches[i * 2];
      const b = prevMatches[i * 2 + 1];
      created.push({
        round: nr, order_index: order++,
        pair1_id: null, pair2_id: null,
        pair1_from: a ? `${prevRound}:${a.order_index}` : undefined,
        pair2_from: b ? `${prevRound}:${b.order_index}` : undefined
      });
    }
    matches.push(...created);
    prevMatches = created;
    prevRound = nr;
    if (created.length <= 1) break;
  }

  return matches;
}

// Helpers matemáticos.
function isPow2(n: number): boolean {
  return n >= 2 && (n & (n - 1)) === 0;
}
function prevPow2(n: number): number {
  if (n < 2) return 2;
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return p;
}
function nextPow2Up(n: number): number {
  if (n <= 2) return 2;
  let p = 2;
  while (p < n) p *= 2;
  return p;
}
function nameForSize(size: number): Round {
  // size = número de parejas en el bracket → nombre de la ronda de arranque
  if (size >= 16) return '8vos';  // 16 pairs → octavos
  if (size >= 8) return 'cuartos'; // 8 pairs → cuartos
  if (size >= 4) return 'semi';    // 4 pairs → semi
  return 'final';                  // 2 pairs → final
}
function roundsCascade(size: number): Round[] {
  const out: Round[] = [];
  let n = size;
  while (n >= 2) {
    out.push(nameForSize(n));
    n = n / 2;
  }
  return out;
}
