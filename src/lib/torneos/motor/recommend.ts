import type { RecommendedFormat, Round } from './types';

// Recomendador de formato SMM (v4).
// Reglas:
//  - Mínimo 8 parejas para torneo oficial.
//  - Preferir grupos de 4. Complementar con grupos de 3 sólo si es necesario.
//  - Nunca grupos de 2.
//  - Regla de oro: la primera ronda eliminatoria "grande" (octavos/cuartos/etc.)
//    SIEMPRE debe tener un número de parejas potencia de 2 (16, 8, 4, 2).
//  - Los directos (1º + 2º de cada grupo) NO juegan preliminar.
//  - Los 4º (grupos de 4) son los primeros candidatos a jugar el "play-in".
//  - Los 3º juegan la "preliminar" (con los sobrevivientes del play-in).
//  - Si aun así hay más candidatos que slots, algunos 3º pueden pasar al play-in.
export function recommendFormat(totalPairs: number): RecommendedFormat {
  if (totalPairs < 8) {
    return {
      totalPairs,
      groups: { count: 0, sizes: [] },
      qualifiersPerGroup: 2,
      preliminaryRound: false,
      firstKnockoutRound: 'final',
      totalKnockoutRounds: ['final'],
      notes: [
        `Se necesitan al menos 8 parejas confirmadas para un torneo oficial. Hay ${totalPairs}.`,
        `Con menos parejas se puede jugar en modo amistoso sin ranking oficial.`
      ]
    };
  }

  const sizes = distributeGroups(totalPairs);
  const count = sizes.length;
  const notes: string[] = [`${count} grupos: ${sizes.join('/')} parejas cada uno.`];
  notes.push(`Cada pareja juega ${Math.min(...sizes) - 1}-${Math.max(...sizes) - 1} partido${Math.max(...sizes) > 2 ? 's' : ''} de grupo.`);

  // ---- Caso especial: 8 parejas (2 grupos × 4) → directo a semis ----
  if (totalPairs === 8 && count === 2) {
    notes.push('SIN preliminar: los 1º y 2º de cada grupo pasan directo a SEMIS.');
    notes.push('3º y 4º de cada grupo quedan eliminados en fase de grupos.');
    notes.push('Cruces de semis: 1ºA vs 2ºB, 1ºB vs 2ºA. Luego FINAL.');
    return {
      totalPairs, groups: { count, sizes }, qualifiersPerGroup: 2,
      preliminaryRound: false,
      firstKnockoutRound: 'semi',
      totalKnockoutRounds: ['semi', 'final'],
      notes
    };
  }

  // ---- Cálculo general ----
  const directs = count * 2;                    // 1º + 2º de cada grupo
  const thirdsCount = count;                    // 1 tercero por grupo (siempre)
  const fourthsCount = sizes.filter(s => s >= 4).length;
  const candidates = thirdsCount + fourthsCount;

  // La primera ronda eliminatoria "grande" debe ser potencia de 2 ≥ directos
  const firstKoSize = nextPow2(directs);
  const slotsFromPrelim = firstKoSize - directs;

  const firstKoRound: Round = koRoundForSize(firstKoSize);
  const koRounds: Round[] = buildKoRoundsFromSize(firstKoSize);

  // Sub-caso: los directos ya son potencia de 2. Van directo (sin preliminar).
  if (slotsFromPrelim === 0) {
    notes.push(`Directos: ${directs} parejas (1º y 2º de cada grupo) van directo a ${roundLabel(firstKoRound).toUpperCase()}.`);
    notes.push('3º y 4º de cada grupo quedan eliminados en fase de grupos.');
    return {
      totalPairs, groups: { count, sizes }, qualifiersPerGroup: 2,
      preliminaryRound: false,
      firstKnockoutRound: firstKoRound,
      totalKnockoutRounds: koRounds,
      notes
    };
  }

  // Necesitamos exactamente `slotsFromPrelim` clasificados del preliminar.
  // Preliminar (ronda 2): 2*slotsFromPrelim parejas jugando slotsFromPrelim partidos.
  const prelimMatches = slotsFromPrelim;
  const prelimSlots = 2 * prelimMatches;

  // A = matches de play-in necesarios para reducir candidatos a prelimSlots.
  // A > 0 → hay play-in. A ≤ 0 → no hay play-in (todos van a preliminar; puede haber BYE).
  const A = candidates - prelimSlots;

  // ---- Sin play-in: sólo preliminar (posiblemente con BYE) ----
  if (A <= 0) {
    const bye = -A;
    if (bye > 0) {
      notes.push(`Preliminar: ${prelimMatches} partidos con ${candidates} parejas (${bye} pasan con BYE).`);
    } else {
      notes.push(`Preliminar: ${prelimMatches} partidos (3º y 4º cruzando grupos). ${slotsFromPrelim} clasifican.`);
    }
    notes.push(`${roundLabel(firstKoRound)}: ${firstKoSize / 2} partidos (${firstKoSize} parejas: ${directs} directas + ${slotsFromPrelim} de preliminar).`);
    return {
      totalPairs, groups: { count, sizes }, qualifiersPerGroup: 2,
      preliminaryRound: true,
      firstKnockoutRound: firstKoRound,
      totalKnockoutRounds: koRounds,
      notes
    };
  }

  // ---- Con play-in: dos rondas ----
  // Play-in: A partidos, 2A parejas jugando, A winners.
  // Preliminar (ronda 2): thirds sobrantes + winners del play-in = prelimSlots.
  const playinPlayers = 2 * A;
  const fourthsInPlayin = Math.min(fourthsCount, playinPlayers);
  const thirdsInPlayin = playinPlayers - fourthsInPlayin;
  const thirdsInPrelim = thirdsCount - thirdsInPlayin;
  const winnersToPrelim = A;

  notes.push(`Play-in: ${A} partidos (${playinPlayers} parejas: ${fourthsInPlayin} cuartos${thirdsInPlayin > 0 ? ` + ${thirdsInPlayin} terceros` : ''}). ${A} clasifican al preliminar.`);
  notes.push(`Preliminar: ${prelimMatches} partidos (${prelimSlots} parejas: ${thirdsInPrelim} terceros directos + ${winnersToPrelim} ganadores del play-in). ${slotsFromPrelim} clasifican.`);
  notes.push(`${roundLabel(firstKoRound)}: ${firstKoSize / 2} partidos (${firstKoSize} parejas: ${directs} directas + ${slotsFromPrelim} de preliminar).`);

  return {
    totalPairs, groups: { count, sizes }, qualifiersPerGroup: 2,
    preliminaryRound: true,
    firstKnockoutRound: firstKoRound,
    totalKnockoutRounds: koRounds,
    notes
  };
}

