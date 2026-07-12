'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Brand from '@/components/Brand';

const Avatar = ({ url, name, size = 'w-11 h-11' }: any) => url
  ? <img src={url} alt="" className={`${size} rounded-full object-cover shrink-0`} />
  : <span className={`${size} rounded-full bg-grafito text-ball font-display font-black flex items-center justify-center shrink-0`}>
      {name?.[0]?.toUpperCase() ?? '?'}
    </span>;

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'recién';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return new Date(iso).toLocaleDateString('es-AR');
}

export default function SmashHome() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [chats, setChats] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState('');

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setMe(p);
    // Chats donde participo
    const { data } = await supabase.from('chats')
      .select(`id, user_a, user_b, last_message_at,
        a:profiles!user_a(id, username, first_name, last_name, avatar_url),
        b:profiles!user_b(id, username, first_name, last_name, avatar_url)`)
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .order('last_message_at', { ascending: false });
    setChats(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function buscar(text: string) {
    setQ(text); setError('');
    const raw = text.trim();
    if (raw.length < 2) return setResults([]);
    const clean = raw.replace(/^@/, '');
    const t = `%${clean}%`;
    const digits = raw.replace(/\D/g, '');
    const phoneT = digits.length >= 3 ? `%${digits}%` : null;
    const parts = clean.split(/\s+/);
    let orClauses = [
      `username.ilike.${t}`, `first_name.ilike.${t}`, `last_name.ilike.${t}`
    ];
    if (phoneT) orClauses.push(`phone.ilike.${phoneT}`);
    if (parts.length >= 2) {
      orClauses.push(`and(first_name.ilike.%${parts[0]}%,last_name.ilike.%${parts.slice(1).join(' ')}%)`);
    }
    const { data } = await supabase.from('profiles')
      .select('id, username, first_name, last_name, avatar_url, role')
      .or(orClauses.join(','))
      .limit(15);
    setResults((data ?? []).filter(p => p.id !== me?.id));
  }

  async function abrirChat(otherId: string) {
    setError('');
    const { data, error: err } = await supabase.rpc('open_chat_with', { other_id: otherId });
    if (err) return setError(`${err.message}. ¿Ejecutaste update-14-smasheq-chat.sql?`);
    router.push(`/smash/${data}`);
  }

  return (
    <main className="min-h-dvh max-w-md mx-auto pb-24">
      <header className="px-5 pt-6 pb-2 flex items-center justify-between">
        <Link href="/jugador/dashboard"><Brand variant="inline" size={24} /></Link>
        <span className="text-white/40 text-xs font-black tracking-widest">SMASHE@</span>
      </header>

      <section className="px-5 mt-3">
        <h1 className="font-display font-black text-2xl">Smashe<span className="text-ball">@</span></h1>
        <p className="text-white/50 text-sm">
          Chat efímero: los mensajes se autoborran a las <b className="text-ball">24 horas</b>.
        </p>

        <input className="input mt-4" placeholder="🔍 Nombre, apellido, @usuario o celular"
          value={q} onChange={e => buscar(e.target.value)} />
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

        {q.trim().length >= 2 && (
          <div className="mt-3 space-y-2">
            <p className="text-white/40 text-xs font-black uppercase">Resultados</p>
            {results.map(r => (
              <button key={r.id} onClick={() => abrirChat(r.id)}
                className="w-full card flex items-center gap-3 text-left">
                <Avatar url={r.avatar_url} name={r.first_name} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{r.first_name} {r.last_name}</p>
                  <p className="text-white/50 text-xs truncate">@{r.username}</p>
                </div>
                <span className="text-ball text-xs font-black">Chatear →</span>
              </button>
            ))}
            {results.length === 0 && <p className="text-white/40 text-sm">Sin resultados.</p>}
          </div>
        )}

        {q.trim().length < 2 && (
          <div className="mt-4 space-y-2">
            <p className="text-white/40 text-xs font-black uppercase">Chats</p>
            {chats.length === 0 && (
              <div className="card text-center py-8">
                <p className="text-3xl">💬</p>
                <p className="text-white/50 mt-2 text-sm">Todavía no chateaste con nadie. Buscá arriba.</p>
              </div>
            )}
            {chats.map(c => {
              const other = c.user_a === me?.id ? c.b : c.a;
              return (
                <Link key={c.id} href={`/smash/${c.id}`}
                  className="card flex items-center gap-3">
                  <Avatar url={other?.avatar_url} name={other?.first_name} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{other?.first_name} {other?.last_name}</p>
                    <p className="text-white/50 text-xs truncate">@{other?.username}</p>
                  </div>
                  <span className="text-white/40 text-xs shrink-0">{timeAgo(c.last_message_at)}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
