'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import BackButton from '@/components/BackButton';

type Pair = {
  id: string; tournament_id: string;
  player1_id: string; player2_id: string;
  pair_name?: string | null; zone?: string | null; seed?: number | null;
  status?: string | null;
  p1?: any; p2?: any;
};

type TMatch = {
  id: string; round: string;
  pair1_id?: string | null; pair2_id?: string | null;
  winner_pair_id?: string | null;
  score?: string | null;
  order_index: number;
};

const Avatar = ({ url, name, size = 'w-8 h-8' }: any) => url
  ? <img src={url} alt="" className={`${size} rounded-full object-cover`} />
  : <span className={`${size} rounded-full bg-grafito text-ball text-xs font-display font-black flex items-center justify-center`}>
      {name?.[0]?.toUpperCase() ?? '?'}
    </span>;

function PairView({ pair, right = false, winner = false, dim = false }: { pair?: Pair; right?: boolean; winner?: boolean; dim?: boolean }) {
  if (!pair) return <span className="text-white/30 text-xs italic">— A definir —</span>;
  return (
    <div className={`flex items-center gap-2 ${right ? 'flex-row-reverse text-right' : ''} ${dim ? 'opacity-50' : ''}`}>
      <div className="flex -space-x-2">
        <Avatar url={pair.p1?.avatar_url} name={pair.p1?.first_name} />
        <Avatar url={pair.p2?.avatar_url} name={pair.p2?.first_name} />
      </div>
      <div className="min-w-0">
        <p className={`text-sm ${winner ? 'text-ball font-black' : 'font-bold'} truncate`}>
          {pair.p1?.first_name} {pair.p1?.last_name?.[0] ?? ''}. &amp; {pair.p2?.first_name} {pair.p2?.last_name?.[0] ?? ''}.
        </p>
        {pair.seed != null && <p className="text-white/40 text-[10px]">Cabeza de serie {pair.seed}</p>}
      </div>
    </div>
  );
}

