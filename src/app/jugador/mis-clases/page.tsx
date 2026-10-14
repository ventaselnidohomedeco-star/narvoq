'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

const PILLAR = {
  cancha:    { icon: '🎾', label: 'Cancha', color: 'text-ball' },
  gym:       { icon: '🏋️', label: 'GYM', color: 'text-orange-300' },
  filosofia: { icon: '🧠', label: 'Filosofía', color: 'text-purple-300' },
  psicologia:{ icon: '💭', label: 'Psicología', color: 'text-blue-300' },
  nutricion: { icon: '🥗', label: 'Nutrición', color: 'text-emerald-300' }
} as const;

const DIMS = [
  { k: 'score_tecnica', l: 'Técnica', icon: '🎾' },
  { k: 'score_tactica', l: 'Táctica', icon: '🧠' },
  { k: 'score_fisico',  l: 'Físico',  icon: '🏋️' },
  { k: 'score_mental',  l: 'Mental',  icon: '💭' },
  { k: 'score_actitud', l: 'Actitud', icon: '😎' },
  { k: 'score_compromiso', l: 'Compromiso', icon: '💪' }
];

export default function MisClases() {
  const [me, setMe] = useState<any>(null);
  const [proximas, setProximas] = useState<any[]>([]);
  const [pasadas, setPasadas] = useState<any[]>([]);
  const [evals, setEvals] = useState<any[]>([]);
  const [centros, setCentros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'proximas' | 'historial' | 'evaluaciones'>('proximas');

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    setMe(p);
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: future }, { data: past }, { data: ev }, { data: cm }] = await Promise.all([
      supabase.from('pillar_sessions')
        .select('*, center:training_centers!center_id(id, slug, name), coach:profiles!coach_id(first_name, last_name)')
        .eq('student_id', user.id).gte('date', today).order('date').order('session_time').limit(50),
      supabase.from('pillar_sessions')
        .select('*, center:training_centers!center_id(name), coach:profiles!coach_id(first_name)')
        .eq('student_id', user.id).lt('date', today).order('date', { ascending: false }).limit(100),
      supabase.from('coaching_evaluations')
        .select('*, coach:profiles!coach_id(first_name, last_name), center:training_centers!center_id(name)')
        .eq('student_id', user.id).order('date', { ascending: false }).limit(50),
      supabase.from('center_members')
        .select('center:training_centers!center_id(id, slug, name)')
        .eq('profile_id', user.id).eq('role', 'student').eq('active', true)
    ]);
    setProximas(future ?? []);
    setPasadas(past ?? []);
    setEvals(ev ?? []);
    setCentros((cm ?? []).map((c: any) => c.center).filter(Boolean));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function confirmar(id: string) {
    await supabase.from('pillar_sessions')
      .update({ confirmed_at: new Date().toISOString(), confirmed_by: 'student' })
      .eq('id', id);
    load();
  }

  async function noPuedo(id: string) {
    if (!confirm('Avisá a tu coach que no vas a poder asistir. Esto registra tu ausencia.')) return;
    await supabase.from('pillar_sessions')
      .update({ attended: false, confirmed_at: new Date().toISOString(), confirmed_by: 'student' })
      .eq('id', id);
    load();
  }

  if (loading) return <main className="p-8 text-white/60">Cargando…</main>;
  if (!me) return <main className="p-8 text-white/60">Iniciá sesión</main>;
  if (centros.length === 0) return (
    <main className="p-8 text-center">
      <p className="text-6xl">🏫</p>
      <p className="font-black text-xl mt-3">No pertenecés a ningún Centro de Entrenamiento</p>
      <p className="text-white/50 text-sm mt-2">Si querés entrenar con un centro, pedile al Master Coach que te agregue</p>
      <Link href="/jugador/dashboard" className="mt-6 inline-block text-ball font-black">← Volver</Link>
    </main>
  );

  const sinConfirmar = proximas.filter(p => !p.confirmed_at).length;

  return (
    <main className="min-h-dvh max-w-2xl mx-auto text-white px-5 py-6">
      <Link href="/jugador/dashboard" className="text-white/50 text-xs font-black">← Mi perfil</Link>
      <h1 className="font-display font-black text-2xl mt-1">🏫 Mis clases</h1>
      {centros.length > 0 && (
        <p className="text-white/50 text-sm">
          En {centros.map(c => c.name).join(' · ')}
        </p>
      )}

      {/* Tabs */}
      <div className="mt-5 grid grid-cols-3 gap-2">
        {[
          { k: 'proximas', l: '📅 Próximas', badge: sinConfirmar },
          { k: 'historial', l: '📜 Historial' },
          { k: 'evaluaciones', l: '🎯 Evaluaciones' }
        ].map((t: any) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`relative py-2.5 rounded-xl font-black text-sm ${tab === t.k ? 'bg-ball text-black' : 'bg-white/5 text-white/60 border border-white/10'}`}>
            {t.l}
            {t.badge > 0 && tab !== t.k && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Próximas */}
      {tab === 'proximas' && (
        <div className="mt-5 space-y-2">
          {proximas.length === 0 ? (
            <p className="text-white/40 text-sm text-center py-8 bg-white/5 rounded-xl">No tenés clases próximas agendadas</p>
          ) : proximas.map(s => {
            const pil = (PILLAR as any)[s.pillar] ?? { icon: '📌', label: s.pillar, color: 'text-white' };
            const d = new Date(s.date + 'T00:00:00');
            const confirmada = s.confirmed_at && s.attended !== false;
            const rechazada = s.confirmed_at && s.attended === false;
            return (
              <div key={s.id} className={`rounded-xl border p-4 ${
                confirmada ? 'bg-emerald-500/10 border-emerald-500/40' :
                rechazada ? 'bg-red-500/10 border-red-500/40' :
                'bg-white/5 border-white/10'
              }`}>
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{pil.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-black">{pil.label}</p>
                    <p className="text-sm text-white/80 capitalize">
                      {d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                      {' · '}{s.session_time?.slice(0,5) ?? '18:00'} hs
                    </p>
                    <p className="text-white/50 text-xs mt-0.5">
                      {s.center?.name}
                      {s.coach && ` · con ${s.coach.first_name}`}
                    </p>
                    <p className="text-xs mt-2">
                      {confirmada ? <span className="text-emerald-300 font-black">✓ Confirmaste asistencia</span>
                      : rechazada ? <span className="text-red-300 font-black">✗ Avisaste que no vas</span>
                      : <span className="text-white/50">Sin confirmar</span>}
                    </p>
                  </div>
                </div>
                {!s.confirmed_at && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button onClick={() => confirmar(s.id)}
                      className="py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 font-black text-sm active:scale-95 transition">
                      ✓ Voy
                    </button>
                    <button onClick={() => noPuedo(s.id)}
                      className="py-2.5 rounded-xl bg-red-500/10 border border-red-500/40 text-red-300 font-black text-sm active:scale-95 transition">
                      ✗ No puedo
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tab Historial */}
      {tab === 'historial' && (
        <div className="mt-5 space-y-2">
          {pasadas.length === 0 ? (
            <p className="text-white/40 text-sm text-center py-8 bg-white/5 rounded-xl">Sin clases registradas aún</p>
          ) : (
            <>
              <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                <div className="grid grid-cols-5 gap-2 text-center">
                  {Object.entries(PILLAR).map(([k, v]: any) => {
                    const hs = pasadas.filter(p => p.pillar === k && p.attended).reduce((s: number, x: any) => s + Number(x.hours), 0);
                    return (
                      <div key={k}>
                        <p className="text-xl">{v.icon}</p>
                        <p className={`font-black text-sm ${v.color}`}>{hs.toFixed(1)}h</p>
                      </div>
                    );
                  })}
                </div>
                <p className="text-white/40 text-[11px] text-center mt-2">Horas totales por pilar</p>
              </div>
              {pasadas.map(s => {
                const pil = (PILLAR as any)[s.pillar] ?? { icon: '📌', label: s.pillar };
                return (
                  <div key={s.id} className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 p-3">
                    <span className="text-2xl">{pil.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm">{pil.label} · {Number(s.hours).toFixed(1)}h</p>
                      <p className="text-white/50 text-xs">
                        {new Date(s.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
                        {s.coach && ` · ${s.coach.first_name}`}
                        {!s.attended && <span className="text-red-300"> · AUSENTE</span>}
                      </p>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* Tab Evaluaciones */}
      {tab === 'evaluaciones' && (
        <div className="mt-5 space-y-3">
          {evals.length === 0 ? (
            <p className="text-white/40 text-sm text-center py-8 bg-white/5 rounded-xl">Tu coach aún no te hizo evaluaciones</p>
          ) : evals.map(e => (
            <div key={e.id} className="rounded-xl bg-white/5 border border-white/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-black">{new Date(e.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  <p className="text-white/50 text-xs">por {e.coach?.first_name} {e.coach?.last_name} en {e.center?.name}</p>
                </div>
                <span className={`font-display font-black text-2xl ${
                  e.overall >= 8 ? 'text-emerald-300' : e.overall >= 6 ? 'text-ball' : 'text-orange-300'
                }`}>{e.overall}/10</span>
              </div>
              <div className="grid grid-cols-3 gap-1 mt-2">
                {DIMS.map(d => (
                  <div key={d.k} className="bg-black/30 rounded p-1.5 text-center">
                    <p className="text-[10px] opacity-60">{d.icon} {d.l}</p>
                    <p className="font-black text-ball">{e[d.k]}/10</p>
                  </div>
                ))}
              </div>
              {e.strengths && (
                <div className="mt-3 rounded bg-emerald-500/10 border border-emerald-500/30 p-2">
                  <p className="text-emerald-300 text-[11px] font-black">💪 FORTALEZAS</p>
                  <p className="text-sm mt-1">{e.strengths}</p>
                </div>
              )}
              {e.weaknesses && (
                <div className="mt-2 rounded bg-orange-500/10 border border-orange-500/30 p-2">
                  <p className="text-orange-300 text-[11px] font-black">🎯 A MEJORAR</p>
                  <p className="text-sm mt-1">{e.weaknesses}</p>
                </div>
              )}
              {e.goals && (
                <div className="mt-2 rounded bg-ball/10 border border-ball/30 p-2">
                  <p className="text-ball text-[11px] font-black">🏁 OBJETIVOS</p>
                  <p className="text-sm mt-1">{e.goals}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
