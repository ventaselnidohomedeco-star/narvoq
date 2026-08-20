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
  const [feePct, setFeePct] = useState<string>('0');
  const [feeSaving, setFeeSaving] = useState(false);
  const [feeMsg, setFeeMsg] = useState('');

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setOk(false);
    const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (me?.role !== 'super_admin') return setOk(false);
    setOk(true);
    const { data } = await supabase.from('banners').select('*').order('created_at', { ascending: false });
    setBanners(data ?? []);

    const { data: fee } = await supabase.from('app_settings')
      .select('value_num').eq('key', 'marketplace_fee_pct').maybeSingle();
    if (fee?.value_num != null) setFeePct(String(fee.value_num));

    // --- MÉTRICAS AMPLIADAS ---
    const count = async (t: string, filter?: [string, unknown]) => {
      let q: any = supabase.from(t).select('*', { count: 'exact', head: true });
      if (filter) q = q.eq(filter[0], filter[1]);
      return (await q).count ?? 0;
    };
    const countByDate = async (t: string, sinceIso: string) => {
      const { count: c } = await supabase.from(t).select('*', { count: 'exact', head: true }).gte('created_at', sinceIso);
      return c ?? 0;
    };
    const now = Date.now();
    const d7 = new Date(now - 7 * 24 * 3600 * 1000).toISOString();
    const d30 = new Date(now - 30 * 24 * 3600 * 1000).toISOString();

    // Users
    const [jugadores, profes, complejos, jNuevos7, jNuevos30, profNuevos7, cxNuevos7] = await Promise.all([
      count('profiles', ['role', 'player']),
      count('profiles', ['role', 'coach']),
      count('complexes'),
      countByDate('profiles', d7),
      countByDate('profiles', d30),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'coach').gte('created_at', d7).then(r => r.count ?? 0),
      countByDate('complexes', d7)
    ]);

    // Actividad
    const [reservas, reservas7, posts, posts7] = await Promise.all([
      count('bookings'),
      countByDate('bookings', d7),
      count('posts'),
      countByDate('posts', d7)
    ]);

    // Suscripciones
    const { data: activeSubs } = await supabase.from('subscriptions')
      .select('id, status, plan_id, expires_at, cancelled_at, plan:subscription_plans(role, billing_period, price_ars)')
      .in('status', ['active', 'trial']);
    const { data: allSubs } = await supabase.from('subscriptions').select('id, status, created_at, cancelled_at');

    const premiumJugadores = (activeSubs ?? []).filter((s: any) => s.plan?.role === 'player').length;
    const premiumProfes = (activeSubs ?? []).filter((s: any) => s.plan?.role === 'coach').length;
    const premiumComplejos = (activeSubs ?? []).filter((s: any) => s.plan?.role === 'complex_admin').length;

    const mrr = (activeSubs ?? []).reduce((sum: number, s: any) => {
      if (!s.plan) return sum;
      return sum + (s.plan.billing_period === 'monthly' ? s.plan.price_ars : s.plan.price_ars / 12);
    }, 0);
    const arr = mrr * 12;

    const totalUsers = jugadores + profes + complejos;
    const totalPremium = premiumJugadores + premiumProfes + premiumComplejos;
    const conversion = totalUsers > 0 ? (totalPremium / totalUsers) * 100 : 0;

    // Churn: canceladas en últimos 30 días / activas al principio del mes
    const churn30 = (allSubs ?? []).filter(s =>
      s.status === 'cancelled' && s.cancelled_at && new Date(s.cancelled_at).getTime() > now - 30 * 24 * 3600 * 1000
    ).length;

    setStats({
      jugadores, profes, complejos, reservas, posts,
      jNuevos7, jNuevos30, profNuevos7, cxNuevos7,
      reservas7, posts7,
      premiumJugadores, premiumProfes, premiumComplejos, totalPremium,
      mrr: Math.round(mrr), arr: Math.round(arr),
      conversion: conversion.toFixed(1),
      churn30
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
    <main className="min-h-dvh max-w-5xl mx-auto px-5 py-8">
      <h1 className="font-display font-black text-3xl">Panel CEO</h1>
      <p className="text-white/50 text-sm mt-1">Métricas globales, tráfico y suscripciones.</p>

      {/* Comisión Marketplace (MP split) */}
      <section className="mt-5 bg-gradient-to-br from-[#009EE3]/10 to-transparent border-2 border-[#009EE3]/30 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-3xl">💳</span>
          <div className="flex-1">
            <p className="font-display font-black">Comisión Marketplace (Mercado Pago)</p>
            <p className="text-white/60 text-xs mt-1">
              Porcentaje que NarvoQ retiene automáticamente de cada pago de jugador → complejo. 0% = todo va al complejo.
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1">
            <input type="number" step="0.01" min={0} max={30}
              className="input pr-10 text-lg font-display font-black"
              value={feePct} onChange={e => setFeePct(e.target.value)} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 font-black">%</span>
          </div>
          <button disabled={feeSaving}
            onClick={async () => {
              setFeeSaving(true); setFeeMsg('');
              const n = Number(feePct);
              if (isNaN(n) || n < 0 || n > 30) {
                setFeeMsg('Ingresá un valor entre 0 y 30');
                setFeeSaving(false); return;
              }
              const { error } = await supabase.from('app_settings')
                .upsert({ key: 'marketplace_fee_pct', value_num: n, updated_at: new Date().toISOString() });
              setFeeMsg(error ? `❌ ${error.message}` : '✓ Guardado');
              setFeeSaving(false);
              setTimeout(() => setFeeMsg(''), 3000);
            }}
            className="py-3 px-5 rounded-xl bg-ball text-courtdark font-black text-sm disabled:opacity-50">
            {feeSaving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
        {feeMsg && <p className={`text-xs mt-2 ${feeMsg.startsWith('✓') ? 'text-ball' : 'text-red-400'}`}>{feeMsg}</p>}
      </section>

      {/* Accesos rápidos */}
      <section className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-2">
        <a href="/admin/complejos" className="card !p-3 flex items-center gap-2 hover:bg-white/5 border border-yellow-500/40">
          <span className="text-2xl">🏟️</span>
          <div className="min-w-0">
            <p className="font-black text-sm truncate">Aprobar complejos</p>
            <p className="text-yellow-300 text-[10px]">Pending review · Suspender · Rechazar</p>
          </div>
        </a>
        <a href="/admin/planes" className="card !p-3 flex items-center gap-2 hover:bg-white/5">
          <span className="text-2xl">💎</span>
          <div className="min-w-0">
            <p className="font-black text-sm truncate">Planes</p>
            <p className="text-white/40 text-[10px]">Precios y features</p>
          </div>
        </a>
        <a href="/admin/suscripciones" className="card !p-3 flex items-center gap-2 hover:bg-white/5">
          <span className="text-2xl">💳</span>
          <div className="min-w-0">
            <p className="font-black text-sm truncate">Suscripciones</p>
            <p className="text-white/40 text-[10px]">Lista + acciones</p>
          </div>
        </a>
        <a href="/admin/estadisticas" className="card !p-3 flex items-center gap-2 hover:bg-white/5">
          <span className="text-2xl">📈</span>
          <div className="min-w-0">
            <p className="font-black text-sm truncate">Estadísticas</p>
            <p className="text-white/40 text-[10px]">Gráficos + tendencias</p>
          </div>
        </a>
        <a href="#banners" className="card !p-3 flex items-center gap-2 hover:bg-white/5">
          <span className="text-2xl">📢</span>
          <div className="min-w-0">
            <p className="font-black text-sm truncate">Banners y promos</p>
            <p className="text-white/40 text-[10px]">Contenido</p>
          </div>
        </a>
      </section>

      {/* KPIs principales — Ingresos y Suscriptores */}
      <section className="mt-6">
        <h2 className="text-ball text-[11px] font-black tracking-widest">INGRESOS Y CONVERSIÓN</h2>
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
          <BigKpi label="MRR" value={`$${(stats.mrr ?? 0).toLocaleString('es-AR')}`} sub="Ingresos mensuales" />
          <BigKpi label="ARR" value={`$${(stats.arr ?? 0).toLocaleString('es-AR')}`} sub="Proyección anual" />
          <BigKpi label="Suscriptores" value={String(stats.totalPremium ?? 0)} sub={`${stats.conversion ?? 0}% conversión`} />
          <BigKpi label="Bajas 30d" value={String(stats.churn30 ?? 0)} sub="Churn del mes" tone={stats.churn30 > 5 ? 'warn' : 'ok'} />
        </div>
      </section>

      {/* Distribución de premium por rol */}
      <section className="mt-5">
        <h2 className="text-ball text-[11px] font-black tracking-widest">PREMIUM POR ROL</h2>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <MiniKpi label="🎾 Jugadores" value={String(stats.premiumJugadores ?? 0)} total={stats.jugadores} />
          <MiniKpi label="🎓 Profes" value={String(stats.premiumProfes ?? 0)} total={stats.profes} />
          <MiniKpi label="🏟️ Complejos" value={String(stats.premiumComplejos ?? 0)} total={stats.complejos} />
        </div>
      </section>

      {/* Usuarios */}
      <section className="mt-5">
        <h2 className="text-ball text-[11px] font-black tracking-widest">USUARIOS</h2>
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
          <MiniKpi label="Jugadores" value={String(stats.jugadores ?? 0)} sub={`+${stats.jNuevos7 ?? 0} esta semana`} />
          <MiniKpi label="Entrenadores" value={String(stats.profes ?? 0)} sub={`+${stats.profNuevos7 ?? 0} esta semana`} />
          <MiniKpi label="Complejos" value={String(stats.complejos ?? 0)} sub={`+${stats.cxNuevos7 ?? 0} esta semana`} />
          <MiniKpi label="Nuevos 30d" value={String(stats.jNuevos30 ?? 0)} sub="Total registros" />
        </div>
      </section>

      {/* Actividad */}
      <section className="mt-5">
        <h2 className="text-ball text-[11px] font-black tracking-widest">ACTIVIDAD</h2>
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
          <MiniKpi label="Reservas total" value={String(stats.reservas ?? 0)} sub={`+${stats.reservas7 ?? 0} esta semana`} />
          <MiniKpi label="Posts en feed" value={String(stats.posts ?? 0)} sub={`+${stats.posts7 ?? 0} esta semana`} />
        </div>
      </section>

      <div id="banners" className="mt-8 pt-6 border-t border-white/10">
        <h2 className="font-display font-black text-xl">Contenido y branding</h2>
      </div>

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

// KPI grande (para ingresos y suscriptores)
function BigKpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'warn' }) {
  return (
    <div className="card !p-4 border border-white/10">
      <p className="text-white/50 text-[10px] font-black uppercase tracking-wider">{label}</p>
      <p className={`font-display font-black text-2xl md:text-3xl mt-1 leading-none ${tone === 'warn' ? 'text-orange-300' : 'text-ball'}`}>
        {value}
      </p>
      {sub && <p className="text-white/40 text-[11px] mt-1">{sub}</p>}
    </div>
  );
}

// KPI mini (para grillas de detalle)
function MiniKpi({ label, value, sub, total }: { label: string; value: string; sub?: string; total?: number }) {
  const pct = total && Number(value) > 0 ? ((Number(value) / total) * 100).toFixed(0) : null;
  return (
    <div className="card !p-3">
      <p className="text-white/50 text-[10px] font-bold uppercase tracking-wide truncate">{label}</p>
      <div className="flex items-baseline gap-2 mt-1">
        <p className="font-display font-black text-xl text-white leading-none">{value}</p>
        {pct && <span className="text-ball text-[10px] font-black">({pct}%)</span>}
      </div>
      {sub && <p className="text-white/40 text-[10px] mt-1 truncate">{sub}</p>}
    </div>
  );
}
