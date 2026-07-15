import { describe, it, expect } from 'vitest';
import { buildGroups, roundRobinMatches } from '../groups';

const mkPairs = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}` }));

describe('buildGroups', () => {
  it('todas las parejas quedan asignadas', () => {
    const pairs = mkPairs(22);
    const groups = buildGroups(pairs);
    const total = groups.reduce((sum, g) => sum + g.members.length, 0);
    expect(total).toBe(22);
  });

  it('ninguna pareja se repite entre grupos', () => {
    const pairs = mkPairs(16);
    const groups = buildGroups(pairs);
    const all = groups.flatMap(g => g.members.map(m => m.id));
    expect(new Set(all).size).toBe(16);
  });

  it('respeta tamaños esperados 4/4/4/4/3/3 para 22 parejas', () => {
    const groups = buildGroups(mkPairs(22));
    const sizes = groups.map(g => g.members.length).sort((a, b) => b - a);
    expect(sizes).toEqual([4, 4, 4, 4, 3, 3]);
  });

  it('es determinístico con el mismo seed', () => {
    const p = mkPairs(12);
    const g1 = buildGroups(p, { seed: 42 });
    const g2 = buildGroups(p, { seed: 42 });
    expect(g1.map(g => g.members.map(m => m.id))).toEqual(g2.map(g => g.members.map(m => m.id)));
  });
});

describe('roundRobinMatches', () => {
  it('grupo de 4 → 6 partidos, cada pareja juega 3', () => {
    const members = mkPairs(4);
    const matches = roundRobinMatches(members);
    expect(matches).toHaveLength(6);
    // Contar cuántas veces aparece cada pareja
    const counts: Record<string, number> = {};
    matches.forEach(m => {
      counts[m.pair1_id] = (counts[m.pair1_id] ?? 0) + 1;
      counts[m.pair2_id] = (counts[m.pair2_id] ?? 0) + 1;
    });
    Object.values(counts).forEach(c => expect(c).toBe(3));
  });

  it('grupo de 3 → 3 partidos, cada pareja juega 2', () => {
    const members = mkPairs(3);
    const matches = roundRobinMatches(members);
    expect(matches).toHaveLength(3);
    const counts: Record<string, number> = {};
    matches.forEach(m => {
      counts[m.pair1_id] = (counts[m.pair1_id] ?? 0) + 1;
      counts[m.pair2_id] = (counts[m.pair2_id] ?? 0) + 1;
    });
    Object.values(counts).forEach(c => expect(c).toBe(2));
  });

  it('no genera partidos duplicados', () => {
    const members = mkPairs(4);
    const matches = roundRobinMatches(members);
    const keys = matches.map(m => [m.pair1_id, m.pair2_id].sort().join('|'));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('para 22 parejas (4/4/4/4/3/3) genera 30 partidos totales', () => {
    // 4 grupos de 4 → 6×4 = 24
    // 2 grupos de 3 → 3×2 = 6
    // Total = 30
    const groups = buildGroups(mkPairs(22));
    let total = 0;
    groups.forEach(g => {
      total += roundRobinMatches(g.members).length;
    });
    expect(total).toBe(30);
  });
});
