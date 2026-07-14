import type { Round, PairRef } from './types';

// Genera la fase eliminatoria estilo SMM (San Miguel del Monte):
//  - 1º y 2º de cada grupo pasan directo a 8vos.
//  - 3º y 4º juegan 16avos (preliminar). El ganador entra a 8vos manteniendo
//    su posición de grupo.
//  - En 8vos:
//     * ganador-de-16avos-que-fue-4º  vs  1º de otro grupo
//     * ganador-de-16avos-que-fue-3º  vs  2º de otro grupo
//  - Evitamos siempre que sea posible:
//     * Cruce entre parejas del mismo grupo
//     * 1º vs 1º
//     * 2º vs 2º
//     * Repetir un partido ya jugado en fase de grupos
//
// La función NO consulta la DB; recibe la lista de clasificados por grupo
// (con posición 1..N y group label) y devuelve los partidos por ronda.

export interface Qualifier {
  pair_id: string;
  group_label: string;    // 'A','B','C',...
  group_position: number; // 1..N
}

export interface BracketMatchSpec {
  round: Round;
  order_index: number;
  pair1_id: string | null;
  pair2_id: string | null;
  // Placeholder cuando el rival sale de una ronda previa
  pair1_from?: string;    // ej: '16avos:0' → ganador del partido 0 de 16avos
  pair2_from?: string;
}

export function buildBracket(qualifiers: Qualifier[]): BracketMatchSpec[] {
  const q = [...qualifiers];
  const byPos = (n: number) => q.filter(x => x.group_position === n);
  const firsts = byPos(1);
  const seconds = byPos(2);
  const thirds = byPos(3);
  const fourths = byPos(4);

  const matches: BracketMatchSpec[] = [];
  let order = 0;

  // 1) Preliminar (16avos) — 3ºs y 4ºs juegan entre sí, cruzando grupos
  // Cada 4º juega contra un 3º de OTRO grupo. Emparejamos evitando mismo grupo.
  const preliminaries: { fourth: Qualifier; third: Qualifier }[] = [];
  const fourthsCopy = [...fourths];
  const thirdsCopy = [...thirds];
  while (fourthsCopy.length && thirdsCopy.length) {
    const f = fourthsCopy.shift()!;
    // buscar tercer de OTRO grupo
    const tIdx = thirdsCopy.findIndex(t => t.group_label !== f.group_label);
    const t = tIdx >= 0 ? thirdsCopy.splice(tIdx, 1)[0] : thirdsCopy.shift()!;
    preliminaries.push({ fourth: f, third: t });
  }
  preliminaries.forEach(({ fourth, third }, i) => {
    matches.push({
      round: '16avos', order_index: order++,
      pair1_id: fourth.pair_id, pair2_id: third.pair_id
    });
  });

  // 2) 8vos (si aplica). Sino, se puede pasar directo a cuartos/semi/final.
  const totalClasificados = firsts.length + seconds.length + preliminaries.length;
  const nextPower = nextPowerOf2(totalClasificados);

  // Construcción de 8vos:
  //  slot 1º-vs-ganador-de-16avos-que-era-4º
  //  slot 2º-vs-ganador-de-16avos-que-era-3º
  //  1º vs 2º (de grupos distintos) para completar
  const octavos: BracketMatchSpec[] = [];
  const orderStart = order;

  // pairing helper: evita mismo grupo
  const pickFrom = (pool: Qualifier[], avoidGroup: string): Qualifier | null => {
    const iOther = pool.findIndex(x => x.group_label !== avoidGroup);
    if (iOther >= 0) return pool.splice(iOther, 1)[0];
    return pool.length ? pool.shift()! : null;
  };

  const firstsPool = [...firsts];
  const secondsPool = [...seconds];

  // 8vos con ganadores de preliminares
  preliminaries.forEach((prel, prelIdx) => {
    // ganador venía como 4º → juega contra 1º de otro grupo
    // ganador venía como 3º → juega contra 2º de otro grupo
    // Nota: no sabemos aún quién ganó el prel, por eso guardamos placeholders.
    // Al crear el bracket asumimos que si el 4º avanza, va contra un 1º.
    // Al persistir, cuando se cargue el resultado del preliminar, el sistema
    // llenará el slot correspondiente.
    const rival1 = pickFrom(firstsPool, prel.fourth.group_label);
    if (rival1) {
      octavos.push({
        round: '8vos', order_index: order++,
        pair1_id: null, pair2_id: rival1.pair_id,
        pair1_from: `16avos:${prelIdx}`
      });
    }
  });

  // Emparejar 1ºs y 2ºs restantes: 1º vs 2º evitando mismo grupo
  while (firstsPool.length && secondsPool.length) {
    const f = firstsPool.shift()!;
    const s = pickFrom(secondsPool, f.group_label);
    if (!s) break;
    octavos.push({
      round: '8vos', order_index: order++,
      pair1_id: f.pair_id, pair2_id: s.pair_id
    });
  }
  // Sobrantes (raro, pero por seguridad): pasan por bye o se enfrentan entre sí
  const rest = [...firstsPool, ...secondsPool];
  while (rest.length >= 2) {
    octavos.push({
      round: '8vos', order_index: order++,
      pair1_id: rest.shift()!.pair_id,
      pair2_id: rest.shift()!.pair_id
    });
  }

  matches.push(...octavos);

  // 3) Rondas siguientes con placeholders
  const rounds: Round[] = ['cuartos', 'semi', 'final'];
  let currentCount = octavos.length;
  const startingRound: Round = currentCount >= 8 ? '8vos' : currentCount >= 4 ? 'cuartos' : currentCount >= 2 ? 'semi' : 'final';

  // Determinar próximas rondas
  let prevRound: Round = startingRound;
  let prevMatches = octavos;
  const nextRounds = rounds.slice(rounds.indexOf(prevRound === '8vos' ? 'cuartos' : prevRound));
  for (const nr of nextRounds) {
    if (nr === prevRound) continue;
    const nextCount = Math.max(1, Math.floor(prevMatches.length / 2));
    const created: BracketMatchSpec[] = [];
    for (let i = 0; i < nextCount; i++) {
      const idxA = i * 2;
      const idxB = i * 2 + 1;
      created.push({
        round: nr,
        order_index: order++,
        pair1_id: null,
        pair2_id: null,
        pair1_from: prevMatches[idxA] ? `${prevRound}:${prevMatches[idxA].order_index}` : undefined,
        pair2_from: prevMatches[idxB] ? `${prevRound}:${prevMatches[idxB].order_index}` : undefined
      });
    }
    matches.push(...created);
    prevMatches = created;
    prevRound = nr;
    if (created.length <= 1) break;
  }

  return matches;
}

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}
