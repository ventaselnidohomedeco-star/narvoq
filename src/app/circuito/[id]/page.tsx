'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import BackButton from '@/components/BackButton';

// Vista pública de un circuito/liga anual.
// Muestra:
//  - torneos del circuito ordenados por fecha
//  - tabla acumulada de puntos por pareja/jugador
//  - podios de cada torneo
type Pair = {
  id: string;
  p1: any; p2: any;
};

const Avatar = ({ url, name, size = 'w-9 h-9' }: any) => url
  ? <img src={url} alt="" className={`${size} rounded-full object-cover`} />
  : <span className={`${size} rounded-full bg-grafito text-ball text-xs font-display font-black flex items-center justify-center`}>
      {name?.[0]?.toUpperCase() ?? '?'}
    </span>;

// Puntos acumulados según posición en cada torneo.
const POINTS = { champion: 100, finalist: 60, semi: 35, quarter: 15, group: 5 };

export default function CircuitoDetalle() {
  const { id } = useParams<{ id: string }>();
  const [circuit, setCircuit] = useState<any>(null);
  const [torneos, setTorneos] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: c } = await supabase.from('circuits')
        .select('*, complex:complexes(name, logo_url, city:cities(name))').eq('id', id).single();
      setCircuit(c);
      const { data: ts } = await supabase.from('tournaments')
        .select(`id, name, status, starts_on, ends_on, sum_target, sex,
          pairs:tournament_pairs(id,
            p1:profiles!player1_id(id, first_name, last_name, avatar_url, username),
            p2:profiles!player2_id(id, first_name, last_name, avatar_url, username)),
          matches:tournament_matches(round, winner_pair_id, pair1_id, pair2_id, score)`)
        .eq('circuit_id', id)
        .order('starts_on', { ascending: false });
      setTorneos(ts ?? []);
    })();
  }, [id]);

  // Cálculo del acumulado por pareja: para cada torneo agregamos puntos según
  // qué ronda alcanzaron.
  const acumulado = useMemo(() => {
    const map = new Map<string, { pair: Pair; puntos: number; torneos: number; podios: number }>();

    torneos.forEach(t => {
      const pairsById: Record<string, Pair> = {};
      (t.pairs ?? []).forEach((p: any) => { pairsById[p.id] = p; });

      // Reach mapping: cuál es la ronda más avanzada que jugó cada pareja
      const reach: Record<string, string> = {};
      (t.matches ?? []).forEach((m: any) => {
        [m.pair1_id, m.pair2_id].forEach((pid: string) => {
          if (pid && (!reach[pid] || rank(m.round) > rank(reach[pid]))) reach[pid] = m.round;
        });
      });

      // Ganador de la final = campeón del torneo
      const finalMatch = (t.matches ?? []).find((m: any) => /final/i.test(m.round) && !/semi/i.test(m.round));
      const championId = finalMatch?.winner_pair_id;

      Object.entries(reach).forEach(([pid, ronda]) => {
        const pair = pairsById[pid]; if (!pair) return;
        let pts = POINTS.group;
        if (pid === championId) pts = POINTS.champion;
        else if (/final/i.test(ronda) && !/semi/i.test(ronda)) pts = POINTS.finalist;
        else if (/semi/i.test(ronda)) pts = POINTS.semi;
        else if (/cuartos|cuarto/i.test(ronda)) pts = POINTS.quarter;

        // Sumamos por CADA jugador
        [pair.p1, pair.p2].forEach((player: any) => {
          if (!player?.id) return;
          const prev = map.get(player.id) ?? { pair: { id: pair.id, p1: player, p2: player }, puntos: 0, torneos: 0, podios: 0 };
          prev.puntos += pts;
          prev.torneos += 1;
          if (pid === championId) prev.podios += 1;
          prev.pair = { id: pair.id, p1: player, p2: player };
          map.set(player.id, prev);
        });
      });
    });

    return Array.from(map.values()).sort((a, b) => b.puntos - a.puntos);
  }, [torneos]);

  if (!circuit) return <main className="p-8 text-white/50">Cargando circuito…</main>;

  return (
    <main className="min-h-dvh max-w-3xl xl:max-w-5xl mx-auto px-5 pt-6 pb-16">
      <BackButton fallbackHref="/jugador/torneos" label="Torneos" />

      <header className="mt-4 flex items-center gap-4">
        {circuit.complex?.logo_url
          ? <img src={circuit.complex.logo_url} alt="" className="w-16 h-16 rounded-full object-cover" />
          : <span className="w-16 h-16 rounded-full bg-grafito flex items-center justify-center text-ball text-2xl">🏆</span>}
        <div className="flex-1 min-w-0">
          <p className="text-ball text-xs font-black tracking-widest">CIRCUITO</p>
          <h1 className="font-display font-black text-2xl leading-tight">{circuit.name}</h1>
          <p className="text-white/60 text-sm">{circuit.complex?.name} · {circuit.year}</p>
        </div>
      </header>

      {/* Podio: top 3 del acumulado */}
      {acumulado.length > 0 && (
        <section className="mt-6 rounded-2xl bg-gradient-to-br from-ball/15 via-ball/5 to-transparent border border-ball/30 p-5">
          <p className="text-ball text-xs font-black tracking-widest">🏆 TOP 3 DEL CIRCUITO</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[1, 0, 2].map(pos => {
              const row = acumulado[pos]; if (!row) return <div key={pos} />;
              const heights = ['h-24', 'h-32', 'h-20'];
              const medals = ['🥈', '🥇', '🥉'];
              return (
                <div key={pos} className="flex flex-col items-center">
                  <Link href={`/u/${row.pair.p1?.username ?? ''}`} className="mb-2">
                    <Avatar url={row.pair.p1?.avatar_url} name={row.pair.p1?.first_name} size="w-14 h-14" />
                  </Link>
                  <p className="text-xs font-black text-center truncate w-full">{row.pair.p1?.first_name}</p>
                  <p className="text-[10px] text-white/60 truncate w-full text-center">{row.pair.p1?.last_name}</p>
                  <div className={`w-full mt-2 ${heights[[1, 0, 2].indexOf(pos)]} bg-ball/20 border-t-4 border-ball rounded-t-lg flex flex-col items-center justify-end pb-2`}>
                    <span className="text-2xl">{medals[[1, 0, 2].indexOf(pos)]}</span>
                    <span className="font-display font-black text-ball text-lg">{row.puntos}</span>
                    <span className="text-white/50 text-[10px] font-bold">PTS</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Tabla acumulada completa */}
      {acumulado.length > 3 && (
        <section className="card mt-5 !p-4">
          <p className="font-display font-black text-ball text-sm">Tabla acumulada</p>
          <div className="mt-3 space-y-1.5">
            {acumulado.slice(3, 30).map((row, i) => (
              <Link key={row.pair.p1?.id ?? i} href={`/u/${row.pair.p1?.username ?? ''}`}
                className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/5">
                <span className="font-display font-black text-white/60 w-6 text-center">{i + 4}</span>
                <Avatar url={row.pair.p1?.avatar_url} name={row.pair.p1?.first_name} />
                <span className="flex-1 min-w-0">
                  <span className="font-semibold truncate block">{row.pair.p1?.first_name} {row.pair.p1?.last_name}</span>
                  <span className="text-white/50 text-xs">{row.torneos} torneos · {row.podios} podios</span>
                </span>
                <span className="font-display font-black text-ball">{row.puntos} pts</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Torneos del circuito */}
      <section className="mt-6">
        <h2 className="h-section">Fechas del circuito ({torneos.length})</h2>
        {torneos.length === 0 && <p className="text-white/50 text-sm mt-2">Todavía no hay torneos en este circuito.</p>}
        <div className="mt-3 space-y-2">
          {torneos.map(t => {
            const finalMatch = (t.matches ?? []).find((m: any) => /final/i.test(m.round) && !/semi/i.test(m.round));
            const winnerPair = (t.pairs ?? []).find((p: any) => p.id === finalMatch?.winner_pair_id);
            return (
              <Link key={t.id} href={`/torneo/${t.id}`} className="card !p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-display font-black truncate">{t.name}</p>
                  <p className="text-white/50 text-xs">
                    {t.starts_on ? new Date(t.starts_on + 'T00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : ''} ·
                    {' '}{(t.pairs?.length ?? 0)} parejas · {t.status === 'finalizado' ? '🏆 Finalizado' : t.status}
                  </p>
                  {winnerPair && (
                    <p className="text-ball text-xs font-bold mt-1 truncate">
                      🥇 {winnerPair.p1?.first_name} &amp; {winnerPair.p2?.first_name}
                    </p>
                  )}
                </div>
                <span className="text-ball font-black">→</span>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function rank(round: string) {
  if (/final/i.test(round) && !/semi/i.test(round)) return 5;
  if (/semi/i.test(round)) return 4;
  if (/cuartos|cuarto/i.test(round)) return 3;
  if (/octavos|octavo/i.test(round)) return 2;
  return 1;
}
