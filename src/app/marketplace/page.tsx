'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { uploadImage } from '@/lib/upload';
import Brand from '@/components/Brand';

const CATS = [
  { k: '', l: 'Todo' },
  { k: 'paleta', l: '🎾 Paletas' },
  { k: 'accesorios', l: '🎒 Accesorios' },
  { k: 'ropa', l: '👕 Ropa' },
  { k: 'pelotas', l: '🟢 Pelotas' },
  { k: 'otros', l: '📦 Otros' }
];

export default function Marketplace() {
  const [me, setMe] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [f, setF] = useState({
    title: '', description: '', price: '',
    contact_phone: '', category: 'paleta', condition: 'usado',
    photos: [] as string[]
  });

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      setMe(p);
      if (!f.contact_phone && p?.phone) setF(prev => ({ ...prev, contact_phone: p.phone }));
    }
    let query = supabase.from('products')
      .select('*, seller:profiles!seller_id(id, username, first_name, last_name, avatar_url)')
      .eq('active', true).order('created_at', { ascending: false }).limit(60);
    if (cat) query = query.eq('category', cat);
    const { data } = await query;
    setItems(data ?? []);
  }
  useEffect(() => { load(); }, [cat]);

  async function subirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const url = await uploadImage(file, 'marketplace');
    setBusy(false);
    if (!url) return setError('No pudimos subir la foto.');
    setF({ ...f, photos: [...f.photos, url] });
  }

  async function publicar() {
    setError('');
    if (!me) return setError('Necesitás una cuenta para publicar. Iniciá sesión primero.');
    if (!f.title.trim()) return setError('Poné un título al producto.');
    if (!f.price || Number(f.price) <= 0) return setError('Poné un precio.');
    if (!f.contact_phone.trim()) return setError('Necesitamos un teléfono de contacto.');
    setBusy(true);
    const { error: err } = await supabase.from('products').insert({
      seller_id: me.id,
      title: f.title.trim(),
      description: f.description.trim() || null,
      price: Number(f.price),
      contact_phone: f.contact_phone.trim(),
      category: f.category,
      condition: f.condition,
      photos: f.photos
    });
    setBusy(false);
    if (err) return setError(`${err.message}. ¿Corriste update-11-marketplace.sql?`);
    setF({ title: '', description: '', price: '', contact_phone: me?.phone ?? '', category: 'paleta', condition: 'usado', photos: [] });
    setShowForm(false);
    load();
  }

  async function eliminar(p: any) {
    if (!confirm('¿Eliminar esta publicación?')) return;
    await supabase.from('products').delete().eq('id', p.id);
    load();
  }

  const filtrados = q.trim().length < 2 ? items :
    items.filter(i => `${i.title} ${i.description ?? ''}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <main className="min-h-dvh max-w-md mx-auto pb-24">
      <header className="px-5 pt-6 pb-2 flex items-center justify-between">
        <Link href={me?.role === 'complex_admin' ? '/complejo/dashboard' : me?.role === 'coach' ? '/training/dashboard' : '/jugador/dashboard'}>
          <Brand variant="inline" size={24} />
        </Link>
        <span className="text-white/40 text-xs font-bold">MARKETPLACE</span>
      </header>

      <section className="px-5 mt-2">
        <h1 className="font-display font-black text-2xl">Marketplace</h1>
        <p className="text-white/50 text-sm">Comprá y vendé paletas, ropa y accesorios de pádel entre la comunidad.</p>

        <div className="mt-3 flex gap-2">
          <input className="input flex-1" placeholder="🔍 Buscar producto…" value={q} onChange={e => setQ(e.target.value)} />
          <button onClick={() => setShowForm(v => !v)} className="btn-ball shrink-0">
            {showForm ? 'Cancelar' : '+ Publicar'}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {CATS.map(c => (
            <button key={c.k} onClick={() => setCat(c.k)}
              className={`rounded-full px-4 py-2.5 text-sm font-black min-h-[44px]
                ${cat === c.k ? 'bg-ball text-courtdark' : 'bg-white/5 text-white/70 border border-white/10'}`}>
              {c.l}
            </button>
          ))}
        </div>

        {showForm && (
          <section className="card mt-4 space-y-3">
            <p className="font-display font-bold text-ball text-sm">Publicar producto</p>
            <input className="input" placeholder="Título (ej: Paleta Head Alpha Motion)"
              value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
            <textarea className="input" rows={2} placeholder="Descripción (estado, marca, año, etc.)"
              value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input className="input" type="number" placeholder="Precio $" inputMode="numeric"
                value={f.price} onChange={e => setF({ ...f, price: e.target.value })} />
              <input className="input" placeholder="Teléfono contacto" inputMode="tel"
                value={f.contact_phone} onChange={e => setF({ ...f, contact_phone: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select className="input" value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>
                {CATS.filter(c => c.k).map(c => <option key={c.k} value={c.k}>{c.l}</option>)}
              </select>
              <select className="input" value={f.condition} onChange={e => setF({ ...f, condition: e.target.value })}>
                <option value="nuevo">Nuevo</option>
                <option value="usado">Usado</option>
              </select>
            </div>
            {f.photos.length > 0 && (
              <div className="flex gap-2 overflow-x-auto">
                {f.photos.map((url, i) => (
                  <div key={i} className="relative shrink-0">
                    <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg" />
                    <button onClick={() => setF({ ...f, photos: f.photos.filter((_, x) => x !== i) })}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-black/70 text-white rounded-full text-xs">✕</button>
                  </div>
                ))}
              </div>
            )}
            <label className="text-ball font-semibold text-sm cursor-pointer inline-block">
              🖼️ Agregar foto
              <input type="file" accept="image/*" className="hidden" onChange={subirFoto} disabled={busy} />
            </label>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button onClick={publicar} disabled={busy} className="btn-ball w-full disabled:opacity-40">
              {busy ? 'Publicando…' : 'Publicar producto'}
            </button>
          </section>
        )}

        {!showForm && !me && (
          <p className="mt-4 text-white/50 text-sm">
            <Link href="/login" className="text-ball font-semibold">Iniciá sesión</Link> para publicar tus productos.
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          {filtrados.map(p => (
            <article key={p.id} className="card !p-0 overflow-hidden">
              {p.photos?.[0]
                ? <img src={p.photos[0]} alt="" className="w-full h-32 object-cover" />
                : <div className="w-full h-32 bg-white/5 flex items-center justify-center text-3xl">🎾</div>}
              <div className="p-3">
                <p className="font-semibold text-sm truncate">{p.title}</p>
                <p className="font-display font-black text-ball">${Number(p.price).toLocaleString('es-AR')}</p>
                <p className="text-white/40 text-[10px] font-bold uppercase mt-1">
                  {p.condition} · {p.seller?.first_name}
                </p>
                {p.contact_phone && (
                  <a href={`https://wa.me/${p.contact_phone.replace(/\D/g, '')}?text=Hola, vi tu ${p.title} en NarvoQ`} target="_blank"
                    className="mt-2 block text-center py-2 rounded-lg bg-ball text-courtdark text-xs font-black">
                    WhatsApp
                  </a>
                )}
                {me?.id === p.seller_id && (
                  <button onClick={() => eliminar(p)}
                    className="mt-1 block text-center py-1 text-white/40 text-[10px] w-full">
                    Eliminar
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
        {filtrados.length === 0 && (
          <p className="text-white/50 text-sm mt-6 text-center">
            {q ? 'No hay productos con ese nombre.' : 'Todavía no hay productos publicados. ¡Sé el primero!'}
          </p>
        )}
      </section>
    </main>
  );
}
