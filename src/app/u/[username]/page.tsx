'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

// Perfil público estilo Instagram: /u/juanperez
export default function PerfilPublico() {
  const { username } = useParams<{ username: string }>();
  const [p, setP] = useState<any>(null);
  const [stats, setStats] = useState({ played: 0, won: 0, points: 0 });
  const [posts, setPosts] = useState<any[]>([]);
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
      const { count } = await supabase.from('follows')
        .select('*', { count: 'exact', head: true }).eq('followed_id', profile.id);
      setFollowers(count ?? 0);
      if (user) {
        const { data: f } = await supabase.from('follows')
          .select('follower_id').eq('follower_id', user.id).eq('followed_id', profile.id).maybeSingle();
        setIFollow(!!f);
      }

      const { data: pts } = await supabase.from('ranking_points')
        .select('points, rule_key, ref_tournament_id').eq('player_id', profile.id);
      const won = (pts ?? []).filter(r => r.rule_key === 'match_won').length;
      const lost = (pts ?? []).filter(r => r.rule_key === 'match_lost').length;
      setStats({ played: won + lost, won,
        points: (pts ?? []).filter(r => r.ref_tournament_id).reduce((a, r) => a + r.points, 0) });

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

  if (notFound) return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6">
      <p className="text-4xl">🎾</p>
      <p className="font-display font-bold mt-2">Ese jugador no existe</p>
      <Link href="/jugador/feed" className="text-ball font-semibold mt-2">Volver al feed</Link>
    </main>
  );
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

  if (!p) return <main className="p-8 text-white/50">Cargando perfil…</main>;

  return (
    <main className="min-h-dvh max-w-md mx-auto pb-16">
      {/* Cabecera */}
      <div className="bg-grafito text-ball px-5 pt-8 pb-6 rounded-b-3xl relative overflow-hidden">
        <div className="absolute inset-3 border border-white/15 rounded-2xl pointer-events-none" />
        <div className="flex items-center gap-4 relative">
          {p.avatar_url
            ? <img src={p.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover border-4 border-ball" />
            : <span className="w-20 h-20 rounded-full bg-courtdark border-4 border-ball font-display font-black text-3xl flex items-center justify-center">
                {p.first_name?.[0]}
              </span>}
          <div>
            <h1 className="font-display font-black text-2xl leading-tight">{p.first_name} {p.last_name}</h1>
            <p className="text-white/70 text-sm">@{p.username}{p.age ? ` · ${p.age} años` : ''} · {followers} seguidores</p>
            <span className="inline-block mt-1 bg-ball font-display font-black text-sm rounded-lg px-2 py-0.5">
              Categoría {p.category}
            </span>
          </div>
        </div>
        {me && me !== p.id && (
          <button onClick={toggleFollow}
            className={`mt-3 w-full py-2.5 rounded-xl font-display font-bold relative ${iFollow ? 'bg-white/15 text-white' : 'bg-ball text-balldark'}`}>
            {iFollow ? 'Siguiendo ✓' : '+ Seguir'}
          </button>
        )}
        {p.bio && <p className="mt-3 text-white/85 text-sm relative">{p.bio}</p>}
        <div className="mt-3 flex flex-wrap gap-2 relative">
          {p.side && <span className="bg-white/15 text-xs font-semibold rounded-full px-3 py-1">🎯 {p.side === 'drive' ? 'Drive' : p.side === 'reves' ? 'Revés' : 'Drive y revés'}</span>}
          {p.racket && <span className="bg-white/15 text-xs font-semibold rounded-full px-3 py-1">🏓 {p.racket}</span>}
          {p.city?.name && <span className="bg-white/15 text-xs font-semibold rounded-full px-3 py-1">📍 {p.city.name}{p.zone ? ` · ${p.zone}` : ''}</span>}
        </div>
      </div>

      {/* Stats */}
      <div className="px-5 -mt-4 grid grid-cols-3 gap-3 relative">
        {[
          { n: stats.played, l: 'Jugados' },
          { n: stats.won, l: 'Ganados' },
          { n: stats.points, l: 'Pts. torneo' }
        ].map(s => (
          <div key={s.l} className="card text-center !py-3">
            <p className="font-display font-black text-2xl text-ball">{s.n}</p>
            <p className="text-white/50 text-xs font-semibold">{s.l}</p>
          </div>
        ))}
      </div>

      {p.racket_photo_url && (
        <div className="px-5 mt-6">
          <h2 className="font-display font-bold">Mi paleta</h2>
          <img src={p.racket_photo_url} alt="" className="mt-2 rounded-2xl w-full max-h-64 object-cover" />
        </div>
      )}

      {/* Publicaciones */}
      <div className="px-5 mt-6">
        <h2 className="font-display font-bold">Publicaciones</h2>
        <div className="mt-3 space-y-3">
          {posts.map(post => {
            const isRepost = !!post.repost_of;
            const original = post.original;
            return (
              <div key={post.id} className="card !p-3">
                {isRepost && (
                  <p className="text-xs text-white/50 mb-2">
                    🔁 {p.first_name} reposteó
                  </p>
                )}
                {isRepost ? (
                  original ? (
                    <div className="border border-white/10 rounded-xl p-3">
                      <p className="text-xs text-white/50 mb-1">
                        {original.complex?.name
                          ? `🏢 ${original.complex.name}`
                          : original.author?.username
                            ? `@${original.author.username}`
                            : 'Autor desconocido'}
                      </p>
                      {original.text_content && <p className="text-sm">{original.text_content}</p>}
                      {original.image_url && <img src={original.image_url} alt="" className="mt-2 rounded-lg w-full" />}
                    </div>
                  ) : (
                    <p className="text-white/40 text-sm italic">La publicación original ya no está disponible.</p>
                  )
                ) : (
                  <>
                    {post.text_content && <p className="text-sm">{post.text_content}</p>}
                    {post.image_url && <img src={post.image_url} alt="" className="mt-2 rounded-xl w-full" />}
                  </>
                )}
                <p className="text-white/50 text-xs mt-2">
                  {post.created_at
                    ? new Date(post.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
                    : ''}
                </p>
              </div>
            );
          })}
          {posts.length === 0 && <p className="text-white/50 text-sm">Todavía no publicó nada.</p>}
        </div>
      </div>
    </main>
  );
}
