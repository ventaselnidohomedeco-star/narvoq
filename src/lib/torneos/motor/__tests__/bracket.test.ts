import { describe, it, expect } from 'vitest';
import { buildBracket } from '../bracket';
import type { Qualifier } from '../bracket';

// Genera qualifiers con IDs sintéticos, N grupos.
// sizes[i] indica cuántas parejas hay en el grupo i.
function mkQualifiers(sizes: number[]): Qualifier[] {
  const out: Qualifier[] = [];
  sizes.forEach((size, gi) => {
    const label = String.fromCharCode(65 + gi);
    for (let pos = 1; pos <= size; pos++) {
      out.push({ pair_id: `g${label}p${pos}`, group_label: label, group_position: pos });
    }
  });
  return out;
}

function countByRound(matches: any[]): Record<string, number> {
  const acc: Record<string, number> = {};
  matches.forEach(m => { acc[m.round] = (acc[m.round] ?? 0) + 1; });
  return acc;
}

describe('buildBracket - 8 parejas', () => {
  const q = mkQualifiers([4, 4]);
  const bracket = buildBracket(q);

  it('genera 2 semis y 1 final (sin preliminar)', () => {
    const counts = countByRound(bracket);
    expect(counts['semi']).toBe(2);
    expect(counts['final']).toBe(1);
    expect(counts['32avos']).toBeUndefined();
    expect(counts['16avos']).toBeUndefined();
    expect(counts['8vos']).toBeUndefined();
  });

  it('cruces de semi: 1º vs 2º de otro grupo', () => {
    const semis = bracket.filter(m => m.round === 'semi');
    semis.forEach(s => {
      // Verificamos que sean qualifiers concretos (no null)
      expect(s.pair1_id).toBeTruthy();
      expect(s.pair2_id).toBeTruthy();
    });
  });
});

describe('buildBracket - 16 parejas (4×4)', () => {
  const q = mkQualifiers([4, 4, 4, 4]);
  const bracket = buildBracket(q);

  it('sin preliminar: 4 cuartos + 2 semis + 1 final = 7 matches', () => {
    const counts = countByRound(bracket);
    expect(counts['cuartos']).toBe(4);
    expect(counts['semi']).toBe(2);
    expect(counts['final']).toBe(1);
    expect(counts['32avos']).toBeUndefined();
    expect(counts['16avos']).toBeUndefined();
    expect(counts['8vos']).toBeUndefined();
  });
});

describe('buildBracket - 12 parejas (3×4)', () => {
  const q = mkQualifiers([4, 4, 4]);
  const bracket = buildBracket(q);

  it('play-in + preliminar + cuartos, cierra en potencia de 2', () => {
    const counts = countByRound(bracket);
    // 6 directos, cuartos=8, slots=2, cand=6, A=6-4=2
    // → 2 matches de play-in, 2 preliminar, 4 cuartos, 2 semi, 1 final
    expect(counts['32avos']).toBe(2);
    expect(counts['16avos']).toBe(2);
    expect(counts['cuartos']).toBe(4);
    expect(counts['semi']).toBe(2);
    expect(counts['final']).toBe(1);
  });
});

describe('buildBracket - 22 parejas (4×4 + 2×3)', () => {
  const q = mkQualifiers([4, 4, 4, 4, 3, 3]);
  const bracket = buildBracket(q);

  it('play-in con 2 matches (4 cuartos)', () => {
    const counts = countByRound(bracket);
    expect(counts['32avos']).toBe(2);
  });

  it('preliminar con 4 matches (6 terceros + 2 winners = 8)', () => {
    const counts = countByRound(bracket);
    expect(counts['16avos']).toBe(4);
  });

  it('OCTAVOS con exactamente 8 matches (16 parejas)', () => {
    const counts = countByRound(bracket);
    expect(counts['8vos']).toBe(8);
  });

  it('cierra: cuartos=4, semi=2, final=1', () => {
    const counts = countByRound(bracket);
    expect(counts['cuartos']).toBe(4);
    expect(counts['semi']).toBe(2);
    expect(counts['final']).toBe(1);
  });

  it('los 12 directos (1º + 2º) aparecen en octavos', () => {
    const directos = q.filter(qu => qu.group_position <= 2).map(qu => qu.pair_id);
    const octavos = bracket.filter(m => m.round === '8vos');
    const idsEnOctavos = new Set<string>();
    octavos.forEach(m => {
      if (m.pair1_id) idsEnOctavos.add(m.pair1_id);
      if (m.pair2_id) idsEnOctavos.add(m.pair2_id);
    });
    // Todos los directos deben estar en octavos (12 slots concretos + 4 vía from)
    directos.forEach(id => expect(idsEnOctavos.has(id)).toBe(true));
  });
});

describe('buildBracket - 24 parejas (6×4)', () => {
  const q = mkQualifiers([4, 4, 4, 4, 4, 4]);
  const bracket = buildBracket(q);

  it('cierra matemáticamente en octavos (16 parejas)', () => {
    const counts = countByRound(bracket);
    // directs=12, slots=4, cand=12, A=12-8=4 → play-in 4 matches, preliminar 4
    expect(counts['32avos']).toBe(4);
    expect(counts['16avos']).toBe(4);
    expect(counts['8vos']).toBe(8);
  });
});
