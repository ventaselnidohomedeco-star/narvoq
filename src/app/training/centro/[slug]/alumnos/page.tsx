'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

export default function CentroAlumnos() {
  const { slug } = useParams<{ slug: string }>();
  const [me, setMe] = useState<any>(null);
  const [centro, setCentro] = useState<any>(null);
  const [alumnos, setAlumnos] = useState<any[]>([]);
  const [progresos, setProgresos] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  // Modal add
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [chosen, setChosen] = useState<any>(null);
  const [monthlyFee, setMonthlyFee] = useState('1000');
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) { const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(); setMe(p); }
    const { data: c } = await supabase.from('training_centers').select('*').eq('slug', slug).maybeSingle();
    if (!c) { setLoading(false); return; }
    setCentro(c);
    const { data: al } = await supabase.from('center_members')
      .select('id, monthly_fee, payment_status, joined_at, profile:profiles!profile_id(id, first_name, last_name, username, avatar_url, category, phone)')
      .eq('center_id', c.id).eq('role', 'student').eq('active', true)
      .order('joined_at', { ascending: false });
    setAlumnos(al ?? []);
    // Progreso de últimos 30 días por alumno
    const studentIds = (al ?? []).map((a: any) => a.profile?.id).filter(Boolean);
    if (studentIds.length > 0) {
      const { data: prog } = await supabase.from('v_student_pillar_progress')
        .select('*').eq('center_id', c.id).in('student_id', studentIds);
      const grouped: Record<string, any[]> = {};
      (prog ?? []).forEach((p: any) => {
        (grouped[p.student_id] = grouped[p.student_id] ?? []).push(p);
      });
      setProgresos(grouped);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, [slug]);

  useEffect(() => {
    if (!search.trim() || search.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const query = search.trim();
      const { data } = await supabase.from('profiles')
        .select('id, first_name, last_name, username, avatar_url, category, phone')
        .eq('role', 'player')
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,username.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(10);
      const memberIds = new Set(alumnos.map(a => a.profile?.id));
      setResults((data ?? []).filter((p: any) => !memberIds.has(p.id)));
    }, 300);
    return () => clearTimeout(t);
  }, [search, alumnos]);

  async function agregar() {
    if (!centro || !chosen) return;
    setSaving(true);
    const nextBilling = new Date(); nextBilling.setDate(1); nextBilling.setMonth(nextBilling.getMonth() + 1);
    await supabase.from('center_members').insert({
      center_id: centro.id,
      profile_id: chosen.id,
      role: 'student',
      monthly_fee: monthlyFee ? Number(monthlyFee) : null,
      payment_status: 'al_dia',
      next_billing_date: nextBilling.toISOString().slice(0, 10)
    });
    setSaving(false);
    setAddOpen(false); setChosen(null); setSearch('');
    load();
  }

  async function quitar(id: string, nombre: string) {
    if (!confirm(`¿Quitar a ${nombre} del centro?`)) return;
    await supabase.from('center_members').update({ active: false }).eq('id', id);
    load();
  }

  const filtered = useMemo(() => {
    if (!q.trim()) return alumnos;
    const s = q.trim().toLowerCase();
    return alumnos.filter((a: any) =>
      `${a.profile?.first_name} ${a.profile?.last_name} ${a.profile?.username}`.toLowerCase().includes(s)
    );
  }, [q, alumnos]);

  if (loading) return <main className="p-8 text-white/60">Cargando…</main>;
  if (!centro) return <main className="p-8"><p className="text-white/60">Centro no encontrado</p></main>;

  return (
    <main className="min-h-dvh max-w-2xl mx-auto text-white px-5 py-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/training/centro/${slug}`} className="text-white/50 text-xs font-black">← {centro.name}</Link>
          <h1 className="font-display font-black text-2xl mt-1">🎓 Alumnos</h1>
          <p className="text-white/50 text-sm">{alumnos.length} activos · Ingresos previstos: ${alumnos.reduce((s, a) => s + (Number(a.monthly_fee) || 0), 0).toLocaleString('es-AR')}/mes</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="btn-ball !py-2 !px-4 text-sm">+ Alumno</button>
      </div>

      <input value={q} onChange={e => setQ(e.target.value)}
        placeholder="🔍 Buscar alumno…"
        className="input w-full mt-4" />

      <div className="mt-4 space-y-2">
        {filtered.length === 0 ? (
          <p className="text-white/40 text-sm py-8 text-center bg-white/5 rounded-2xl">
            {q.trim() ? 'Sin resultados' : 'Sin alumnos todavía. Agregá el primero →'}
          </p>
        ) : filtered.map(a => {
          const p = a.profile;
          if (!p) return null;
          const prog = progresos[p.id] ?? [];
          const totalHs = prog.reduce((s: number, x: any) => s + Number(x.hours_last_30d), 0);
          return (
            <div key={a.id} className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <div className="flex items-start gap-3">
                {p.avatar_url
                  ? <img src={p.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover shrink-0" />
                  : <span className="w-14 h-14 rounded-full bg-grafito text-white font-black text-xl flex items-center justify-center shrink-0">{p.first_name?.[0]}</span>}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="font-black">{p.first_name} {p.last_name}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-black ${
                      a.payment_status === 'al_dia' ? 'bg-emerald-500/20 text-emerald-300' :
                      a.payment_status === 'vencido' ? 'bg-red-500/20 text-red-300' :
                      'bg-yellow-500/20 text-yellow-300'
                    }`}>
                      {a.payment_status === 'al_dia' ? '✓ al día' : a.payment_status}
                    </span>
                  </div>
                  <p className="text-white/50 text-xs">@{p.username} · cat {p.category ?? '-'} · desde {new Date(a.joined_at).toLocaleDateString('es-AR')}</p>
                  <div className="mt-2 flex items-center gap-4 text-xs">
                    <span className="text-ball font-black">🕐 {totalHs.toFixed(1)}h este mes</span>
                    {a.monthly_fee && <span className="text-white/60">💰 ${Number(a.monthly_fee).toLocaleString('es-AR')}/mes</span>}
                  </div>
                  {/* Pilares mini */}
                  {prog.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {prog.map((pr: any) => (
                        <span key={pr.pillar} className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded font-black">
                          {pillarEmoji(pr.pillar)} {Number(pr.hours_last_30d).toFixed(1)}h
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {p.phone && (
                      <a href={`https://wa.me/${p.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener"
                        className="text-[11px] bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-2.5 py-1 rounded font-black">💬 WA</a>
                    )}
                    <Link href={`/u/${p.username}`}
                      className="text-[11px] bg-white/5 border border-white/10 text-white px-2.5 py-1 rounded font-black">Ver perfil</Link>
                    <button onClick={() => quitar(a.id, `${p.first_name} ${p.last_name}`)}
                      className="text-[11px] bg-red-500/10 border border-red-500/30 text-red-300 px-2.5 py-1 rounded font-black">Quitar</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal alta alumno */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-end lg:items-center overflow-y-auto"
          onClick={() => { setAddOpen(false); setChosen(null); }}>
          <div className="bg-[#0B0F16] border-2 border-white/15 rounded-t-3xl lg:rounded-2xl w-full max-w-lg mx-auto p-5 pb-10"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-display font-black text-lg">➕ Alta de alumno</p>
              <button onClick={() => { setAddOpen(false); setChosen(null); }} className="w-9 h-9 rounded-full bg-white/10 text-white font-bold">✕</button>
            </div>
            {!chosen ? (
              <>
                <input autoFocus type="text" className="input mt-3 w-full"
                  placeholder="🔍 Buscar alumno por nombre, usuario o celular…"
                  value={search} onChange={e => setSearch(e.target.value)} />
                <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
                  {search.length >= 2 && results.length === 0 && <p className="text-white/40 text-sm text-center py-4">Sin resultados</p>}
                  {results.map(r => (
                    <button key={r.id} onClick={() => setChosen(r)}
                      className="w-full flex items-center gap-3 bg-white/5 hover:bg-white/10 rounded-xl p-3 text-left">
                      {r.avatar_url
                        ? <img src={r.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                        : <span className="w-10 h-10 rounded-full bg-grafito text-white font-black flex items-center justify-center">{r.first_name?.[0]}</span>}
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm truncate">{r.first_name} {r.last_name}</p>
                        <p className="text-white/50 text-xs truncate">@{r.username} · cat {r.category ?? '-'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="mt-3 flex items-center gap-3 bg-white/5 rounded-xl p-3">
                  {chosen.avatar_url
                    ? <img src={chosen.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                    : <span className="w-12 h-12 rounded-full bg-grafito text-white font-black text-lg flex items-center justify-center">{chosen.first_name?.[0]}</span>}
                  <div className="flex-1 min-w-0">
                    <p className="font-black">{chosen.first_name} {chosen.last_name}</p>
                    <p className="text-white/50 text-xs">@{chosen.username}</p>
                  </div>
                  <button onClick={() => setChosen(null)} className="text-white/50 text-xs font-black">Cambiar</button>
                </div>
                <div className="mt-4">
                  <p className="text-white/70 text-xs font-black uppercase mb-1.5">Cuota mensual (ARS)</p>
                  <input type="number" value={monthlyFee} onChange={e => setMonthlyFee(e.target.value)}
                    className="input w-full" />
                  <p className="text-white/40 text-[11px] mt-1">Se le cobrará este monto todos los meses (via MP en Fase 2)</p>
                </div>
                <button onClick={agregar} disabled={saving} className="btn-ball w-full mt-4 disabled:opacity-50">
                  {saving ? 'Agregando…' : '+ Agregar alumno'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function pillarEmoji(p: string): string {
  return p === 'filosofia' ? '🧠' : p === 'gym' ? '🏋️' : p === 'psicologia' ? '💭' : p === 'nutricion' ? '🥗' : '🎾';
}
