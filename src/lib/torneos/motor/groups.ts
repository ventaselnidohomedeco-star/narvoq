import type { PairRef } from './types';
import { distributeGroups } from './recommend';

// Distribuye parejas en grupos evitando cabezas de serie en el mismo grupo.
// Siembra tipo "serpiente": cabezas de serie se distribuyen primero,
// después el resto se ubica pseudo-aleatoriamente (con seed opcional).
export function buildGroups(pairs: PairRef[], opts?: { seed?: number }): { label: string; members: PairRef[] }[] {
  const sizes = distributeGroups(pairs.length);
  if (sizes.length === 0) return [];

  const labels = sizes.map((_, i) => String.fromCharCode(65 + i));

  // Cabezas de serie (con seed !== null) van primero, uno por grupo.
  const seeded = pairs.filter(p => p.seed != null).sort((a, b) => (a.seed as number) - (b.seed as number));
  const unseeded = pairs.filter(p => p.seed == null);

  // Mezcla determinística de unseeded con un LCG simple para permitir reproducir
  const shuffledUnseeded = seededShuffle(unseeded, opts?.seed ?? 1);

  const groups: { label: string; members: PairRef[] }[] =
    labels.map(l => ({ label: l, members: [] }));

  // 1) sembrar cabezas de serie por grupo (round-robin sobre labels)
  seeded.forEach((p, i) => groups[i % groups.length].members.push(p));

  // 2) rellenar el resto respetando tamaños objetivo
  let idx = 0;
  for (const p of shuffledUnseeded) {
    // Buscamos el próximo grupo con espacio libre
    while (groups[idx % groups.length].members.length >= sizes[idx % groups.length]) idx++;
    groups[idx % groups.length].members.push(p);
    idx++;
  }

  return groups;
}

// Genera todos los partidos round-robin de un grupo (cada pareja vs cada otra).
export function roundRobinMatches(members: PairRef[]): { pair1_id: string; pair2_id: string; order_index: number }[] {
  const out: { pair1_id: string; pair2_id: string; order_index: number }[] = [];
  let idx = 0;
  for (let i = 0; i < members.length; i++)
    for (let j = i + 1; j < members.length; j++)
      out.push({ pair1_id: members[i].id, pair2_id: members[j].id, order_index: idx++ });
  return out;
}

// Barajado determinístico basado en seed (LCG). Puro y reproducible.
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = Math.abs(seed) || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
