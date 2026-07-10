'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { uploadImage } from '@/lib/upload';

const KIND_META: Record<string, { label: string; emoji: string }> = {
  reserva_confirmada: { label: 'Reserva', emoji: '📅' },
  busco_jugadores: { label: 'Busca jugadores', emoji: '🔍' },
  partido_completo: { label: 'Partido completo', emoji: '✅' },
  resultado: { label: 'Resultado', emoji: '🎾' },
  inscripcion: { label: 'Inscripción', emoji: '📝' },
  torneo_abierto: { label: 'Torneo abierto', emoji: '🏆' },
  fixture: { label: 'Fixture', emoji: '📋' },
  campeones: { label: 'Campeones', emoji: '🥇' },
  promo: { label: 'Promo', emoji: '🔥' }
};

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'recién';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

const Avatar = ({ url, name, size = 'w-10 h-10' }: { url?: string | null; name: string; size?: string }) => url
  ? <img src={url} alt="" className={`${size} rounded-full object-cover shrink-0`} />
  : <span className={`${size} rounded-full bg-court text-white font-display font-black flex items-center justify-center shrink-0`}>
      {name?.[0]?.toUpperCase() ?? '?'}
    </span>;

const POST_SELECT = `*, author:profiles!author_profile_id(username, first_name, last_name, avatar_url, category),
  complex:complexes!author_complex_id(id, name, logo_url),
  likes:post_likes(player_id),
  comments:post_comments(id, text_content, created_at, player:profiles!player_id(username, first_name, avatar_url)),
  original:posts!repost_of(id, text_content, image_url, created_at, kind, author_profile_id, author_complex_id,
    author:profiles!author_profile_id(username, first_name, last_name, avatar_url),
    complex:complexes!author_complex_id(id, name, logo_url))`;

