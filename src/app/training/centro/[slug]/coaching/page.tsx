'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

const DIMS = [
  { k: 'score_tecnica',    l: 'Técnica',    icon: '🎾', color: 'text-ball' },
  { k: 'score_tactica',    l: 'Táctica',    icon: '🧠', color: 'text-purple-300' },
  { k: 'score_fisico',     l: 'Físico',     icon: '🏋️', color: 'text-orange-300' },
  { k: 'score_mental',     l: 'Mental',     icon: '💭', color: 'text-blue-300' },
  { k: 'score_actitud',    l: 'Actitud',    icon: '😎', color: 'text-emerald-300' },
  { k: 'score_compromiso', l: 'Compromiso', icon: '💪', color: 'text-pink-300' }
];

export default function Coaching() {
  const { slug } = useParams<{ slug: string }>();
  const [centro, setCentro] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [alumnos, setAlumnos] = useState<any[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  // Modal nueva evaluación
  const [evalOpen, setEvalOpen] = useState(false);
  const [target, setTarget] = useState<any>(null);
  const [form, setForm] = useState<any>({
    score_tecnica: 7, score_tactica: 7, score_fisico: 7, score_mental: 7, score_actitud: 7, score_compromiso: 7,
    strengths: '', weaknesses: '', goals: '', notes: '', next_eval_date: ''
  });
  const [saving, setSaving] = useState(false);

  // Modal historial
  const [historyOpen, setHistoryOpen] = useState<any>(null);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) { const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(); setMe(p); }
    const { data: c } = await supabase.from('training_centers').select('*').eq('slug', slug).maybeSingle();
    if (!c) { setLoading(false); return; }
    setCentro(c);
    const { data: al } = await supabase.from('center_members')
      .select('id, profile:profiles!profile_id(id, first_name, last_name, avatar_url, category)')
      .eq('center_id', c.id).eq('role', 'student').eq('active', true);
    setAlumnos(al ?? []);
    const { data: evs } = await supabase.from('coaching_evaluations')
      .select('*, coach:profiles!coach_id(first_name, last_name)')
      .eq('center_id', c.id).order('date', { ascending: false }).limit(5000);
    setEvaluaciones(evs ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [slug]);

  // Mapa: student_id → última eval
  const lastEvalByStudent = useMemo(() => {
    const m: Record<string, any> = {};
    for (const e of evaluaciones) {
      if (!m[e.student_id] || e.date > m[e.student_id].date) m[e.student_id] = e;
    }
    return m;
  }, [evaluaciones]);

  const filtered = useMemo(() => {
    if (!q.trim()) return alumnos;
    const s = q.trim().toLowerCase();
    return alumnos.filter((a: any) =>
      `${a.profile?.first_name} ${a.profile?.last_name}`.toLowerCase().includes(s)
    );
  }, [q, alumnos]);

  function openEval(a: any) {
    setTarget(a);
    const last = lastEvalByStudent[a.profile?.id];
    setForm({
      score_tecnica: last?.score_tecnica ?? 7,
      score_tactica: last?.score_tactica ?? 7,
      score_fisico: last?.score_fisico ?? 7,
      score_mental: last?.score_mental ?? 7,
      score_actitud: last?.score_actitud ?? 7,
      score_compromiso: last?.score_compromiso ?? 7,
      strengths: '', weaknesses: '', goals: '', notes: '',
      next_eval_date: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0,10)
    });
    setEvalOpen(true);
  }

  async function guardar() {
    if (!centro || !target || !me) return;
    setSaving(true);
    const overall = Math.round(
      (Number(form.score_tecnica) + Number(form.score_tactica) + Number(form.score_fisico)
       + Number(form.score_mental) + Number(form.score_actitud) + Number(form.score_compromiso)) / 6
    );
    const { error } = await supabase.from('coaching_evaluations').insert({
      center_id: centro.id,
      student_id: target.profile.id,
      coach_id: me.id,
      date: new Date().toISOString().slice(0, 10),
      score_tecnica: Number(form.score_tecnica),
      score_tactica: Number(form.score_tactica),
      score_fisico: Number(form.score_fisico),
      score_mental: Number(form.score_mental),
      score_actitud: Number(form.score_actitud),
      score_compromiso: Number(form.score_compromiso),
      overall,
      strengths: form.strengths.trim() || null,
      weaknesses: form.weaknesses.trim() || null,
      goals: form.goals.trim() || null,
      notes: form.notes.trim() || null,
      next_eval_date: form.next_eval_date || null
    });
    setSaving(false);
    if (error) return alert('Error: ' + error.message);
    setEvalOpen(false); setTarget(null);
    load();
  }

  if (loading) return <main className="p-8 text-white/60">Cargando…</main>;
  if (!centro) return <main className="p-8"><p className="text-white/60">Centro no encontrado</p></main>;

  const stuHistory = historyOpen ? evaluaciones.filter(e => e.student_id === historyOpen.profile?.id) : [];

  return (
    <main className="min-h-dvh max-w-3xl mx-auto text-white px-5 py-6">
      <Link href={`/training/centro/${slug}`} className="text-white/50 text-xs font-black">← {centro.name}</Link>
      <h1 className="font-display font-black text-2xl mt-1">🎯 Coaching · Evaluaciones</h1>
      <p className="text-white/50 text-sm">Evaluaciones periódicas por alumno — 6 dimensiones + fortalezas / mejoras / objetivos</p>

      <input value={q} onChange={e => setQ(e.target.value)}
        placeholder="🔍 Buscar alumno…" className="input w-full mt-4" />

      <div className="mt-4 space-y-2">
        {filtered.map(a => {
          const p = a.profile; if (!p) return null;
          const last = lastEvalByStudent[p.id];
          const dias = last ? Math.floor((Date.now() - new Date(last.date).getTime()) / 86400000) : null;
          const alert_ = dias == null || dias > 45;
          return (
            <div key={a.id} className="rounded-xl bg-white/5 border border-white/10 p-3">
              <div className="flex items-center gap-3">
                {p.avatar_url
                  ? <img src={p.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
                  : <span className="w-12 h-12 rounded-full bg-grafito text-white font-black flex items-center justify-center shrink-0">{p.first_name?.[0]}</span>}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-black text-sm">{p.first_name} {p.last_name}</p>
                    {p.category != null && <span className="text-[10px] text-white/50">cat {p.category}</span>}
                    {last && (
                      <span className={`text-[10px] px-2 py-0.5 rounded font-black ${
                        last.overall >= 8 ? 'bg-emerald-500/20 text-emerald-300' :
                        last.overall >= 6 ? 'bg-ball/20 text-ball' :
                        'bg-orange-500/20 text-orange-300'
                      }`}>Overall {last.overall}/10</span>
                    )}
                    {alert_ && (
                      <span className="text-[10px] px-2 py-0.5 rounded font-black bg-red-500/20 text-red-300">
                        {dias == null ? 'Sin evaluación' : `${dias}d sin eval`}
                      </span>
                    )}
                  </div>
                  {last && (
                    <p className="text-white/50 text-xs mt-0.5">
                      Última: {new Date(last.date).toLocaleDateString('es-AR')} por {last.coach?.first_name}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button onClick={() => openEval(a)}
                    className="text-[11px] bg-ball text-black px-2.5 py-1 rounded font-black">+ Eval</button>
                  <button onClick={() => setHistoryOpen(a)}
                    className="text-[11px] bg-white/10 border border-white/20 text-white px-2.5 py-1 rounded font-black">Hist.</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal nueva eval */}
      {evalOpen && target && (
        <div className="fixed inset-0 bg-black/85 z-50 overflow-y-auto"
          onClick={() => setEvalOpen(false)}>
          <div className="bg-[#0B0F16] border-2 border-white/15 rounded-2xl w-full max-w-xl mx-auto p-5 my-6"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-ball text-[11px] font-black tracking-widest">NUEVA EVALUACIÓN</p>
                <p className="font-display font-black text-lg">{target.profile.first_name} {target.profile.last_name}</p>
              </div>
              <button onClick={() => setEvalOpen(false)} className="w-9 h-9 rounded-full bg-white/10 text-white font-bold">✕</button>
            </div>

            {/* 6 dimensiones con sliders */}
            <div className="mt-4 space-y-3">
              {DIMS.map(d => (
                <div key={d.k}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-black"><span className="mr-2">{d.icon}</span>{d.l}</span>
                    <span className={`font-display font-black text-lg ${d.color}`}>{form[d.k]}/10</span>
                  </div>
                  <input type="range" min="1" max="10" value={form[d.k]}
                    onChange={e => setForm({ ...form, [d.k]: Number(e.target.value) })}
                    className="w-full accent-ball" />
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <p className="text-white/70 text-xs font-black uppercase mb-1.5">💪 Fortalezas</p>
                <textarea value={form.strengths} onChange={e => setForm({ ...form, strengths: e.target.value })}
                  rows={2} placeholder="Ej: muy buen revés, buena actitud en entrenamientos…"
                  className="input w-full resize-none" />
              </div>
              <div>
                <p className="text-white/70 text-xs font-black uppercase mb-1.5">🎯 A mejorar</p>
                <textarea value={form.weaknesses} onChange={e => setForm({ ...form, weaknesses: e.target.value })}
                  rows={2} placeholder="Ej: salida de pared, decisión en volea…"
                  className="input w-full resize-none" />
              </div>
              <div>
                <p className="text-white/70 text-xs font-black uppercase mb-1.5">🏁 Objetivos del período</p>
                <textarea value={form.goals} onChange={e => setForm({ ...form, goals: e.target.value })}
                  rows={2} placeholder="Ej: consolidar bandeja, subir a 4ta cat…"
                  className="input w-full resize-none" />
              </div>
              <div>
                <p className="text-white/70 text-xs font-black uppercase mb-1.5">📝 Notas (opcional)</p>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  rows={2} className="input w-full resize-none" />
              </div>
              <div>
                <p className="text-white/70 text-xs font-black uppercase mb-1.5">📅 Próxima evaluación</p>
                <input type="date" value={form.next_eval_date}
                  onChange={e => setForm({ ...form, next_eval_date: e.target.value })}
                  className="input w-full" />
              </div>
            </div>

            <button onClick={guardar} disabled={saving}
              className="btn-ball w-full mt-5 disabled:opacity-50">
              {saving ? 'Guardando…' : '✓ Guardar evaluación'}
            </button>
          </div>
        </div>
      )}

      {/* Modal historial */}
      {historyOpen && (
        <div className="fixed inset-0 bg-black/85 z-50 overflow-y-auto"
          onClick={() => setHistoryOpen(null)}>
          <div className="bg-[#0B0F16] border-2 border-white/15 rounded-2xl w-full max-w-xl mx-auto p-5 my-6"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-ball text-[11px] font-black tracking-widest">HISTORIAL DE EVALUACIONES</p>
                <p className="font-display font-black text-lg">{historyOpen.profile.first_name} {historyOpen.profile.last_name}</p>
              </div>
              <button onClick={() => setHistoryOpen(null)} className="w-9 h-9 rounded-full bg-white/10 text-white font-bold">✕</button>
            </div>
            <div className="mt-4 space-y-3">
              {stuHistory.length === 0 ? (
                <p className="text-white/40 text-sm text-center py-8">Sin evaluaciones todavía</p>
              ) : stuHistory.map(e => (
                <div key={e.id} className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-black text-sm">{new Date(e.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    <span className={`font-display font-black text-xl ${
                      e.overall >= 8 ? 'text-emerald-300' : e.overall >= 6 ? 'text-ball' : 'text-orange-300'
                    }`}>{e.overall}/10</span>
                  </div>
                  <p className="text-white/50 text-xs">por {e.coach?.first_name} {e.coach?.last_name}</p>
                  <div className="mt-2 grid grid-cols-3 gap-1 text-[11px]">
                    {DIMS.map(d => (
                      <div key={d.k} className="bg-black/30 rounded p-1.5">
                        <span className="opacity-60">{d.icon} {d.l}</span>
                        <span className={`font-black ml-1 ${d.color}`}>{e[d.k]}</span>
                      </div>
                    ))}
                  </div>
                  {e.strengths && <p className="text-emerald-300 text-xs mt-2">💪 {e.strengths}</p>}
                  {e.weaknesses && <p className="text-orange-300 text-xs mt-1">🎯 {e.weaknesses}</p>}
                  {e.goals && <p className="text-ball text-xs mt-1">🏁 {e.goals}</p>}
                  {e.notes && <p className="text-white/60 text-xs mt-1 italic">"{e.notes}"</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
