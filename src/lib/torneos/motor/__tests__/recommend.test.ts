import { describe, it, expect } from 'vitest';
import { recommendFormat, distributeGroups, nextPow2 } from '../recommend';

describe('distributeGroups', () => {
  const cases: [number, number[]][] = [
    [8, [4, 4]],
    [9, [3, 3, 3]],
    [10, [4, 3, 3]],
    [11, [4, 4, 3]],
    [12, [4, 4, 4]],
    [13, [4, 3, 3, 3]],
    [14, [4, 4, 3, 3]],
    [15, [4, 4, 4, 3]],
    [16, [4, 4, 4, 4]],
    [22, [4, 4, 4, 4, 3, 3]],
  ];
  it.each(cases)('distribuye %i parejas correctamente', (n, expected) => {
    const got = distributeGroups(n);
    expect(got.sort((a, b) => b - a)).toEqual(expected.sort((a, b) => b - a));
  });

  it('nunca genera grupos de 2', () => {
    for (let n = 8; n <= 40; n++) {
      const g = distributeGroups(n);
      expect(g.every(s => s === 3 || s === 4 || s === 5)).toBe(true);
      expect(g.reduce((a, b) => a + b, 0)).toBe(n);
    }
  });
});

describe('nextPow2', () => {
  it('devuelve la potencia de 2 más chica ≥ n', () => {
    expect(nextPow2(6)).toBe(8);
    expect(nextPow2(8)).toBe(8);
    expect(nextPow2(9)).toBe(16);
    expect(nextPow2(12)).toBe(16);
    expect(nextPow2(16)).toBe(16);
    expect(nextPow2(17)).toBe(32);
  });
});

describe('recommendFormat', () => {
  it('rechaza torneos con menos de 8 parejas', () => {
    const r = recommendFormat(7);
    expect(r.notes.some(n => /8 parejas/i.test(n))).toBe(true);
  });

  it('8 parejas → 2×4, sin preliminar, arranca en semis', () => {
    const r = recommendFormat(8);
    expect(r.groups.count).toBe(2);
    expect(r.preliminaryRound).toBe(false);
    expect(r.firstKnockoutRound).toBe('semi');
    expect(r.totalKnockoutRounds).toEqual(['semi', 'final']);
  });

  it('16 parejas → 4×4, sin preliminar, arranca en cuartos', () => {
    const r = recommendFormat(16);
    expect(r.groups.count).toBe(4);
    expect(r.preliminaryRound).toBe(false);
    expect(r.firstKnockoutRound).toBe('cuartos');
  });

  it('22 parejas → 6 grupos, play-in + preliminar + octavos', () => {
    const r = recommendFormat(22);
    expect(r.groups.count).toBe(6);
    expect(r.groups.sizes.sort()).toEqual([3, 3, 4, 4, 4, 4]);
    expect(r.preliminaryRound).toBe(true);
    expect(r.firstKnockoutRound).toBe('8vos');
    // Verificamos que las notas describan bien el play-in y preliminar
    const joined = r.notes.join(' ');
    expect(joined).toMatch(/Play-in/i);
    expect(joined).toMatch(/Preliminar/i);
    expect(joined).toMatch(/Octavos/i);
  });

  it('12 parejas → 3×4 con play-in + preliminar → cuartos', () => {
    const r = recommendFormat(12);
    expect(r.groups.count).toBe(3);
    expect(r.preliminaryRound).toBe(true);
    expect(r.firstKnockoutRound).toBe('cuartos');
  });
});
