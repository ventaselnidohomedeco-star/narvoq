'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { uploadImage } from '@/lib/upload';

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
  const [f, setF] = useState({ section: 'global', emoji: 'PA', title: '', subtitle: '', link_url: '', link_label: '', priority: '0', image_url: '' });
  const [uploadingBanner, setUploadingBanner] = useState(false);
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
    if (!f.title.trim() && !f.image_url.trim()) return setError('El banner necesita un título o una imagen.');
    const { error: err } = await supabase.from('banners').insert({
      section: f.section,
      emoji: f.emoji || '🎾',
      title: f.title.trim() || null,
      subtitle: f.subtitle.trim() || null,
      link_url: f.link_url.trim() || null,
      link_label: f.link_label.trim() || null,
      priority: Number(f.priority) || 0,
      image_url: f.image_url.trim() || null
    });
    if (err) return setError(err.message);
    setF({ ...f, title: '', subtitle: '', link_url: '', link_label: '', priority: '0', image_url: '' }); load();
  }

  async function subirImagenBanner(file: File | null) {
    if (!file) return;
    setError('');
    setUploadingBanner(true);
    const url = await uploadImage(file, 'banners');
    setUploadingBanner(false);
    if (!url) return setError('No pude subir la imagen. Probá con otra.');
    setF({ ...f, image_url: url });
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

        <p className="text-white/40 text-[10px] leading-tight">
          📐 Imagen recomendada: <b className="text-white/70">1080×1080 px</b> (cuadrada) o 1080×1350 (vertical) · JPG/PNG · máx 500KB.
        </p>
        <input
          type="file"
          accept="image/*"
          onChange={async e => {
            const file = e.target.files?.[0];
            if (!file) return;
            setPromoBusy(true);
            const url = await uploadImage(file, 'promos');
            setPromoBusy(false);
            if (url) setPromo({ ...promo, image_url: url });
            else setError('No pude subir la imagen. Probá con otra.');
          }}
          className="text-white/70 text-xs file:bg-ball file:text-courtdark file:font-black file:px-3 file:py-2 file:rounded-lg file:border-0 file:mr-3" />
        {promo.image_url && (
          <div className="space-y-1">
            <img src={promo.image_url} alt="preview" className="w-full max-h-64 object-contain rounded-lg border border-white/10" />
            <button onClick={() => setPromo({ ...promo, image_url: '' })} className="text-red-400 text-xs underline">Quitar imagen</button>
          </div>
        )}

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

        {/* Imagen del banner (opcional) */}
        <div className="pt-2 border-t border-white/10 space-y-2">
          <p className="text-white/70 text-xs font-bold">Imagen del banner (opcional)</p>
          <p className="text-white/40 text-[10px] leading-tight">
            📐 Medida recomendada: <b className="text-white/70">1200×300 px</b> (ratio 4:1) · JPG/PNG · máx 400KB.
            Si subís imagen, el banner se muestra full-width con la foto y el texto superpuesto.
          </p>
          <input
            type="file"
            accept="image/*"
            onChange={e => subirImagenBanner(e.target.files?.[0] ?? null)}
            className="text-white/70 text-xs file:bg-ball file:text-courtdark file:font-black file:px-3 file:py-2 file:rounded-lg file:border-0 file:mr-3" />
          {uploadingBanner && <p className="text-white/50 text-xs">Subiendo imagen…</p>}
          {f.image_url && (
            <div className="space-y-1">
              <img src={f.image_url} alt="preview" className="w-full rounded-lg border border-white/10" />
              <button
                onClick={() => setF({ ...f, image_url: '' })}
                className="text-red-400 text-xs underline">Quitar imagen</button>
            </div>
          )}
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button onClick={crear} className="btn-ball w-full">Publicar banner</button>
      </section>

      <section className="mt-5 space-y-2 pb-10">
        {banners.map(b => (
          <div key={b.id} className="card flex items-center gap-3">
            {b.image_url ? (
              <img src={b.image_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
            ) : (
              <span className="text-xl">{b.emoji}</span>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{b.title ?? '(sin título)'}</p>
              <p className="text-white/40 text-xs">
                {SECTIONS.find(s => s[0] === b.section)?.[1] ?? b.section}
                {b.subtitle ? ` · ${b.subtitle}` : ''}
                {b.image_url ? ' · con imagen' : ''}
              </p>
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
