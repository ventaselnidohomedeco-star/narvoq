'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import PlacaButton from '@/components/PlacaButton';
import { DonutChart, ChartLegend, BarChart } from '@/components/Charts';
import VerifiedBadge from '@/components/VerifiedBadge';
import TrialCountdown from '@/components/TrialCountdown';
import type { Profile } from '@/lib/types';

export default function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState({ played: 0, won: 0, lost: 0, points: 0, trainings: 0 });
  const [upcoming, setUpcoming] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(p);

      const { data: pts } = await supabase.from('ranking_points').select('points, ref_tournament_id').eq('player_id', user.id);
      // Puntos de ranking: solo de torneos.
      const points = (pts ?? []).filter(r => r.ref_tournament_id).reduce((a, r) => a + r.points, 0);
      // Contamos partidos jugados desde los results (amistosos + torneos con resultado cargado)
      const { data: myMatches } = await supabase.from('match_players')
        .select('team, match:matches(result:results(winner_team, status))')
        .eq('player_id', user.id);
      let won = 0, lost = 0;
      (myMatches ?? []).forEach((mp: any) => {
        const r = mp.match?.result?.[0];
        if (!r) return;
        if (r.winner_team === mp.team) won++; else lost++;
      });
      const { count: trainings } = await supabase.from('trainings')
        .select('*', { count: 'exact', head: true }).eq('player_id', user.id);

      const { data: up } = await supabase.from('match_players')
        .select('match:matches(id, booking:bookings(starts_at, court:courts(name, complex:complexes(name))))')
        .eq('player_id', user.id).limit(20);
      const future = (up ?? [])
        .map((r: any) => r.match)
        .filter((m: any) => m?.booking && new Date(m.booking.starts_at) > new Date())
        .sort((a: any, b: any) => a.booking.starts_at.localeCompare(b.booking.starts_at));

      setStats({ played: won + lost, won, lost, points, trainings: trainings ?? 0 });
      setUpcoming(future.slice(0, 3));
    })();
  }, []);

  return (
    <main className="px-5 pt-6 pb-8">
      <header className="flex items-center gap-5">
        {profile && (
          <Link href="/jugador/perfil" className="shrink-0 relative">
            <div className="p-[3px] rounded-full bg-gradient-to-tr from-ball via-lime-300 to-emerald-400">
              <div className="p-[2px] rounded-full bg-black">
                {profile.avatar_url
                  ? <img src={profile.avatar_url} alt="" className="w-24 h-24 md:w-28 md:h-28 rounded-full object-cover" />
                  : <span className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-grafito text-ball font-display font-black text-4xl flex items-center justify-center">
                      {profile.first_name?.[0]}
                    </span>}
              </div>
            </div>
          </Link>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white/60 text-base">Hola,</p>
          <h1 className="font-display font-black text-3xl md:text-4xl leading-tight truncate">
            {profile?.first_name ?? '…'}
            <VerifiedBadge show={(profile as any)?.is_premium} size="lg" />
          </h1>
          {profile && (
            <p className="text-ball text-base font-bold mt-1">Categoría {profile.category}</p>
          )}
          <div className="mt-2">
            <TrialCountdown premiumExpiresAt={(profile as any)?.premium_expires_at} />
          </div>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-3 gap-3">
        {[
          { n: stats.played, l: 'Jugados', href: '/jugador/reservas?tab=historial' },
          { n: stats.won, l: 'Ganados', href: '/jugador/reservas?tab=historial' },
          { n: stats.points, l: 'Pts. ranking', href: '/jugador/ranking' }
        ].map(s => (
          <Link key={s.l} href={s.href} className="card !p-4 text-center active:scale-95 transition">
            <p className="font-display font-black text-4xl md:text-5xl text-ball">{s.n}</p>
            <p className="text-white/70 text-sm font-bold uppercase tracking-wider mt-2">{s.l}</p>
          </Link>
        ))}
      </section>

      {/* Chart: winrate y balance — SOLO Premium */}
      {stats.played > 0 && (profile as any)?.is_premium && (
        <section className="card mt-4 !p-5">
          <p className="font-display font-black text-ball text-xs tracking-widest">TU BALANCE</p>
          <div className="mt-3 flex items-center gap-5">
            <DonutChart
              segments={[
                { label: 'Ganados', value: stats.won, color: '#D8F646' },
                { label: 'Perdidos', value: stats.lost, color: '#3A404A' }
              ]}
              size={130} thickness={22}
              centerLabel={`${Math.round(stats.won / Math.max(1, stats.played) * 100)}%`}
              centerSub="winrate"
            />
            <div className="flex-1 min-w-0">
              <ChartLegend segments={[
                { label: 'Ganados', value: stats.won, color: '#D8F646' },
                { label: 'Perdidos', value: stats.lost, color: '#3A404A' }
              ]} />
              <p className="text-white/50 text-xs mt-2">Total: {stats.played} partidos</p>
            </div>
          </div>
        </section>
      )}

      {/* Teaser Premium para free */}
      {!(profile as any)?.is_premium && stats.played > 0 && (
        <Link href="/planes?f=stats_visible"
          className="card mt-4 !p-4 flex items-center gap-3 border border-ball/40 bg-ball/5">
          <VerifiedBadge show size="lg" />
          <div className="flex-1 min-w-0">
            <p className="font-display font-black text-sm">Desbloqueá tus estadísticas</p>
            <p className="text-white/60 text-xs">Winrate, evolución mensual, gráficos avanzados con Premium</p>
          </div>
          <span className="text-ball text-xl">→</span>
        </Link>
      )}

      <div className="court-divider my-6" />

      {/* Botones primarios grandes: Reservar + Buscador Inteligente lado a lado */}
      <section className="grid grid-cols-2 gap-3 mb-4">
        <Link href="/jugador/reservar"
          className="rounded-2xl py-5 px-4 flex flex-col items-center gap-2 bg-white/5 border border-white/10 active:scale-95 transition shadow-lg">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#D8F646" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M6.5 6.5c3 3 8 3 11 0M6.5 17.5c3-3 8-3 11 0" />
          </svg>
          <span className="text-[15px] font-display font-black text-white text-center leading-tight">Reservar<br/>cancha</span>
        </Link>
        <Link href="/jugador/buscar"
          className="rounded-2xl py-5 px-4 flex flex-col items-center gap-2 bg-gradient-to-br from-ball to-lime-500 active:scale-95 transition shadow-lg shadow-ball/20">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#0A1633" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
            <path d="M8 11h6M11 8v6" />
          </svg>
          <span className="text-[15px] font-display font-black text-courtdark text-center leading-tight">Buscador<br/>Inteligente</span>
        </Link>
      </section>

      {/* Botones secundarios grandes con iconos premium */}
      <section className="grid grid-cols-3 gap-3 mb-6">
        <Link href="/smash"
          className="rounded-2xl py-5 flex flex-col items-center gap-2 bg-gradient-to-br from-pink-500/20 to-red-500/10 border border-pink-500/30 active:scale-95 transition">
          <svg viewBox="0 0 24 24" width="34" height="34" fill="url(#heartGrad)" stroke="#f472b6" strokeWidth="1.5" strokeLinejoin="round">
            <defs>
              <linearGradient id="heartGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#f472b6" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
            </defs>
            <path d="M12 21s-7-4.5-7-11a4.5 4.5 0 0 1 8-3 4.5 4.5 0 0 1 8 3c0 6.5-7 11-7 11z" />
          </svg>
          <span className="text-[13px] font-display font-black text-white">Smashe@</span>
        </Link>
        <Link href="/marketplace"
          className="rounded-2xl py-5 flex flex-col items-center gap-2 bg-gradient-to-br from-purple-500/20 to-indigo-500/10 border border-purple-500/30 active:scale-95 transition">
          <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="#c084fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2l1.5 3M18 2l-1.5 3M3 6h18l-1.5 12a3 3 0 01-3 2.5H7.5a3 3 0 01-3-2.5L3 6z" />
            <path d="M8 10a4 4 0 008 0" />
          </svg>
          <span className="text-[13px] font-display font-black text-white">Market</span>
        </Link>
        <Link href="/jugador/amigos"
          className="rounded-2xl py-5 flex flex-col items-center gap-2 bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/30 active:scale-95 transition">
          <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="#67e8f9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="8" r="3.5" />
            <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
            <circle cx="17" cy="9" r="2.5" />
            <path d="M15 20c0-2.5 2-4.5 4-4.5" />
          </svg>
          <span className="text-[13px] font-display font-black text-white">Amigos</span>
        </Link>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="h-section">Próximos partidos</h2>
          <Link href="/jugador/reservar" className="text-ball text-sm font-black">Reservar +</Link>
        </div>
        {upcoming.length === 0 ? (
          <div className="card mt-3 text-center py-8">
            <p className="text-3xl">🎾</p>
            <p className="text-white/70 mt-2">No tenés partidos agendados.</p>
            <Link href="/jugador/reservar" className="btn-ball inline-flex mt-4">Reservar cancha</Link>
          </div>
        ) : upcoming.map((m: any) => (
          <Link key={m.id} href={`/partido/${m.id}`} className="card mt-3 flex justify-between items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-display font-bold text-base truncate">{m.booking.court.complex.name}</p>
              <p className="text-white/60 text-sm truncate">{m.booking.court.name}</p>
              <p className="text-ball text-sm font-bold mt-1">
                {new Date(m.booking.starts_at).toLocaleString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} hs
              </p>
            </div>
            <span className="text-ball text-2xl font-black shrink-0">→</span>
          </Link>
        ))}
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3">
        <Link href="/jugador/entrenamientos" className="card text-center !p-4">
          <p className="font-display font-black text-3xl text-ball">{stats.trainings}</p>
          <p className="text-white/70 text-xs font-bold uppercase tracking-wider mt-1">Entrenamientos</p>
        </Link>
        <div className="card flex items-center justify-center !p-4">
          {profile && (
            <PlacaButton data={{
              kind: 'estadisticas',
              title: `${profile.first_name} ${profile.last_name}`,
              main: `${stats.won} ganados · ${stats.lost} perdidos`,
              detail: `${stats.points} puntos · Cat. ${profile.category}`,
              footer: `@${profile.username} en NarvoQ`
            }} />
          )}
        </div>
      </section>
    </main>
  );
}
