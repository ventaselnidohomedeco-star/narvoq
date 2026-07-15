import type { GroupStanding, MatchInput, SetScore } from './types';

// Calcula la tabla del grupo con desempate multi-nivel + mini-tabla si empatan 3+.
// Reglas:
//   PJ, PG, PP, SF, SC, DS, GF, GC, DG, PTS (3 por victoria)
//   Desempate:
//     1) pts
//     2) resultado entre empatados (head to head), si son 2
//     3) mini-tabla entre empatados, si son 3+
//     4) diferencia de sets
//     5) diferencia de games
//     6) games ganados
//     7) sorteo (marcamos tied_with y dejamos que el organizador decida)
export function computeStandings(
  memberIds: string[],
  matches: MatchInput[],
  opts?: { pointsWin?: number; pointsLoss?: number }
): GroupStanding[] {
  const W = opts?.pointsWin ?? 3;
  const L = opts?.pointsLoss ?? 0;

  const base: Record<string, GroupStanding> = {};
  memberIds.forEach(id => {
    base[id] = { pair_id: id, pj: 0, pg: 0, pp: 0, sf: 0, sc: 0, ds: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
  });

  matches.forEach(m => {
    if (!m.pair1_id || !m.pair2_id) return;
    const winner = m.winner_pair_id ?? m.special_winner_pair_id;
    if (!winner) return;

    const { s1, s2, g1, g2 } = tallyMatch(m);
    const a = base[m.pair1_id], b = base[m.pair2_id];
    if (!a || !b) return;

    a.pj++; b.pj++;
    a.sf += s1; a.sc += s2; a.gf += g1; a.gc += g2;
    b.sf += s2; b.sc += s1; b.gf += g2; b.gc += g1;

    if (winner === m.pair1_id) { a.pg++; b.pp++; a.pts += W; b.pts += L; }
    else { b.pg++; a.pp++; b.pts += W; a.pts += L; }
  });

  // Diferencias
  Object.values(base).forEach(s => { s.ds = s.sf - s.sc; s.dg = s.gf - s.gc; });

  const list = Object.values(base);

  // Sorting con desempates
  return sortWithTiebreaks(list, matches);
}

function tallyMatch(m: MatchInput): { s1: number; s2: number; g1: number; g2: number } {
  let s1 = 0, s2 = 0, g1 = 0, g2 = 0;
  (m.sets ?? []).forEach(set => {
    g1 += set.t1;
    g2 += set.t2;
    if (set.t1 > set.t2) s1++;
    else if (set.t2 > set.t1) s2++;
  });
  // Walkover / DQ / abandono ya vienen con winner_pair_id fijado pero sin sets.
  // Contamos 2-0 6-0 6-0 para stats en ese caso (regla común).
  if ((m.special_result === 'walkover' || m.special_result === 'dq') && s1 + s2 === 0 && m.special_winner_pair_id) {
    if (m.special_winner_pair_id === m.pair1_id) { s1 = 2; g1 = 12; g2 = 0; }
    else { s2 = 2; g2 = 12; g1 = 0; }
  }
  return { s1, s2, g1, g2 };
}

function sortWithTiebreaks(list: GroupStanding[], allMatches: MatchInput[]): GroupStanding[] {
  const cmp = (a: GroupStanding, b: GroupStanding) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.ds !== a.ds) return b.ds - a.ds;
    if (b.dg !== a.dg) return b.dg - a.dg;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return 0;
  };

  const sorted = [...list].sort(cmp);

  // Detectar grupos de empatados en pts para calcular head-to-head o mini-tabla
  const groups: GroupStanding[][] = [];
  let cur: GroupStanding[] = [];
  sorted.forEach((s, i) => {
    if (i === 0) { cur = [s]; return; }
    if (s.pts === cur[cur.length - 1].pts) cur.push(s);
    else { groups.push(cur); cur = [s]; }
  });
  if (cur.length) groups.push(cur);

  const finalOrder: GroupStanding[] = [];
  for (const g of groups) {
    if (g.length <= 1) { finalOrder.push(...g); continue; }
    if (g.length === 2) {
      // head-to-head entre los dos
      const [a, b] = g;
      const m = allMatches.find(x =>
        (x.pair1_id === a.pair_id && x.pair2_id === b.pair_id) ||
        (x.pair1_id === b.pair_id && x.pair2_id === a.pair_id));
      const winner = m?.winner_pair_id ?? m?.special_winner_pair_id;
      if (winner === a.pair_id) finalOrder.push(a, b);
      else if (winner === b.pair_id) finalOrder.push(b, a);
      else finalOrder.push(...g); // ya ordenados por diferencias
    } else {
      // 3+: mini-tabla entre los empatados.
      // Cortamos recursión si la mini-tabla NO reduce el empate (mismo set con mismos puntajes):
      // en ese caso volvemos al orden por diferencias globales.
      const ids = g.map(x => x.pair_id);
      const miniMatches = allMatches.filter(
        m => m.pair1_id && m.pair2_id && ids.includes(m.pair1_id) && ids.includes(m.pair2_id)
      );
      const miniBase: GroupStanding[] = ids.map(id => ({
        pair_id: id, pj: 0, pg: 0, pp: 0, sf: 0, sc: 0, ds: 0, gf: 0, gc: 0, dg: 0, pts: 0
      }));
      miniMatches.forEach(m => {
        if (!m.pair1_id || !m.pair2_id) return;
        const winner = m.winner_pair_id ?? m.special_winner_pair_id;
        if (!winner) return;
        const { s1, s2, g1, g2 } = tallyMatch(m);
        const a = miniBase.find(x => x.pair_id === m.pair1_id)!;
        const b = miniBase.find(x => x.pair_id === m.pair2_id)!;
        a.pj++; b.pj++;
        a.sf += s1; a.sc += s2; a.gf += g1; a.gc += g2;
        b.sf += s2; b.sc += s1; b.gf += g2; b.gc += g1;
        if (winner === m.pair1_id) { a.pg++; a.pts += 3; }
        else { b.pg++; b.pts += 3; }
      });
      miniBase.forEach(s => { s.ds = s.sf - s.sc; s.dg = s.gf - s.gc; });

      // Ordenamos la mini-tabla por pts → ds → dg → gf (SIN recursionar)
      const miniSorted = [...miniBase].sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.ds !== a.ds) return b.ds - a.ds;
        if (b.dg !== a.dg) return b.dg - a.dg;
        return b.gf - a.gf;
      });

      // Si la mini-tabla no rompió el empate (todos con mismos pts/ds/dg/gf),
      // se caerá en el sorteo determinístico (mantener orden estable).
      finalOrder.push(...miniSorted.map(m => list.find(l => l.pair_id === m.pair_id)!));
    }
  }

  // final_position
  finalOrder.forEach((s, i) => { s.final_position = i + 1; });

  // marcamos tied_with para transparencia
  finalOrder.forEach(s => {
    const same = finalOrder.filter(o => o.pts === s.pts && o.pair_id !== s.pair_id);
    if (same.length) s.tied_with = same.map(o => o.pair_id);
  });

  return finalOrder;
}
