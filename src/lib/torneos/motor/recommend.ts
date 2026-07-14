import type { RecommendedFormat, Round } from './types';

// Recomendador de formato basado en cantidad de parejas.
// Regla San Miguel del Monte:
//   - Preferir grupos de 4. Usar grupos de 3 si sobra.
//   - Nunca grupos de 2.
//   - 1º y 2º de cada grupo pasan directo a 8vos (si hay).
//   - 3º y 4º juegan 16avos (preliminar) y el ganador entra a 8vos.
export function recommendFormat(totalPairs: number): RecommendedFormat {
  if (totalPairs < 4) {
    // No hay fase de grupos; todos a eliminación directa
    return {
      totalPairs,
      groups: { count: 0, sizes: [] },
      qualifiersPerGroup: 2,
      preliminaryRound: false,
      firstKnockoutRound: 'final',
      totalKnockoutRounds: ['final'],
      notes: [`Con ${totalPairs} parejas no hay fase de grupos. Se juega directo eliminatoria.`]
    };
  }

  // Elegir tamaños: preferentemente 4, complementar con 3, nunca 2.
  const sizes = distributeGroups(totalPairs);
  const count = sizes.length;
  const qualified = count * 2;
  // qualified suele no ser potencia de 2; el excedente juega preliminar (16avos)
  // Formato SMM: si es par pero > next power of 2, los "3º y 4º" juegan preliminar.
  const nextPower = nextPowerOf2(qualified);
  const preliminaryRound = qualified > nextPower / 2 && qualified < nextPower;
  // Ronda base más grande de la eliminación
  const roundsFromQualified = roundsForKnockout(qualified);
  const firstKnockoutRound = roundsFromQualified[0];

  const notes: string[] = [];
  notes.push(`${count} grupos: ${sizes.join('/')} parejas.`);
  notes.push(`Pasan ${qualified} parejas a eliminatoria.`);
  if (preliminaryRound) notes.push('Se juega ronda preliminar (16avos) con 3º y 4º de grupos.');
  else notes.push(`Los ${qualified} clasificados van directo a ${firstKnockoutRound}.`);

  return {
    totalPairs,
    groups: { count, sizes },
    qualifiersPerGroup: 2,
    preliminaryRound,
    firstKnockoutRound,
    totalKnockoutRounds: roundsFromQualified,
    notes
  };
}

// Distribución preferida: grupos de 4, complementar con grupos de 3.
// Nunca grupos de 2. Con 5 parejas → un grupo de 5 (excepción, muy chico).
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
  // Para 13+ armamos con módulos preferidos
  const groups: number[] = [];
  let remaining = n;
  // preferir 4s
  const fours = Math.floor(remaining / 4);
  const rem = remaining - fours * 4;
  if (rem === 0) return Array(fours).fill(4);
  if (rem === 1) return [...Array(fours - 2).fill(4), 3, 3, 3]; // sacamos dos 4s para 3 tres
  if (rem === 2) return [...Array(fours - 1).fill(4), 3, 3];   // sacamos un 4 para dos 3
  if (rem === 3) return [...Array(fours).fill(4), 3];
  return Array(fours).fill(4);
}

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function roundsForKnockout(qualified: number): Round[] {
  // Devuelve los nombres de rondas que se juegan en la fase eliminatoria
  // dado el número de clasificados directo (sin preliminar).
  const power = nextPowerOf2(qualified);
  const rounds: Round[] = [];
  const nameFor = (n: number): Round => {
    if (n <= 2) return 'final';
    if (n <= 4) return 'semi';
    if (n <= 8) return 'cuartos';
    if (n <= 16) return '8vos';
    return '16avos';
  };
  let n = power;
  while (n >= 2) {
    rounds.push(nameFor(n));
    n /= 2;
  }
  return rounds;
}