export default function Feed() {
  const [posts, setPosts] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [me, setMe] = useState<any>(null);
  const [myComplex, setMyComplex] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      setMe(profile);
      const { data: cx } = await supabase.from('complexes').select('id').eq('owner_id', user.id).maybeSingle();
      setMyComplex(cx);
    }
    const { data, error: qErr } = await supabase.from('posts')
      .select(POST_SELECT)
      .is('repost_of', null)  // los originales; los reposts se cargan aparte
      .order('created_at', { ascending: false }).limit(30);
    const { data: reposts } = await supabase.from('posts')
      .select(POST_SELECT).not('repost_of', 'is', null)
      .order('created_at', { ascending: false }).limit(30);
    if (qErr) { setError(`Error al cargar el feed: ${qErr.message}`); return; }
    const all = [...(data ?? []), ...(reposts ?? [])]
      .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 40);

    // Contamos reposts por original_id en una query aparte para evitar
    // el conflicto de embed self-referential.
    const originalIds = Array.from(new Set(
      all.map((p: any) => p.repost_of ? p.original?.id : p.id).filter(Boolean)
    ));
    let repostMap: Record<string, { id: string; author_profile_id: string }[]> = {};
    if (originalIds.length) {
      const { data: rp } = await supabase.from('posts')
        .select('id, repost_of, author_profile_id')
        .in('repost_of', originalIds);
      (rp ?? []).forEach((r: any) => {
        (repostMap[r.repost_of] ||= []).push({ id: r.id, author_profile_id: r.author_profile_id });
      });
    }
    all.forEach((p: any) => {
      const key = p.repost_of ? p.original?.id : p.id;
      p.reposts = key ? (repostMap[key] ?? []) : [];
      if (p.original) p.original.reposts = p.reposts;
    });
    setPosts(all);
  }
  useEffect(() => { load(); }, []);

  async function publicar() {
    if (!text.trim() && !image) return;
    setBusy(true); setError('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Tu sesión expiró. Cerrá y volvé a iniciar sesión.'); setBusy(false); return; }
    if (!me) { setError('Tu cuenta no tiene perfil de jugador. Recargá la página para completarlo.'); setBusy(false); return; }
    const { error: err } = await supabase.from('posts').insert({
      author_profile_id: me.id, kind: 'manual',
      text_content: text.trim() || null, image_url: image
    });
    if (err) { setError(`No se pudo publicar (${err.code ?? ''}): ${err.message}`); setBusy(false); return; }
    setText(''); setImage(null); setBusy(false);
    load();
  }

  async function adjuntar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setError('');
    const url = await uploadImage(file, 'posts');
    setBusy(false);
    if (url) setImage(url);
    else setError('No pudimos subir la imagen. Verificá haber ejecutado update-01-fotos.sql en Supabase.');
  }

  async function like(p: any) {
    if (!me) return;
    const liked = p.likes.some((l: any) => l.player_id === me.id);
    setPosts(posts.map(x => x.id !== p.id ? x : {
      ...x, likes: liked ? x.likes.filter((l: any) => l.player_id !== me.id) : [...x.likes, { player_id: me.id }]
    }));
    if (liked) await supabase.from('post_likes').delete().eq('post_id', p.id).eq('player_id', me.id);
    else await supabase.from('post_likes').insert({ post_id: p.id, player_id: me.id });
  }

  async function repostear(p: any) {
    if (!me) return setError('Tu sesión no está lista. Recargá la página.');
    const targetId = p.repost_of ? p.original?.id : p.id;  // repost del original, no del repost
    if (!targetId) return setError('No pudimos encontrar la publicación original.');
    const mine = (p.reposts ?? []).find((r: any) => r.author_profile_id === me.id);
    if (mine) {
      const { error: err } = await supabase.from('posts').delete().eq('id', mine.id);
      if (err) return setError(`No se pudo quitar el repost: ${err.message}`);
      return load();
    }
    const { error: err } = await supabase.from('posts').insert({
      author_profile_id: me.id, kind: 'repost', repost_of: targetId,
      text_content: null
    });
    if (err) return setError(`No se pudo repostear: ${err.message}. ¿Ejecutaste update-03-social.sql?`);
    load();
  }

  async function borrar(p: any) {
    if (!confirm('¿Eliminar esta publicación? Se borran también sus likes y comentarios.')) return;
    const { error: err } = await supabase.from('posts').delete().eq('id', p.id);
    if (err) return setError(`No se pudo borrar: ${err.message}. ¿Ejecutaste update-05-ranking.sql?`);
    setPosts(posts.filter(x => x.id !== p.id));
  }

  async function comentar(p: any) {
    if (!comment.trim() || !me) return;
    const { error: err } = await supabase.from('post_comments')
      .insert({ post_id: p.id, player_id: me.id, text_content: comment.trim() });
    if (err) return setError(`No se pudo comentar: ${err.message}`);
    setComment(''); load();
  }

  function AuthorLink({ post, children }: any) {
    if (post.complex?.id)
      return <Link href={`/club/${post.complex.id}`}>{children}</Link>;
    if (post.author?.username)
      return <Link href={`/u/${post.author.username}`}>{children}</Link>;
    return <>{children}</>;
  }

  function PostBody({ p, embedded = false }: { p: any; embedded?: boolean }) {
    const meta = KIND_META[p.kind];
    const authorName = p.complex ? p.complex.name : `${p.author?.first_name ?? ''} ${p.author?.last_name ?? ''}`;
    return (
      <div className={embedded ? 'border border-white/10 rounded-xl mx-4 mb-1 overflow-hidden' : ''}>
        <header className="flex items-center gap-3 px-4 pt-3">
          <AuthorLink post={p}>
            <Avatar url={p.complex ? p.complex.logo_url : p.author?.avatar_url} name={authorName}
              size={embedded ? 'w-8 h-8' : 'w-10 h-10'} />
          </AuthorLink>
          <div className="flex-1 min-w-0">
            <AuthorLink post={p}>
              <p className="font-display font-bold truncate text-sm">{authorName}</p>
            </AuthorLink>
            <p className="text-white/50 text-xs">
              {p.complex ? 'Complejo' : `@${p.author?.username}`} · {timeAgo(p.created_at)}
            </p>
          </div>
          {meta && !embedded && (
            <span className="bg-ball/15 text-ball text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap">
              {meta.emoji} {meta.label}
            </span>
          )}
        </header>
        {p.text_content && <p className="px-4 pt-2 text-[15px]">{p.text_content}</p>}
        {p.image_url && <img src={p.image_url} alt="" className="mt-2 w-full" />}
        {p.complex?.id && !embedded && (
          <Link href={`/club/${p.complex.id}`}
            className="mx-4 mt-3 mb-1 block rounded-xl bg-ball/10 border border-ball/30 px-3 py-2 text-ball text-xs font-bold text-center">
            Ver perfil, canchas y membresías →
          </Link>
        )}
        {embedded && <div className="pb-3" />}
      </div>
    );
  }

  return (
    <main className="px-5 pt-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-black text-2xl">Feed</h1>
        {me && <Link href="/jugador/perfil"><Avatar url={me.avatar_url} name={me.first_name} /></Link>}
      </div>

      {/* Compositor */}
      <div className="card mt-4">
        <div className="flex gap-3">
          {me && <Avatar url={me.avatar_url} name={me.first_name} />}
          <textarea className="input !border-0 !p-0 resize-none focus:!ring-0" rows={2}
            placeholder="¿Qué pasa en la cancha?" value={text} onChange={e => setText(e.target.value)} />
        </div>
        {image && (
          <div className="relative mt-2">
            <img src={image} alt="" className="rounded-xl w-full" />
            <button onClick={() => setImage(null)}
              className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-9 h-9 text-lg font-bold">✕</button>
          </div>
        )}
        {error && <p className="text-red-600 text-sm mt-2 font-semibold">{error}</p>}
        <div className="flex justify-between items-center mt-3">
          <label className="text-ball font-semibold text-sm cursor-pointer">
            🖼️ Foto
            <input type="file" accept="image/*" className="hidden" onChange={adjuntar} />
          </label>
          <button onClick={publicar} disabled={busy || (!text.trim() && !image)}
            className="btn-ball disabled:opacity-40">
            {busy ? 'Publicando…' : 'Publicar'}
          </button>
        </div>
      </div>

      {/* Publicaciones */}
      <div className="mt-4 space-y-4 pb-8">
        {posts.map(p => {
          const liked = me && p.likes.some((l: any) => l.player_id === me.id);
          const isRepost = !!p.repost_of;
          const source = isRepost ? p.original : p;
          const repostList = source?.reposts ?? [];
          const iReposted = !!me && repostList.some((r: any) => r.author_profile_id === me.id);
          const repostCount = repostList.length;
          return (
            <article key={p.id} className="card !p-0 overflow-hidden">
              {isRepost && (
                <p className="px-4 pt-3 text-xs font-bold text-white/50">
                  🔁 {p.author?.first_name ?? p.complex?.name} reposteó
                </p>
              )}
              {isRepost && p.original
                ? <PostBody p={{ ...p.original }} embedded />
                : <PostBody p={p} />}

              <footer className="px-4 py-3 flex gap-6 text-sm font-semibold border-t border-white/5">
                <button onClick={() => like(p)}
                  className={`flex items-center gap-1 transition active:scale-125 ${liked ? 'text-red-500' : 'text-white/50'}`}>
                  {liked ? '❤️' : '🤍'} {p.likes.length > 0 && p.likes.length}
                </button>
                <button onClick={() => setOpenComments(openComments === p.id ? null : p.id)} className="text-white/50">
                  💬 {p.comments.length > 0 && p.comments.length}
                </button>
                <button onClick={() => repostear(p)}
                  className={`flex items-center gap-1 transition active:scale-110 ${iReposted ? 'text-ball' : 'text-white/50'}`}>
                  🔁 {repostCount > 0 && repostCount}
                </button>
                {me && (p.author_profile_id === me.id || (myComplex && p.author_complex_id === myComplex.id)) && (
                  <button onClick={() => borrar(p)} className="text-white/50 ml-auto active:text-red-500">🗑️</button>
                )}
              </footer>

              {openComments === p.id && (
                <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-3">
                  {p.comments.map((c: any) => (
                    <div key={c.id} className="flex gap-2">
                      <Link href={`/u/${c.player?.username}`}>
                        <Avatar url={c.player?.avatar_url} name={c.player?.first_name ?? '?'} size="w-8 h-8" />
                      </Link>
                      <div className="bg-white/5 rounded-xl px-3 py-2 flex-1">
                        <p className="text-xs font-bold">{c.player?.first_name}</p>
                        <p className="text-sm">{c.text_content}</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input className="input" placeholder="Escribí un comentario…" value={comment}
                      onChange={e => setComment(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && comentar(p)} />
                    <button onClick={() => comentar(p)} className="btn-court text-sm">→</button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
        {posts.length === 0 && !error && (
          <div className="card text-center py-10">
            <p className="text-3xl">🎾</p>
            <p className="text-white/50 mt-2">El feed está vacío. Sé el primero en publicar.</p>
          </div>
        )}
      </div>
    </main>
  );
}
