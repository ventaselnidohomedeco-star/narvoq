import type { Round } from './types';

// Motor de bracket estilo San Miguel del Monte.
// Reglas:
//  - 8 parejas (2 grupos × 4): sin preliminar, 1º y 2º van directo a SEMIS.
//    3º y 4º quedan eliminados. Semis: 1A vs 2B, 1B vs 2A. Luego FINAL.
//  - 16+ parejas (4+ grupos × 4): fase completa.
//     · Preliminar: los 3º y 4º juegan (siempre cruzando grupos si es posible).
//     · Octavos: TODOS los clasificados (1º + 2º + winners de preliminar) juegan.
//       Cruces respetados:
//         · Winner-de-preliminar-4º  vs  1º de OTRO grupo
//         · Winner-de-preliminar-3º  vs  2º de OTRO grupo
//         · 1º restantes vs 2º restantes (de otro grupo si es posible)
//     · Cuartos, Semi y Final: cascada normal. Si en algún nivel queda un
//       número IMPAR de partidos por rearmar, la pareja con mejor
//       "ventaja deportiva" (1º > 2º > from-3rd > from-4th) obtiene BYE
//       a la siguiente ronda.

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
  // Metadata educacional para la vista pública
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
  let order = 0;

  // ==================== CASO 1: 8 parejas (2 grupos × 4) ====================
  if (groupsCount === 2 && firsts.length === 2 && seconds.length === 2) {
    // Semi 1: 1º Grupo A vs 2º Grupo B
    // Semi 2: 1º Grupo B vs 2º Grupo A
    const [fA, fB] = firsts;
    const s2ByGroup = new Map<string, typeof seconds[0]>(seconds.map(s => [s.group_label, s]));
    const sOfOtherGroup1 = seconds.find(s => s.group_label !== fA?.group_label);
    const sOfOtherGroup2 = seconds.find(s => s.group_label !== fB?.group_label);
    if (fA && fB && sOfOtherGroup1 && sOfOtherGroup2) {
      matches.push({
        round: 'semi', order_index: order++,
        pair1_id: fA.pair_id, pair2_id: sOfOtherGroup1.pair_id,
        pair1_path_hint: 'direct_from_1st', pair2_path_hint: 'direct_from_2nd'
      });
      matches.push({
        round: 'semi', order_index: order++,
        pair1_id: fB.pair_id, pair2_id: sOfOtherGroup2.pair_id,
        pair1_path_hint: 'direct_from_1st', pair2_path_hint: 'direct_from_2nd'
      });
      matches.push({
        round: 'final', order_index: order++,
        pair1_id: null, pair2_id: null,
        pair1_from: `semi:0`, pair2_from: `semi:1`
      });
    }
    return matches;
  }

  // ==================== CASO 2: 4+ grupos con preliminar ====================
  // 1) Preliminar: emparejar 3ºs con 4ºs cruzando grupos
  const prelim: {
    third: Qualifier | null;
    fourth: Qualifier | null;
  }[] = pairThirdsWithFourths(thirds, fourths);

  prelim.forEach(pr => {
    if (pr.third && pr.fourth) {
      matches.push({
        round: '16avos', order_index: order++,
        pair1_id: pr.fourth.pair_id, pair2_id: pr.third.pair_id,
        pair1_path_hint: 'preliminary_from_4th', pair2_path_hint: 'preliminary_from_3rd'
      });
    }
  });

  // 2) Octavos: TODOS los directos + winners de preliminar juegan
  //    Cruces:
  //      · Winner de "from-4th" vs 1º de otro grupo
  //      · Winner de "from-3rd" vs 2º de otro grupo
  //      · 1º restantes vs 2º restantes (evitando mismo grupo)
  //
  //    Como los winners de preliminar aún no están determinados, guardamos
  //    "pair1_from" apuntando al match de preliminar y "pair1_path_hint"
  //    con la posición ORIGINAL del ganador (4th o 3rd).
  //    Emparejamos cada slot con un 1º/2º concreto de la lista de directos.

  const firstsPool = [...firsts];
  const secondsPool = [...seconds];

  const pickAvoiding = (pool: Qualifier[], avoidGroups: string[]) => {
    let idx = pool.findIndex(q => !avoidGroups.includes(q.group_label));
    if (idx < 0) idx = 0;
    return pool.length ? pool.splice(idx, 1)[0] : null;
  };

  // 2a) Slots que reciben winners "from-4th" (cruzan con 1º de otro grupo)
  const prelimForthSlots: number[] = [];
  prelim.forEach((pr, prelIdx) => {
    if (!pr.third || !pr.fourth) return;
    // El winner puede ser 3º o 4º; asumimos que preservamos su origen.
    // Creamos DOS slots posibles: uno donde puede caer si termina "from-4th"
    // vs 1º, o "from-3rd" vs 2º.
    // Estrategia SMM: cada match de preliminar contribuye UN winner que
    // enfrenta O bien un 1º o bien un 2º según su qualification_path.
    // Aquí creamos un slot que "espera" al winner, y lo pareamos con un
    // 1º de otro grupo (asumiendo path 4th). Si el winner viene from-3rd,
    // el sistema lo detectará al propagar.
    prelimForthSlots.push(prelIdx);
  });

  // Por cada preliminar creamos un octavos match donde el winner enfrenta
  // a un 1º o 2º de otro grupo. Preferimos asignar 1ºs primero (regla for-4th).
  prelim.forEach((pr, prelIdx) => {
    if (!pr.third || !pr.fourth) return;
    const avoid = [pr.third.group_label, pr.fourth.group_label];
    // Preferentemente cruzar con un 1º de otro grupo (SMM rule para 4º)
    const rival = pickAvoiding(firstsPool, avoid)
      ?? pickAvoiding(secondsPool, avoid)
      ?? firstsPool.shift() ?? secondsPool.shift();
    if (rival) {
      matches.push({
        round: '8vos', order_index: order++,
        pair1_id: null, pair2_id: rival.pair_id,
        pair1_from: `16avos:${prelIdx}`,
        pair1_path_hint: 'preliminary_from_4th',
        pair2_path_hint: rival.group_position === 1 ? 'direct_from_1st' : 'direct_from_2nd'
      });
    }
  });

  // 2b) 1ºs restantes vs 2ºs restantes (evitando mismo grupo)
  while (firstsPool.length && secondsPool.length) {
    const f = firstsPool.shift()!;
    const s = pickAvoiding(secondsPool, [f.group_label]);
    if (!s) break;
    matches.push({
      round: '8vos', order_index: order++,
      pair1_id: f.pair_id, pair2_id: s.pair_id,
      pair1_path_hint: 'direct_from_1st', pair2_path_hint: 'direct_from_2nd'
    });
  }

  // 2c) Sobrantes de 1ºs o 2ºs (raro): parear entre sí
  const rest = [...firstsPool, ...secondsPool];
  while (rest.length >= 2) {
    matches.push({
      round: '8vos', order_index: order++,
      pair1_id: rest.shift()!.pair_id, pair2_id: rest.shift()!.pair_id
    });
  }

  // 3) Cascada: cuartos, semi, final. Añadimos BYE (auto-avance) si el
  //    número es impar en algún nivel.
  const octavosMatches = matches.filter(m => m.round === '8vos');
  buildCascade(matches, octavosMatches, ['cuartos', 'semi', 'final'], () => order++);

  return matches;
}

