'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import PlacaButton from '@/components/PlacaButton';
import { DonutChart, ChartLegend, BarChart } from '@/components/Charts';
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
      <header className="flex items-center gap-4">
        {profile && (
          <Link href="/jugador/perfil" className="shrink-0">
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover ring-2 ring-ball" />
              : <span className="w-14 h-14 rounded-full bg-grafito text-ball font-display font-black text-xl flex items-center justify-center ring-2 ring-ball">
                  {profile.first_name?.[0]}
                </span>}
          </Link>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white/60 text-sm">Hola,</p>
          <h1 className="font-display font-black text-2xl leading-tight truncate">
            {profile?.first_name ?? '…'} 👋
          </h1>
          {profile && (
            <p className="text-ball text-sm font-bold mt-0.5">Categoría {profile.category}</p>
          )}
        </div>
      </header>

      <section className="mt-6 grid grid-cols-3 gap-3">
        {[
          { n: stats.played, l: 'Jugados', href: '/jugador/reservas?tab=historial' },
          { n: stats.won, l: 'Ganados', href: '/jugador/reservas?tab=historial' },
          { n: stats.points, l: 'Pts. ranking', href: '/jugador/ranking' }
        ].map(s => (
          <Link key={s.l} href={s.href} className="card !p-4 text-center active:scale-95 transition">
            <p className="font-display font-black text-3xl text-ball">{s.n}</p>
            <p className="text-white/70 text-xs font-bold uppercase tracking-wider mt-1">{s.l}</p>
          </Link>
        ))}
      </section>

      {/* Chart: winrate y balance */}
      {stats.played > 0 && (
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

      <div className="court-divider my-6" />

      <section className="grid grid-cols-4 gap-2 mb-6">
        {[
          { href: '/jugador/reservar', emoji: '🎾', label: 'Reservar' },
          { href: '/smash', emoji: '💬', label: 'Smashe@' },
          { href: '/marketplace', emoji: '🛒', label: 'Market' },
          { href: '/jugador/amigos', emoji: '👥', label: 'Amigos' }
        ].map(a => (
          <Link key={a.href} href={a.href}
            className="bg-grafito rounded-2xl py-4 px-2 text-center flex flex-col items-center gap-1 active:scale-95 transition">
            <span className="text-3xl leading-none">{a.emoji}</span>
            <span className="text-[13px] font-black text-white">{a.label}</span>
          </Link>
        ))}
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
