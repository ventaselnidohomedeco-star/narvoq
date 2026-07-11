'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

const Avatar = ({ url, name }: any) => url
  ? <img src={url} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
  : <span className="w-11 h-11 rounded-full bg-court text-white font-display font-black flex items-center justify-center shrink-0">
      {name?.[0]?.toUpperCase() ?? '?'}
    </span>;

export default function AmigosComplejo() {
  const [me, setMe] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);
  const [followerCount, setFollowerCount] = useState(0);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMe(user.id);
    const { data: f } = await supabase.from('follows')
      .select('followed:profiles!followed_id(id, username, first_name, last_name, avatar_url, category, role)')
      .eq('follower_id', user.id);
    setFollowing((f ?? []).map((r: any) => r.followed));
    const { count } = await supabase.from('follows')
      .select('*', { count: 'exact', head: true }).eq('followed_id', user.id);
    setFollowerCount(count ?? 0);
  }
  useEffect(() => { load(); }, []);

  async function buscar(text: string) {
    setQ(text);
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
      .select('id, username, first_name, last_name, avatar_url, category, role')
      .or(orClauses.join(','))
      .limit(20);
    setResults((data ?? []).filter(p => p.id !== me));
  }

  const sigo = (id: string) => following.some(f => f.id === id);

  async function toggle(p: any) {
    if (!me) return;
    if (sigo(p.id)) {
      await supabase.from('follows').delete().eq('follower_id', me).eq('followed_id', p.id);
      setFollowing(following.filter(f => f.id !== p.id));
    } else {
      await supabase.from('follows').insert({ follower_id: me, followed_id: p.id });
      setFollowing([...following, p]);
    }
  }

  const roleLabel = (r: string) =>
    r === 'complex_admin' ? { txt: 'Complejo', cls: 'bg-court/30 text-court' }
    : r === 'coach' ? { txt: 'Profe', cls: 'bg-ball/20 text-ball' }
    : { txt: 'Jugador', cls: 'bg-white/10 text-white/60' };

  const Row = ({ p }: any) => {
    const rl = roleLabel(p.role ?? 'player');
    return (
      <div className="card flex items-center gap-3">
        <Link href={`/u/${p.username}`} className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar url={p.avatar_url} name={p.first_name} />
          <div className="min-w-0">
            <p className="font-semibold truncate">{p.first_name} {p.last_name}</p>
            <p className="text-white/50 text-xs truncate">
              @{p.username} · <span className={`inline-block px-1.5 py-[1px] rounded ${rl.cls} text-[10px] font-black`}>{rl.txt}</span>
            </p>
          </div>
        </Link>
        <button onClick={() => toggle(p)}
          className={`text-sm font-bold px-3 py-2 rounded-xl shrink-0 ${sigo(p.id) ? 'bg-white/10 text-white/60' : 'bg-court text-white'}`}>
          {sigo(p.id) ? 'Siguiendo ✓' : 'Seguir'}
        </button>
      </div>
    );
  };

  return (
    <main className="px-5 py-6">
      <h1 className="font-display font-black text-xl">Comunidad</h1>
      <p className="text-white/50 text-sm mt-1">Seguís a {following.length} · te siguen {followerCount}</p>

      <input className="input mt-4" placeholder="🔍 Buscar jugadores, profes o complejos…"
        value={q} onChange={e => buscar(e.target.value)} />

      <div className="mt-4 space-y-2 pb-8">
        {q.trim().length >= 2
          ? (results.length ? results.map(p => <Row key={p.id} p={p} />)
            : <p className="text-white/50 text-sm mt-2">No encontramos usuarios con ese nombre.</p>)
          : (following.length ? (
              <>
                <p className="label">Siguiendo</p>
                {following.map(p => <Row key={p.id} p={p} />)}
              </>
            ) : <p className="text-white/50 text-sm mt-2">Buscá jugadores, profes o colegas y seguilos.</p>)}
      </div>
    </main>
  );
}
