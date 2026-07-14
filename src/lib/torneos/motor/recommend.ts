import type { RecommendedFormat, Round } from './types';

// Recomendador de formato SMM.
// Reglas:
//  - Mínimo 8 parejas para torneo oficial.
//  - Preferir grupos de 4. Complementar con grupos de 3 sólo si es necesario.
//  - Nunca grupos de 2.
//  - Para 8 parejas: 2 grupos × 4 → SIN preliminar. Semis directas. 3º y 4º eliminados.
//  - Para 16+ parejas: preliminar (3º y 4º) → octavos (todos juegan) → cuartos → semi → final.
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

  // 8 parejas: caso especial
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

  // 16+ parejas
  const direct = count * 2;                       // 1º y 2º de cada grupo
  const preliminaryMatches = Math.floor(count * 2 / 2);  // 3º y 4º pairs (mínimo)
  const preliminaryWinners = preliminaryMatches;
  const octavosPairs = direct + preliminaryWinners;
  const octavosMatches = Math.ceil(octavosPairs / 2);

  notes.push(`Preliminar: ${preliminaryMatches} partidos (3º y 4º cruzando grupos). ${preliminaryWinners} clasifican.`);
  notes.push(`Octavos: ${octavosMatches} partidos (${octavosPairs} parejas: ${direct} directas + ${preliminaryWinners} de preliminar).`);
  notes.push(`Regla de cruces en octavos: winners-de-4º vs 1º de otro grupo, winners-de-3º vs 2º de otro grupo.`);

  // Rondas siguientes
  let nMatches = octavosMatches;
  const rounds: Round[] = ['8vos'];
  while (nMatches > 1) {
    nMatches = Math.ceil(nMatches / 2);
    if (nMatches === 1) rounds.push('final');
    else if (nMatches === 2) rounds.push('semi');
    else if (nMatches === 4) rounds.push('cuartos');
    else rounds.push('8vos');
  }
  if (!rounds.includes('final')) rounds.push('final');

  return {
    totalPairs, groups: { count, sizes }, qualifiersPerGroup: 2,
    preliminaryRound: true,
    firstKnockoutRound: '8vos',
    totalKnockoutRounds: rounds,
    notes
  };
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
  const groups: number[] = [];
  const remaining = n;
  const fours = Math.floor(remaining / 4);
  const rem = remaining - fours * 4;
  if (rem === 0) return Array(fours).fill(4);
  if (rem === 1) return [...Array(fours - 2).fill(4), 3, 3, 3];
  if (rem === 2) return [...Array(fours - 1).fill(4), 3, 3];
  if (rem === 3) return [...Array(fours).fill(4), 3];
  return Array(fours).fill(4);
}