export default function TorneoDetalle() {
  const { id } = useParams<{ id: string }>();
  const [t, setT] = useState<any>(null);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [matches, setMatches] = useState<TMatch[]>([]);

  useEffect(() => {
    (async () => {
      const { data: tor } = await supabase.from('tournaments')
        .select('*, complex:complexes(name, city:cities(name), logo_url)')
        .eq('id', id).single();
      setT(tor);
      const { data: ps } = await supabase.from('tournament_pairs')
        .select(`*,
          p1:profiles!player1_id(id, username, first_name, last_name, avatar_url, category),
          p2:profiles!player2_id(id, username, first_name, last_name, avatar_url, category)`)
        .eq('tournament_id', id);
      setPairs(ps ?? []);
      const { data: ms } = await supabase.from('tournament_matches')
        .select('*').eq('tournament_id', id).order('order_index');
      setMatches(ms ?? []);
    })();
  }, [id]);

  const pairsById = useMemo(() => {
    const map: Record<string, Pair> = {};
    pairs.forEach(p => { map[p.id] = p; });
    return map;
  }, [pairs]);

  // Agrupar por ronda
  const rounds = useMemo(() => {
    const map = new Map<string, TMatch[]>();
    matches.forEach(m => {
      const arr = map.get(m.round) ?? [];
      arr.push(m);
      map.set(m.round, arr);
    });
    return Array.from(map.entries()).map(([round, ms]) => ({ round, ms }));
  }, [matches]);

  // Separar fase de grupos vs eliminatorias
  const zoneRounds = rounds.filter(r => r.round.toLowerCase().startsWith('zona'));
  const knockRounds = rounds.filter(r => !r.round.toLowerCase().startsWith('zona'));

  // Cálculo de tabla por zona
  function tablaZona(msZone: TMatch[]) {
    const stats: Record<string, { pair: Pair; pj: number; g: number; p: number; sg: number; sp: number }> = {};
    msZone.forEach(m => {
      [m.pair1_id, m.pair2_id].forEach(pid => {
        if (!pid) return;
        if (!stats[pid]) stats[pid] = { pair: pairsById[pid], pj: 0, g: 0, p: 0, sg: 0, sp: 0 };
      });
      if (!m.winner_pair_id) return;
      const sets = (m.score ?? '').split(' ').map(s => s.split('-').map(Number)).filter(a => a.length === 2 && !a.some(isNaN));
      let s1 = 0, s2 = 0;
      sets.forEach(([a, b]) => a > b ? s1++ : s2++);
      const [id1, id2] = [m.pair1_id!, m.pair2_id!];
      const isW1 = m.winner_pair_id === id1;
      stats[id1].pj++; stats[id2].pj++;
      if (isW1) { stats[id1].g++; stats[id2].p++; }
      else { stats[id2].g++; stats[id1].p++; }
      stats[id1].sg += s1; stats[id1].sp += s2;
      stats[id2].sg += s2; stats[id2].sp += s1;
    });
    return Object.values(stats)
      .sort((a, b) => b.g - a.g || (b.sg - b.sp) - (a.sg - a.sp))
      .filter(x => x.pair);
  }

  // Campeón: último match knockout con ganador que se llame "final"
  const finalMatch = knockRounds.find(r => /final(?!.*semi)/i.test(r.round))?.ms?.[0]
    ?? knockRounds.find(r => /final/i.test(r.round))?.ms?.[0];
  const campeon = finalMatch?.winner_pair_id ? pairsById[finalMatch.winner_pair_id] : null;
  const subcampeon = finalMatch?.winner_pair_id
    ? pairsById[(finalMatch.pair1_id === finalMatch.winner_pair_id ? finalMatch.pair2_id : finalMatch.pair1_id)!]
    : null;

  if (!t) return <main className="p-8 text-white/50">Cargando torneo…</main>;

  return (
    <main className="min-h-dvh max-w-md mx-auto px-5 pt-6 pb-16">
      <BackButton fallbackHref="/jugador/torneos" label="Torneos" />

      <header className="mt-3">
        <div className="flex items-center gap-3">
          {t.complex?.logo_url
            ? <img src={t.complex.logo_url} alt="" className="w-12 h-12 rounded-full object-cover" />
            : <span className="w-12 h-12 rounded-full bg-grafito flex items-center justify-center text-ball font-display font-black">🏆</span>}
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-black text-2xl leading-tight truncate">{t.name}</h1>
            <p className="text-white/60 text-sm truncate">{t.complex?.name} · {t.complex?.city?.name}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Tag>{
            t.status === 'inscripcion' ? '📝 Inscripción abierta'
              : t.status === 'en_juego' ? '⚡ En juego'
              : t.status === 'finalizado' ? '🏆 Finalizado'
              : 'Completo'
          }</Tag>
          {t.sum_target && <Tag>Suma {t.sum_target}</Tag>}
          {t.sex && <Tag>{t.sex === 'X' ? 'Mixto' : t.sex === 'F' ? 'Femenino' : 'Masculino'}</Tag>}
        </div>
      </header>

      {/* Campeón */}
      {campeon && (
        <section className="mt-6 rounded-2xl bg-gradient-to-br from-ball/20 via-ball/5 to-transparent border border-ball/30 p-5 text-center">
          <p className="text-ball text-xs font-black tracking-widest">🏆 CAMPEONES</p>
          <div className="mt-3 flex justify-center -space-x-3">
            <Avatar url={campeon.p1?.avatar_url} name={campeon.p1?.first_name} size="w-16 h-16" />
            <Avatar url={campeon.p2?.avatar_url} name={campeon.p2?.first_name} size="w-16 h-16" />
          </div>
          <p className="mt-3 font-display font-black text-xl">
            {campeon.p1?.first_name} {campeon.p1?.last_name} &amp; {campeon.p2?.first_name} {campeon.p2?.last_name}
          </p>
          {subcampeon && (
            <p className="mt-2 text-white/60 text-xs">
              Sub-campeones: {subcampeon.p1?.first_name} {subcampeon.p1?.last_name?.[0] ?? ''}. &amp; {subcampeon.p2?.first_name} {subcampeon.p2?.last_name?.[0] ?? ''}.
            </p>
          )}
          {finalMatch?.score && <p className="mt-2 text-ball font-display font-black text-lg">{finalMatch.score}</p>}
        </section>
      )}

      {/* Parejas inscriptas (si no arrancó todavía) */}
      {matches.length === 0 && pairs.length > 0 && (
        <section className="mt-6">
          <h2 className="h-section">Parejas inscriptas ({pairs.length})</h2>
          <div className="mt-3 space-y-2">
            {pairs.map(p => (
              <div key={p.id} className="card !p-3">
                <PairView pair={p} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Etapa de Clasificación */}
      {zoneRounds.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-10 h-10 rounded-full bg-ball text-courtdark font-display font-black flex items-center justify-center text-lg">1</span>
            <div>
              <p className="text-ball text-[11px] font-black tracking-widest">ETAPA 1</p>
              <h2 className="font-display font-black text-2xl leading-tight">Clasificación</h2>
              <p className="text-white/50 text-xs">Los 2 primeros de cada zona pasan a la etapa eliminatoria.</p>
            </div>
          </div>
          {zoneRounds.map(({ round, ms }) => {
            const tabla = tablaZona(ms);
            return (
              <div key={round} className="mt-3 card !p-4">
                <p className="font-display font-black text-ball text-sm">{round}</p>
                {/* Tabla de posiciones */}
                <table className="w-full mt-3 text-xs">
                  <thead>
                    <tr className="text-white/40 font-bold border-b border-white/10">
                      <th className="text-left py-1">#</th>
                      <th className="text-left py-1">Pareja</th>
                      <th className="text-center py-1">PJ</th>
                      <th className="text-center py-1">G</th>
                      <th className="text-center py-1">DS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tabla.map((row, i) => (
                      <tr key={row.pair.id} className={i < 2 ? 'text-ball font-black' : 'text-white/80'}>
                        <td className="py-1.5">{i + 1}</td>
                        <td className="py-1.5">
                          <span className="flex items-center gap-1.5">
                            <Avatar url={row.pair.p1?.avatar_url} name={row.pair.p1?.first_name} size="w-6 h-6" />
                            <span className="truncate">{row.pair.p1?.first_name} &amp; {row.pair.p2?.first_name}</span>
                          </span>
                        </td>
                        <td className="text-center">{row.pj}</td>
                        <td className="text-center">{row.g}</td>
                        <td className="text-center">{row.sg - row.sp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Partidos de esa zona */}
                <div className="mt-4 space-y-2">
                  {ms.map(m => <MatchRow key={m.id} m={m} pairsById={pairsById} />)}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Etapa Eliminatoria — bracket estilo mundial */}
      {knockRounds.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-10 h-10 rounded-full bg-ball text-courtdark font-display font-black flex items-center justify-center text-lg">2</span>
            <div>
              <p className="text-ball text-[11px] font-black tracking-widest">ETAPA 2</p>
              <h2 className="font-display font-black text-2xl leading-tight">Eliminatoria</h2>
              <p className="text-white/50 text-xs">Cuadro completo. Deslizá horizontal para ver todas las rondas.</p>
            </div>
          </div>

          <Bracket knockRounds={knockRounds} pairsById={pairsById} />
        </section>
      )}
    </main>
  );
}

function Tag({ children }: any) {
  return (
    <span className="inline-block bg-white/10 text-white/80 text-[11px] font-black uppercase rounded-full px-2.5 py-1">
      {children}
    </span>
  );
}

function MatchRow({ m, pairsById, highlight = false }: any) {
  const p1 = pairsById[m.pair1_id];
  const p2 = pairsById[m.pair2_id];
  const w1 = m.winner_pair_id === m.pair1_id;
  const w2 = m.winner_pair_id === m.pair2_id;
  const played = !!m.winner_pair_id;
  return (
    <div className={`grid grid-cols-[1fr_auto_1fr] gap-2 items-center rounded-xl p-2 ${highlight ? 'bg-white/5' : ''}`}>
      <PairView pair={p1} winner={w1} dim={played && !w1} />
      <div className="text-center">
        {m.score
          ? <p className="text-ball font-display font-black text-sm whitespace-nowrap">{m.score}</p>
          : <p className="text-white/40 text-xs">vs</p>}
      </div>
      <PairView pair={p2} right winner={w2} dim={played && !w2} />
    </div>
  );
}

// ==================== BRACKET WORLD-CUP STYLE ====================
// Rondas en columnas horizontales. Cada partido: 2 filas (team1 arriba,
// team2 abajo). Ganador destacado. Scroll horizontal en mobile.
function Bracket({ knockRounds, pairsById }: any) {
  const sorted = [...knockRounds].sort((a: any, b: any) => rank(a.round) - rank(b.round));
  // Espaciado creciente entre rondas para efecto "árbol" (cada ronda tiene la mitad de matches)
  const gapForCol = (idx: number) => {
    // idx 0: menor gap; a más ronda, más gap para alinear
    return Math.pow(2, idx) * 12;
  };

  return (
    <div className="rounded-2xl bg-[#0F141D] border border-white/10 p-4 overflow-x-auto">
      <div className="flex gap-6 min-w-max">
        {sorted.map(({ round, ms }: any, idx: number) => {
          const gap = gapForCol(idx);
          return (
            <div key={round} className="flex flex-col" style={{ minWidth: 260 }}>
              <p className="text-ball font-display font-black text-[11px] text-center mb-4 tracking-widest uppercase">
                {round}
              </p>
              <div className="flex-1 flex flex-col justify-around" style={{ gap: `${gap}px` }}>
                {ms.map((m: any) => <BracketMatch key={m.id} m={m} pairsById={pairsById} isFinal={/final(?!.*semi)/i.test(round)} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BracketMatch({ m, pairsById, isFinal }: any) {
  const p1 = pairsById[m.pair1_id];
  const p2 = pairsById[m.pair2_id];
  const w1 = m.winner_pair_id === m.pair1_id;
  const w2 = m.winner_pair_id === m.pair2_id;
  // Parseamos "6-4 3-6 6-4" en sets por team
  const setsRaw = (m.score ?? '').split(/\s+/).filter(Boolean);
  const setsT1: string[] = [];
  const setsT2: string[] = [];
  setsRaw.forEach((s: string) => {
    const [a, b] = s.split('-');
    setsT1.push(a ?? '');
    setsT2.push(b ?? '');
  });

  return (
    <div className={`rounded-xl overflow-hidden border-2 ${isFinal ? 'border-ball' : 'border-white/10'} bg-[#141A24]`}>
      <BracketRow pair={p1} winner={w1} loser={!!m.winner_pair_id && !w1} sets={setsT1} />
      <div className="h-px bg-white/10" />
      <BracketRow pair={p2} winner={w2} loser={!!m.winner_pair_id && !w2} sets={setsT2} />
    </div>
  );
}

function BracketRow({ pair, winner, loser, sets }: { pair?: any; winner: boolean; loser: boolean; sets: string[] }) {
  const bg = winner ? 'bg-ball/10 border-l-4 border-ball' : loser ? 'bg-white/[0.02]' : '';
  const nameCls = winner ? 'text-ball font-black' : loser ? 'text-white/50' : 'text-white/70';
  return (
    <div className={`flex items-center gap-2 px-3 py-2.5 ${bg}`}>
      {pair ? (
        <>
          <div className="flex -space-x-2 shrink-0">
            {pair.p1?.avatar_url
              ? <img src={pair.p1.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover border border-[#141A24]" />
              : <span className="w-7 h-7 rounded-full bg-grafito text-ball text-[10px] font-black flex items-center justify-center border border-[#141A24]">{pair.p1?.first_name?.[0]}</span>}
            {pair.p2?.avatar_url
              ? <img src={pair.p2.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover border border-[#141A24]" />
              : <span className="w-7 h-7 rounded-full bg-grafito text-ball text-[10px] font-black flex items-center justify-center border border-[#141A24]">{pair.p2?.first_name?.[0]}</span>}
          </div>
          <span className={`flex-1 min-w-0 text-xs truncate ${nameCls}`}>
            {pair.p1?.first_name} {pair.p1?.last_name?.[0] ?? ''}. &amp; {pair.p2?.first_name} {pair.p2?.last_name?.[0] ?? ''}.
          </span>
          <span className="flex gap-1 shrink-0">
            {sets.map((s, i) => (
              <span key={i} className={`w-6 text-center font-display font-black text-sm ${winner ? 'text-ball' : loser ? 'text-white/40' : 'text-white/60'}`}>
                {s || '-'}
              </span>
            ))}
          </span>
        </>
      ) : (
        <span className="flex-1 text-white/30 text-xs italic px-2 py-2">— A definir —</span>
      )}
    </div>
  );
}

// Ordena rondas de eliminatoria por avance (mayor = más cerca de la final).
function rank(round: string) {
  if (/final(?!.*semi)/i.test(round)) return 5;
  if (/semi/i.test(round)) return 4;
  if (/cuartos|cuarto/i.test(round)) return 3;
  if (/octavos|octavo/i.test(round)) return 2;
  return 1;
}