// Empareja los 3ºs con los 4ºs cruzando grupos si es posible.
function pairThirdsWithFourths(thirds: Qualifier[], fourths: Qualifier[]): { third: Qualifier | null; fourth: Qualifier | null }[] {
  const ts = [...thirds];
  const fs = [...fourths];
  const out: { third: Qualifier | null; fourth: Qualifier | null }[] = [];
  while (fs.length) {
    const f = fs.shift()!;
    // Preferentemente un 3º de OTRO grupo
    let tIdx = ts.findIndex(t => t.group_label !== f.group_label);
    if (tIdx < 0) tIdx = 0;
    const t = ts.length ? ts.splice(tIdx, 1)[0] : null;
    out.push({ third: t, fourth: f });
  }
  return out;
}

// Genera las rondas siguientes con placeholders. Si un nivel tiene número
// impar de partidos previos, la mejor pareja (asumida en el primer match)
// obtiene BYE.
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
    if (count === 0) return;
    if (count === 1) {
      // Ya solo queda un partido: es la final.
      return;
    }
    // Cantidad de matches en próxima ronda: floor(count/2)
    // Si es impar, un ganador de la ronda anterior pasa por BYE
    // (no crea match nuevo, avanza a la próxima ronda con un match adicional
    // que tiene solo 1 slot de "from").
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
    // Si hay BYE, el último ganador de la ronda anterior "pasa solo" a la
    // siguiente ronda. Creamos un match adicional con solo pair1_from lleno.
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
    if (created.length <= 1) return;
  }
}