// -------------------- Helpers exportados --------------------

// Devuelve la potencia de 2 más chica ≥ n.
export function nextPow2(n: number): number {
  if (n <= 1) return 1;
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

// Distribución de parejas en grupos. Prefiere grupos de 4.
export function distributeGroups(n: number): number[] {
  if (n < 4) return [];
  if (n === 4) return [4];
  if (n === 5) return [5];
  if (n === 6) return [3, 3];
  if (n === 7) return [4, 3];
  if (n === 8) return [4, 4];
  if (n === 9) return [3, 3, 3];
  if (n === 10) return [4, 3, 3];
  if (n === 11) return [4, 4, 3];
  if (n === 12) return [4, 4, 4];
  const fours = Math.floor(n / 4);
  const rem = n - fours * 4;
  if (rem === 0) return Array(fours).fill(4);
  if (rem === 1) return [...Array(fours - 2).fill(4), 3, 3, 3];
  if (rem === 2) return [...Array(fours - 1).fill(4), 3, 3];
  if (rem === 3) return [...Array(fours).fill(4), 3];
  return Array(fours).fill(4);
}

// Convierte tamaño de bracket (potencia de 2) al nombre de ronda.
function koRoundForSize(size: number): Round {
  if (size >= 16) return '8vos';
  if (size === 8) return 'cuartos';
  if (size === 4) return 'semi';
  return 'final';
}

// Genera las rondas eliminatorias desde el tamaño inicial hasta la final.
function buildKoRoundsFromSize(size: number): Round[] {
  const out: Round[] = [];
  let s = size;
  while (s >= 2) {
    out.push(koRoundForSize(s));
    s = s / 2;
  }
  if (!out.includes('final')) out.push('final');
  return out;
}

function roundLabel(r: Round): string {
  return r === '8vos' ? 'Octavos' : r === 'cuartos' ? 'Cuartos' : r === 'semi' ? 'Semis' : r === 'final' ? 'Final' : r;
}
