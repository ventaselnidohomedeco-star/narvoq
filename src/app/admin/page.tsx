'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

const SECTIONS = [
  ['global', 'Toda la app'],
  ['inicio', 'Inicio jugadores'],
  ['feed', 'Feed'],
  ['torneos', 'Torneos'],
  ['ranking', 'Ranking'],
  ['reservas', 'Reservas'],
  ['entrenamientos', 'Entrenamientos'],
  ['training', 'Portal profes'],
  ['clubes', 'Perfiles de club'],
  ['membresias', 'Membresias'],
  ['complejo', 'Portal complejos']
];

export default function Admin() {
  const [ok, setOk] = useState<boolean | null>(null);
  const [banners, setBanners] = useState<any[]>([]);
  const [f, setF] = useState({ section: 'global', emoji: 'PA', title: '', subtitle: '', link_url: '', link_label: '', priority: '0' });
  const [promo, setPromo] = useState({ text: '', image_url: '' });
  const [promoBusy, setPromoBusy] = useState(false);
  const [stats, setStats] = useState<any>({});
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setOk(false);
    const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (me?.role !== 'super_admin') return setOk(false);
    setOk(true);
    const { data } = await supabase.from('banners').select('*').order('created_at', { ascending: false });
    setBanners(data ?? []);
    const count = async (t: string, filter?: [string, unknown]) => {
      let q: any = supabase.from(t).select('*', { count: 'exact', head: true });
      if (filter) q = q.eq(filter[0], filter[1]);
      return (await q).count ?? 0;
    };
    setStats({
      jugadores: await count('profiles', ['role', 'player']),
      profes: await count('profiles', ['role', 'coach']),
      complejos: await count('complexes'),
      reservas: await count('bookings'),
      posts: await count('posts')
    });
  }
  useEffect(() => { load(); }, []);

  async function crear() {
    setError('');
    if (!f.title.trim()) return setError('El banner necesita un titulo.');
    const { error: err } = await supabase.from('banners').insert({
      section: f.section,
      emoji: f.emoji || '🎾',
      title: f.title.trim(),
      subtitle: f.subtitle.trim() || null,
      link_url: f.link_url.trim() || null,
      link_label: f.link_label.trim() || null,
      priority: Number(f.priority) || 0
    });
    if (err) return setError(err.message);
    setF({ ...f, title: '', subtitle: '', link_url: '', link_label: '', priority: '0' }); load();
  }

  async function publicarPromo() {
    setError(''); setMsg('');
    if (!promo.text.trim() && !promo.image_url.trim()) return setError('La promo necesita texto o imagen.');
    setPromoBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from('profiles').select('id').eq('id', user!.id).single();
    const { error: err } = await supabase.from('posts').insert({
      author_profile_id: prof!.id,
      kind: 'promo',
      text_content: promo.text.trim() || null,
      image_url: promo.image_url.trim() || null
    });
    setPromoBusy(false);
    if (err) return setError(err.message);
    setPromo({ text: '', image_url: '' });
    setMsg('Promo publicada en el feed.');
  }

  if (ok === null) return <main className="p-8 text-white/60">Verificando acceso...</main>;
  if (!ok) return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <p className="text-4xl">Admin</p>
      <p className="font-display font-bold mt-2">Acceso solo para administradores</p>
      <p className="text-white/50 text-sm mt-1">Ejecuta la linea de super_admin de update-07-banners.sql con tu usuario.</p>
    </main>
  );

  return (
    <main className="min-h-dvh max-w-md mx-auto px-5 py-8">
      <h1 className="font-display font-black text-2xl">Panel CEO</h1>

      <section className="mt-4 grid grid-cols-5 gap-2">
        {Object.entries(stats).map(([k, v]: any) => (
          <div key={k} className="card !p-2 text-center">
            <p className="font-display font-black text-lg text-ball">{v}</p>
            <p className="text-white/40 text-[9px] font-bold uppercase">{k}</p>
          </div>
        ))}
      </section>

      <section className="card mt-5 space-y-3">
        <p className="font-display font-bold text-ball text-sm">Publicar promo en el feed</p>
        <textarea className="input" rows={2} placeholder="Texto de la promo (ej: 20% OFF en membresías este finde)"
          value={promo.text} onChange={e => setPromo({ ...promo, text: e.target.value })} />
        <input className="input" placeholder="URL de imagen (opcional)" value={promo.image_url}
          onChange={e => setPromo({ ...promo, image_url: e.target.value })} />
        <button onClick={publicarPromo} disabled={promoBusy} className="btn-court w-full disabled:opacity-40">
          {promoBusy ? 'Publicando…' : 'Publicar promo'}
        </button>
        {msg && <p className="text-ball text-sm">{msg}</p>}
      </section>

      <section className="card mt-5 space-y-3">
        <p className="font-display font-bold text-ball text-sm">Nuevo banner</p>
        <div className="grid grid-cols-3 gap-2">
          <select className="input col-span-2" value={f.section} onChange={e => setF({ ...f, section: e.target.value })}>
            {SECTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <input className="input text-center" value={f.emoji} onChange={e => setF({ ...f, emoji: e.target.value })} placeholder="PA" />
        </div>
        <input className="input" placeholder="Titulo" value={f.title}
          onChange={e => setF({ ...f, title: e.target.value })} />
        <input className="input" placeholder="Subtitulo" value={f.subtitle}
          onChange={e => setF({ ...f, subtitle: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <input className="input" placeholder="Link opcional (ej: https://…)" value={f.link_url}
            onChange={e => setF({ ...f, link_url: e.target.value })} />
          <input className="input" placeholder="Texto del link" value={f.link_label}
            onChange={e => setF({ ...f, link_label: e.target.value })} />
        </div>
        <input className="input" type="number" placeholder="Prioridad (mayor = arriba)"
          value={f.priority} onChange={e => setF({ ...f, priority: e.target.value })} />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button onClick={crear} className="btn-ball w-full">Publicar banner</button>
      </section>

      <section className="mt-5 space-y-2 pb-10">
        {banners.map(b => (
          <div key={b.id} className="card flex items-center gap-3">
            <span className="text-xl">{b.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{b.title}</p>
              <p className="text-white/40 text-xs">{SECTIONS.find(s => s[0] === b.section)?.[1] ?? b.section}{b.subtitle ? ` - ${b.subtitle}` : ''}</p>
            </div>
            <button onClick={async () => { await supabase.from('banners').update({ active: !b.active }).eq('id', b.id); load(); }}
              className={`text-xs font-bold px-2.5 py-1.5 rounded-lg shrink-0 ${b.active ? 'bg-ball text-courtdark' : 'bg-white/10 text-white/50'}`}>
              {b.active ? 'ON' : 'OFF'}
            </button>
            <button onClick={async () => { await supabase.from('banners').delete().eq('id', b.id); load(); }}
              className="text-white/40 shrink-0">x</button>
          </div>
        ))}
      </section>
    </main>
  );
}
