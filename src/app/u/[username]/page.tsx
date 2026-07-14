'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { DonutChart } from '@/components/Charts';

// Perfil público completo: /u/juanperez
// Muestra dashboard con winrate, ranking zonal, seguidores, sesiones de
// training, últimos partidos y publicaciones.
export default function PerfilPublico() {
  const { username } = useParams<{ username: string }>();
  const [p, setP] = useState<any>(null);
  const [stats, setStats] = useState({ played: 0, won: 0, lost: 0, points: 0, trainings: 0, zoneRank: 0 });
  const [posts, setPosts] = useState<any[]>([]);
  const [followed, setFollowed] = useState<any[]>([]);
  const [lastMatches, setLastMatches] = useState<any[]>([]);
  const [lastTrainings, setLastTrainings] = useState<any[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  const [followers, setFollowers] = useState(0);
  const [iFollow, setIFollow] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: profile } = await supabase.from('profiles')
        .select('*, city:cities(name)').eq('username', String(username).toLowerCase()).maybeSingle();
      if (!profile) return setNotFound(true);
      setP(profile);

      const { data: { user } } = await supabase.auth.getUser();
      setMe(user?.id ?? null);

      const { count: fCount } = await supabase.from('follows')
        .select('*', { count: 'exact', head: true }).eq('followed_id', profile.id);
      setFollowers(fCount ?? 0);

      if (user) {
        const { data: f } = await supabase.from('follows')
          .select('follower_id').eq('follower_id', user.id).eq('followed_id', profile.id).maybeSingle();
        setIFollow(!!f);
      }

      // Seguidos (amigos)
      const { data: fol } = await supabase.from('follows')
        .select('followed:profiles!followed_id(id, username, first_name, last_name, avatar_url)')
        .eq('follower_id', profile.id).limit(12);
      setFollowed((fol ?? []).map((r: any) => r.followed));

      // Puntos de torneo (ranking)
      const { data: pts } = await supabase.from('ranking_points')
        .select('points, ref_tournament_id, complex_id').eq('player_id', profile.id);
      const tournamentPts = (pts ?? []).filter(r => r.ref_tournament_id).reduce((a, r) => a + r.points, 0);

      // Ranking zonal: posición del jugador dentro de su ciudad
      let zonePosition = 0;
      if (profile.city_id) {
        const { data: zone } = await supabase.from('v_ranking')
          .select('player_id, points').eq('city_id', profile.city_id);
        // v_ranking viene por complejo — agregamos por jugador
        const agg = new Map<string, number>();
        (zone ?? []).forEach((r: any) => agg.set(r.player_id, (agg.get(r.player_id) ?? 0) + r.points));
        const ordered = Array.from(agg.entries()).sort((a, b) => b[1] - a[1]);
        zonePosition = ordered.findIndex(([id]) => id === profile.id) + 1;
      }

      // Partidos jugados y ganados (desde results)
      const { data: myMatches } = await supabase.from('match_players')
        .select(`team,
          match:matches(id, tournament_match_id,
            booking:bookings(starts_at, court:courts(name, complex:complexes(name))),
            result:results(winner_team, sets, status),
            players:match_players(player_id, team, profile:profiles!player_id(username, first_name, last_name, avatar_url)))`)
        .eq('player_id', profile.id).limit(50);

      let won = 0, lost = 0;
      const recent: any[] = [];
      (myMatches ?? []).forEach((mp: any) => {
        const r = mp.match?.result?.[0];
        if (!r) return;
        if (r.winner_team === mp.team) won++; else lost++;
        recent.push({ ...mp.match, myTeam: mp.team, r });
      });
      const orderedRecent = recent
        .filter(m => m.booking?.starts_at)
        .sort((a, b) => b.booking.starts_at.localeCompare(a.booking.starts_at))
        .slice(0, 5);
      setLastMatches(orderedRecent);

      // Sesiones de training del jugador
      const { data: tr } = await supabase.from('trainings')
        .select('id, type, date, duration_min, focus, coach')
        .eq('player_id', profile.id)
        .order('date', { ascending: false }).limit(5);
      setLastTrainings(tr ?? []);

      const { count: totalTr } = await supabase.from('trainings')
        .select('*', { count: 'exact', head: true }).eq('player_id', profile.id);

      setStats({
        played: won + lost, won, lost, points: tournamentPts,
        trainings: totalTr ?? 0, zoneRank: zonePosition
      });

      // Posts del perfil (con reposts embebidos)
      const { data: ps } = await supabase.from('posts')
        .select(`*,
          original:posts!repost_of(id, text_content, image_url, created_at, kind,
            author:profiles!author_profile_id(username, first_name, last_name, avatar_url),
            complex:complexes!author_complex_id(id, name, logo_url))`)
        .eq('author_profile_id', profile.id)
        .order('created_at', { ascending: false }).limit(12);
      setPosts(ps ?? []);
    })();
  }, [username]);

  async function toggleFollow() {
    if (!me || me === p.id) return;
    if (iFollow) {
      await supabase.from('follows').delete().eq('follower_id', me).eq('followed_id', p.id);
      setIFollow(false); setFollowers(followers - 1);
    } else {
      await supabase.from('follows').insert({ follower_id: me, followed_id: p.id });
      setIFollow(true); setFollowers(followers + 1);
    }
  }

  if (notFound) return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6">
      <p className="text-4xl">🎾</p>
      <p className="font-display font-bold mt-2">Ese jugador no existe</p>
      <Link href="/jugador/feed" className="text-ball font-semibold mt-2">Volver al feed</Link>
    </main>
  );
  if (!p) return <main className="p-8 text-white/50">Cargando perfil…</main>;

  const winrate = stats.played > 0 ? Math.round(stats.won / stats.played * 100) : 0;
  const isMe = me === p.id;

  return (
    <main className="min-h-dvh max-w-3xl xl:max-w-5xl mx-auto pb-24">
      {/* Header perfil */}
      <div className="bg-gradient-to-br from-grafito to-black px-5 pt-8 pb-6 rounded-b-3xl relative">
        <div className="flex items-center gap-4">
          {p.avatar_url
            ? <img src={p.avatar_url} alt="" className="w-24 h-24 rounded-full object-cover border-4 border-ball" />
            : <span className="w-24 h-24 rounded-full bg-black border-4 border-ball font-display font-black text-4xl flex items-center justify-center text-ball">
                {p.first_name?.[0]}
              </span>}
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-black text-2xl leading-tight truncate">{p.first_name} {p.last_name}</h1>
            <p className="text-white/70 text-sm truncate">@{p.username}{p.age ? ` · ${p.age}` : ''}</p>
            {p.role === 'coach' && (
              <p className="text-ball text-sm font-black mt-1">
                🎾 Profe{p.academy_name ? ` · ${p.academy_name}` : ''}
              </p>
            )}
            {p.role === 'player' && (
              <span className="inline-block mt-1 bg-ball text-courtdark font-display font-black text-sm rounded-lg px-2.5 py-1">
                Categoría {p.category}
              </span>
            )}
          </div>
        </div>
        {p.bio && <p className="mt-4 text-white/80 text-sm">{p.bio}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="bg-white/10 text-xs font-bold rounded-full px-3 py-1">{followers} seguidores</span>
          {p.side && <span className="bg-white/10 text-xs font-bold rounded-full px-3 py-1">🎯 {p.side === 'drive' ? 'Drive' : p.side === 'reves' ? 'Revés' : 'Ambos'}</span>}
          {p.racket && <span className="bg-white/10 text-xs font-bold rounded-full px-3 py-1">🏓 {p.racket}</span>}
          {p.city?.name && <span className="bg-white/10 text-xs font-bold rounded-full px-3 py-1">📍 {p.city.name}{p.zone ? ` · ${p.zone}` : ''}</span>}
        </div>
        {me && !isMe && (
          <button onClick={toggleFollow}
            className={`mt-4 w-full py-3 rounded-xl font-display font-black ${iFollow ? 'bg-white/15 text-white' : 'bg-ball text-courtdark'}`}>
            {iFollow ? 'Siguiendo ✓' : '+ Seguir'}
          </button>
        )}
      </div>

      {/* Stats de un vistazo */}
      <section className="px-5 mt-5 grid grid-cols-4 gap-2">
        {[
          { n: stats.played, l: 'Jugados' },
          { n: stats.won, l: 'Ganados' },
          { n: stats.points, l: 'Pts. ranking' },
          { n: stats.zoneRank > 0 ? `#${stats.zoneRank}` : '—', l: 'Ranking zonal' }
        ].map(s => (
          <div key={s.l} className="card !p-3 text-center">
            <p className="font-display font-black text-xl text-ball leading-none">{s.n}</p>
            <p className="text-white/60 text-[10px] font-bold uppercase mt-1 tracking-wider">{s.l}</p>
          </div>
        ))}
      </section>

      {/* Chart winrate + entrenamientos */}
      {stats.played > 0 && (
        <section className="px-5 mt-4">
          <div className="card !p-5 flex items-center gap-4">
            <DonutChart
              segments={[
                { label: 'Ganados', value: stats.won, color: '#D8F646' },
                { label: 'Perdidos', value: stats.lost, color: '#3A404A' }
              ]}
              size={110} thickness={20}
              centerLabel={`${winrate}%`} centerSub="winrate"
            />
            <div className="flex-1 min-w-0">
              <p className="font-display font-black text-white text-sm">Rendimiento</p>
              <p className="text-white/60 text-xs mt-1">
                <b className="text-ball">{stats.won}</b> ganados · <b>{stats.lost}</b> perdidos
              </p>
              <p className="text-white/60 text-xs mt-1">
                <b className="text-ball">{stats.trainings}</b> entrenamientos cargados
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Últimos partidos */}
      {lastMatches.length > 0 && (
        <section className="px-5 mt-5">
          <h2 className="h-section">Últimos partidos</h2>
          <ul className="mt-3 space-y-2">
            {lastMatches.map(m => {
              const yo = m.players.filter((pl: any) => pl.team === m.myTeam);
              const rivales = m.players.filter((pl: any) => pl.team !== m.myTeam);
              const compa = yo.find((pl: any) => pl.player_id !== p.id);
              const gano = m.r.winner_team === m.myTeam;
              const score = (m.r.sets ?? []).map((s: any) => `${s.t1}-${s.t2}`).join(' ');
              return (
                <li key={m.id} className={`card !p-3 flex items-center gap-3 ${gano ? 'ring-1 ring-ball/40' : ''}`}>
                  <span className={`w-9 h-9 rounded-full flex items-center justify-center font-display font-black text-lg ${gano ? 'bg-ball text-courtdark' : 'bg-white/10 text-white/60'}`}>
                    {gano ? 'W' : 'L'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      con <b className="text-white">{compa?.profile.first_name ?? '?'}</b> · vs {rivales.map((r: any) => r.profile.first_name).join(' & ')}
                    </p>
                    <p className="text-white/50 text-xs truncate">
                      {m.booking?.court?.complex?.name} · {m.booking?.starts_at ? new Date(m.booking.starts_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : ''}
                      {m.tournament_match_id ? ' · Torneo' : ' · Amistoso'}
                    </p>
                  </div>
                  <span className={`font-display font-black text-sm shrink-0 ${gano ? 'text-ball' : 'text-white/50'}`}>{score}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Últimos entrenamientos */}
      {lastTrainings.length > 0 && (
        <section className="px-5 mt-5">
          <h2 className="h-section">Últimos entrenamientos</h2>
          <ul className="mt-3 space-y-2">
            {lastTrainings.map((t: any) => (
              <li key={t.id} className="card !p-3 flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-ball/15 flex items-center justify-center text-lg">🎾</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{t.type}{t.coach ? ` · con ${t.coach}` : ''}</p>
                  <p className="text-white/50 text-xs truncate">
                    {new Date(t.date + 'T00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} · {t.duration_min} min
                    {t.focus ? ` · Foco: ${t.focus}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Amigos */}
      {followed.length > 0 && (
        <section className="px-5 mt-5">
          <h2 className="h-section">Amigos ({followed.length})</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            {followed.map(f => (
              <Link key={f.id} href={`/u/${f.username}`} className="flex flex-col items-center gap-1 min-w-[64px]">
                {f.avatar_url
                  ? <img src={f.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-white/10" />
                  : <span className="w-14 h-14 rounded-full bg-grafito text-ball flex items-center justify-center font-black text-lg border-2 border-white/10">{f.first_name?.[0]}</span>}
                <span className="text-white/70 text-xs font-bold text-center truncate max-w-[64px]">{f.first_name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Paleta si la tiene */}
      {p.racket_photo_url && (
        <section className="px-5 mt-5">
          <h2 className="h-section">Mi paleta</h2>
          <img src={p.racket_photo_url} alt="" className="mt-3 rounded-2xl w-full max-h-64 object-cover" />
        </section>
      )}

      {/* Publicaciones */}
      <section className="px-5 mt-5 pb-4">
        <h2 className="h-section">Publicaciones ({posts.length})</h2>
        <div className="mt-3 space-y-3">
          {posts.map(post => {
            const isRepost = !!post.repost_of;
            const original = post.original;
            return (
              <div key={post.id} className="card !p-3">
                {isRepost && (
                  <p className="text-xs text-white/50 mb-2">🔁 {p.first_name} reposteó</p>
                )}
                {isRepost ? (
                  original ? (
                    <div className="border border-white/10 rounded-xl p-3">
                      <p className="text-xs text-white/50 mb-1">
                        {original.complex?.name ? `🏢 ${original.complex.name}`
                          : original.author?.username ? `@${original.author.username}` : 'Autor desconocido'}
                      </p>
                      {original.text_content && <p className="text-sm">{original.text_content}</p>}
                      {original.image_url && <img src={original.image_url} alt="" className="mt-2 rounded-lg w-full" />}
                    </div>
                  ) : <p className="text-white/40 text-sm italic">La publicación original ya no está disponible.</p>
                ) : (
                  <>
                    {post.text_content && <p className="text-sm">{post.text_content}</p>}
                    {post.image_url && <img src={post.image_url} alt="" className="mt-2 rounded-xl w-full" />}
                  </>
                )}
                <p className="text-white/50 text-xs mt-2">
                  {post.created_at ? new Date(post.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : ''}
                </p>
              </div>
            );
          })}
          {posts.length === 0 && <p className="text-white/50 text-sm">Todavía no publicó nada.</p>}
        </div>
      </section>
    </main>
  );
}
