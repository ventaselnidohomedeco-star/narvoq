'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import PlacaButton from '@/components/PlacaButton';
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

      const { data: pts } = await supabase.from('ranking_points').select('points,rule_key,ref_tournament_id').eq('player_id', user.id);
      // El ranking suma SOLO puntos de torneos; los partidos de reserva van a estadísticas
      const points = (pts ?? []).filter(r => r.ref_tournament_id).reduce((a, r) => a + r.points, 0);
      const won = (pts ?? []).filter(r => r.rule_key === 'match_won').length;
      const lost = (pts ?? []).filter(r => r.rule_key === 'match_lost').length;
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
    <main className="px-5 pt-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-display font-black text-lg leading-tight">
            <span className="text-white/50 font-bold">Hola,</span> {profile?.first_name ?? '…'} 👋
          </p>
        </div>
        {profile && (
          <span className="flex items-center gap-2">
          <Link href="/jugador/amigos" className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-xl">👥</Link>
          <Link href="/jugador/perfil" className="flex items-center gap-2">
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover" />
              : <span className="w-11 h-11 rounded-full bg-grafito text-white font-display font-black flex items-center justify-center">
                  {profile.first_name?.[0]}
                </span>}
            <span className="bg-grafito text-white font-display font-black rounded-xl px-3 py-2 text-sm">
              Cat. {profile.category}
            </span>
          </Link>
          </span>
        )}
      </header>

      <section className="mt-6 grid grid-cols-3 gap-3">
        {[
          { n: stats.played, l: 'Jugados' },
          { n: stats.won, l: 'Ganados' },
          { n: stats.points, l: 'Pts. torneo' }
        ].map(s => (
          <div key={s.l} className="card text-center">
            <p className="font-display font-black text-3xl text-ball">{s.n}</p>
            <p className="text-white/50 text-xs font-semibold">{s.l}</p>
          </div>
        ))}
      </section>

      <div className="court-divider my-6" />

      <section className="grid grid-cols-3 gap-2 mb-6">
        <Link href="/jugador/reservar" className="card text-center !py-3">
          <p className="text-2xl">🎾</p>
          <p className="text-xs font-bold mt-1">Reservar</p>
        </Link>
        <Link href="/marketplace" className="card text-center !py-3">
          <p className="text-2xl">🛒</p>
          <p className="text-xs font-bold mt-1">Marketplace</p>
        </Link>
        <Link href="/jugador/amigos" className="card text-center !py-3">
          <p className="text-2xl">👥</p>
          <p className="text-xs font-bold mt-1">Amigos</p>
        </Link>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-lg">Próximos partidos</h2>
          <Link href="/jugador/reservar" className="text-ball text-sm font-semibold">Reservar +</Link>
        </div>
        {upcoming.length === 0 ? (
          <div className="card mt-3 text-center py-8">
            <p className="text-white/50">No tenés partidos agendados.</p>
            <Link href="/jugador/reservar" className="btn-ball inline-block mt-3">Reservar cancha</Link>
          </div>
        ) : upcoming.map((m: any) => (
          <Link key={m.id} href={`/partido/${m.id}`} className="card mt-3 flex justify-between items-center">
            <div>
              <p className="font-semibold">{m.booking.court.complex.name} · {m.booking.court.name}</p>
              <p className="text-white/50 text-sm">
                {new Date(m.booking.starts_at).toLocaleString('es-AR', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })} hs
              </p>
            </div>
            <span className="text-ball font-bold">→</span>
          </Link>
        ))}
      </section>

      <section className="mt-6 flex gap-3">
        <Link href="/jugador/entrenamientos" className="card flex-1 text-center">
          <p className="font-display font-black text-2xl text-ball">{stats.trainings}</p>
          <p className="text-white/50 text-xs font-semibold">Entrenamientos</p>
        </Link>
        <div className="card flex-1 flex items-center justify-center">
          {profile && (
            <PlacaButton data={{
              kind: 'estadisticas',
              title: `${profile.first_name} ${profile.last_name}`,
              main: `${stats.won} ganados · ${stats.lost} perdidos`,
              detail: `${stats.points} puntos de ranking · Categoría ${profile.category}`,
              footer: `@${profile.username} vía Narvoq`
            }} />
          )}
        </div>
      </section>
    </main>
  );
}
