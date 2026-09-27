'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

const PILARES = [
  { key: 'cancha', label: 'Cancha', icon: '🎾', color: 'bg-ball/20 text-ball border-ball/40', desc: 'Técnica, táctica, golpes' },
  { key: 'gym', label: 'GYM', icon: '🏋️', color: 'bg-orange-500/20 text-orange-300 border-orange-500/40', desc: 'Fuerza y físico' },
  { key: 'filosofia', label: 'Filosofía', icon: '🧠', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40', desc: 'Mentalidad, valores' },
  { key: 'psicologia', label: 'Psicología', icon: '💭', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40', desc: 'Deportiva, sesiones' },
  { key: 'nutricion', label: 'Nutrición', icon: '🥗', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', desc: 'Plan alimenticio' }
];

export default function CentroPilares() {
  const { slug } = useParams<{ slug: string }>();
  const [me, setMe] = useState<any>(null);
  const [centro, setCentro] = useState<any>(null);
  const [alumnos, setAlumnos] = useState<any[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulario nueva sesión
  const [form, setForm] = useState({
    pillar: 'cancha' as string,
    student_id: '',
    coach_id: '',
    date: new Date().toISOString().slice(0, 10),
    hours: '1',
    attended: true,
    compliance_pct: '',
    notes: ''
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) { const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(); setMe(p); }
    const { data: c } = await supabase.from('training_centers').select('*').eq('slug', slug).maybeSingle();
    if (!c) { setLoading(false); return; }
    setCentro(c);

    const [{ data: al }, { data: st }, { data: ss }] = await Promise.all([
      supabase.from('center_members').select('id, profile:profiles!profile_id(id, first_name, last_name, category)')
        .eq('center_id', c.id).eq('role', 'student').eq('active', true),
      supabase.from('center_members').select('id, profile:profiles!profile_id(id, first_name, last_name)')
        .eq('center_id', c.id).in('role', ['master', 'coach', 'assistant']).eq('active', true),
      supabase.from('pillar_sessions')
        .select('*, student:profiles!student_id(first_name, last_name), coach:profiles!coach_id(first_name, last_name)')
        .eq('center_id', c.id).order('date', { ascending: false }).limit(30)
    ]);
    setAlumnos(al ?? []);
    setCoaches(st ?? []);
    setSessions(ss ?? []);
    // Coach por defecto = yo
    if (user && !form.coach_id) setForm(f => ({ ...f, coach_id: user.id }));
    setLoading(false);
  }
  useEffect(() => { load(); }, [slug]);

  async function registrar() {
    if (!centro) return;
    if (!form.student_id) return alert('Elegí un alumno.');
    setSaving(true);
    const { error: err } = await supabase.from('pillar_sessions').insert({
      center_id: centro.id,
      student_id: form.student_id,
      pillar: form.pillar,
      date: form.date,
      hours: Number(form.hours) || 1,
      coach_id: form.coach_id || null,
      attended: form.attended,
      compliance_pct: form.pillar === 'nutricion' && form.compliance_pct ? Number(form.compliance_pct) : null,
      notes: form.notes.trim() || null
    });
    setSaving(false);
    if (err) return alert('Error: ' + err.message);
    // Limpiar
    setForm({ ...form, student_id: '', hours: '1', compliance_pct: '', notes: '', attended: true });
    load();
  }

  async function borrar(id: string) {
    if (!confirm('¿Borrar esta sesión?')) return;
    await supabase.from('pillar_sessions').delete().eq('id', id);
    load();
  }

  if (loading) return <main className="p-8 text-white/60">Cargando…</main>;
  if (!centro) return <main className="p-8"><p className="text-white/60">Centro no encontrado</p></main>;

  const pilarSel = PILARES.find(p => p.key === form.pillar)!;

  return (
    <main className="min-h-dvh max-w-2xl mx-auto text-white px-5 py-6">
      <Link href={`/training/centro/${slug}`} className="text-white/50 text-xs font-black">← {centro.name}</Link>
      <h1 className="font-display font-black text-2xl mt-1">🏋️ Registrar sesión</h1>
      <p className="text-white/50 text-sm">Cada sesión suma horas al pilar del alumno</p>

      {/* Selector pilar */}
      <div className="mt-5">
        <p className="text-white/70 text-xs font-black uppercase mb-2">Pilar</p>
        <div className="grid grid-cols-5 gap-2">
          {PILARES.map(p => (
            <button key={p.key} onClick={() => setForm({ ...form, pillar: p.key })}
              className={`rounded-xl p-2 text-center transition ${
                form.pillar === p.key ? p.color + ' border-2' : 'bg-white/5 border border-white/10 opacity-60 hover:opacity-100'
              }`}>
              <p className="text-2xl">{p.icon}</p>
              <p className="text-[10px] font-black mt-0.5">{p.label}</p>
            </button>
          ))}
        </div>
        <p className="text-white/50 text-xs mt-2 text-center">{pilarSel.desc}</p>
      </div>

      {/* Formulario */}
      <div className="mt-5 rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
        <div>
          <p className="text-white/70 text-xs font-black uppercase mb-1.5">Alumno</p>
          <select value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })}
            className="input w-full">
            <option value="">— Elegí un alumno —</option>
            {alumnos.map(a => (
              <option key={a.id} value={a.profile?.id}>
                {a.profile?.first_name} {a.profile?.last_name} {a.profile?.category ? `(cat ${a.profile.category})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="text-white/70 text-xs font-black uppercase mb-1.5">Coach</p>
          <select value={form.coach_id} onChange={e => setForm({ ...form, coach_id: e.target.value })}
            className="input w-full">
            <option value="">— Elegí coach —</option>
            {coaches.map(c => (
              <option key={c.id} value={c.profile?.id}>
                {c.profile?.first_name} {c.profile?.last_name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-white/70 text-xs font-black uppercase mb-1.5">Fecha</p>
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
              className="input w-full" />
          </div>
          <div>
            <p className="text-white/70 text-xs font-black uppercase mb-1.5">Horas</p>
            <input type="number" step="0.5" min="0.5" max="6" value={form.hours}
              onChange={e => setForm({ ...form, hours: e.target.value })} className="input w-full" />
          </div>
        </div>

        {form.pillar === 'nutricion' && (
          <div>
            <p className="text-white/70 text-xs font-black uppercase mb-1.5">Cumplimiento del plan esta semana (%)</p>
            <input type="number" min="0" max="100" value={form.compliance_pct}
              onChange={e => setForm({ ...form, compliance_pct: e.target.value })}
              placeholder="ej: 80" className="input w-full" />
          </div>
        )}

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.attended}
            onChange={e => setForm({ ...form, attended: e.target.checked })}
            className="w-5 h-5 accent-ball" />
          <span className="text-sm font-bold">Asistió {!form.attended && <span className="text-red-300">(cuenta ausentismo)</span>}</span>
        </label>

        <div>
          <p className="text-white/70 text-xs font-black uppercase mb-1.5">Notas (opcional)</p>
          <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
            rows={2} placeholder="Ej: trabajó bandeja, mejoró posición…"
            className="input w-full resize-none" />
        </div>

        <button onClick={registrar} disabled={saving} className="btn-ball w-full disabled:opacity-50">
          {saving ? 'Guardando…' : `${pilarSel.icon} Registrar sesión`}
        </button>
      </div>

      {/* Historial */}
      <p className="text-white/60 text-xs font-black uppercase mt-6 mb-2">Últimas sesiones</p>
      {sessions.length === 0 ? (
        <p className="text-white/40 text-sm py-4 text-center bg-white/5 rounded-xl">Sin sesiones aún</p>
      ) : (
        <div className="space-y-2">
          {sessions.map(s => {
            const pil = PILARES.find(p => p.key === s.pillar);
            return (
              <div key={s.id} className="rounded-xl bg-white/5 border border-white/10 p-3">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{pil?.icon ?? '📌'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-black text-sm">{s.student?.first_name} {s.student?.last_name}</p>
                      <span className="text-[10px] text-white/50">{new Date(s.date).toLocaleDateString('es-AR')}</span>
                    </div>
                    <p className="text-white/60 text-xs">
                      {pil?.label} · {Number(s.hours).toFixed(1)}h
                      {s.coach && ` · con ${s.coach.first_name}`}
                      {!s.attended && ' · ❌ AUSENTE'}
                      {s.compliance_pct != null && ` · ${s.compliance_pct}% cumpl.`}
                    </p>
                    {s.notes && <p className="text-white/70 text-xs mt-1 italic">"{s.notes}"</p>}
                  </div>
                  <button onClick={() => borrar(s.id)} className="text-red-400/60 text-xs">✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
