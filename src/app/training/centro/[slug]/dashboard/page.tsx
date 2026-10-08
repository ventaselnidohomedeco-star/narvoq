'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

export default function CentroDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const [centro, setCentro] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState<any>({
    alumnos_activos: 0,
    nuevos_mes: 0,
    ingresos_mes: 0,
    egresos_mes: 0,
    ganancia_mes: 0,
    tasa_ausentismo: 0,
    horas_totales_mes: 0,
    coaches: []
  });

  async function load() {
    const { data: c } = await supabase.from('training_centers').select('*').eq('slug', slug).maybeSingle();
    if (!c) { setLoading(false); return; }
    setCentro(c);

    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

    const [{ data: alumnos }, { data: staff }, { data: ss30 }] = await Promise.all([
      supabase.from('center_members').select('id, monthly_fee, joined_at, active')
        .eq('center_id', c.id).eq('role', 'student'),
      supabase.from('center_members').select('id, profile_id, role, hourly_rate, profile:profiles!profile_id(first_name, last_name, avatar_url)')
        .eq('center_id', c.id).in('role', ['master', 'coach', 'assistant']).eq('active', true),
      supabase.from('pillar_sessions').select('*')
        .eq('center_id', c.id).gte('date', firstOfMonth).limit(10000)
    ]);

    const alumActivos = (alumnos ?? []).filter((a: any) => a.active);
    const nuevos = alumActivos.filter((a: any) => new Date(a.joined_at) >= new Date(firstOfMonth)).length;
    const ingresos = alumActivos.reduce((s: number, a: any) => s + (Number(a.monthly_fee) || 0), 0);

    const sesMes = ss30 ?? [];
    const ausentes = sesMes.filter((s: any) => !s.attended).length;
    const tasa = sesMes.length > 0 ? (ausentes / sesMes.length) * 100 : 0;
    const horasTot = sesMes.filter((s: any) => s.attended).reduce((s: number, x: any) => s + Number(x.hours), 0);

    // Egresos: por cada sesión, coach.hourly_rate × horas
    let egresos = 0;
    const coachStatsMap: Record<string, { profile: any; hours: number; sesiones: number; ausentes: number; students: Set<string>; earned: number }> = {};
    (staff ?? []).forEach((s: any) => {
      if (s.profile_id) {
        coachStatsMap[s.profile_id] = {
          profile: s.profile, hours: 0, sesiones: 0, ausentes: 0,
          students: new Set(), earned: 0
        };
      }
    });
    for (const ses of sesMes) {
      const coachId = ses.coach_id;
      if (coachId && coachStatsMap[coachId]) {
        const cs = coachStatsMap[coachId];
        if (ses.attended) {
          cs.hours += Number(ses.hours);
          cs.sesiones++;
          cs.students.add(ses.student_id);
          const rate = (staff ?? []).find((s: any) => s.profile_id === coachId)?.hourly_rate;
          if (rate) {
            const earn = Number(rate) * Number(ses.hours);
            cs.earned += earn;
            egresos += earn;
          }
        } else {
          cs.ausentes++;
        }
      }
    }
    const coachStats = Object.values(coachStatsMap).map(cs => ({
      ...cs, students_count: cs.students.size
    })).sort((a, b) => b.hours - a.hours);

    setKpi({
      alumnos_activos: alumActivos.length,
      nuevos_mes: nuevos,
      ingresos_mes: ingresos,
      egresos_mes: egresos,
      ganancia_mes: ingresos - egresos,
      tasa_ausentismo: tasa,
      horas_totales_mes: horasTot,
      coaches: coachStats
    });
    setLoading(false);
  }
  useEffect(() => { load(); }, [slug]);

  if (loading) return <main className="p-8 text-white/60">Cargando dashboard…</main>;
  if (!centro) return <main className="p-8"><p className="text-white/60">Centro no encontrado</p></main>;

  return (
    <main className="min-h-dvh max-w-2xl mx-auto text-white px-5 py-6">
      <Link href={`/training/centro/${slug}`} className="text-white/50 text-xs font-black">← {centro.name}</Link>
      <h1 className="font-display font-black text-2xl mt-1">📊 Dashboard</h1>
      <p className="text-white/50 text-sm">Mes en curso · {new Date().toLocaleString('es-AR', { month: 'long', year: 'numeric' })}</p>

      {/* KPIs principales */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500/20 to-transparent border border-emerald-500/40 p-4">
          <p className="text-emerald-300 text-[10px] font-black uppercase">Ingresos previstos</p>
          <p className="font-display font-black text-2xl mt-1 text-emerald-100">${kpi.ingresos_mes.toLocaleString('es-AR')}</p>
          <p className="text-emerald-200/60 text-[11px]">Cuotas de {kpi.alumnos_activos} alumnos</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-red-500/15 to-transparent border border-red-500/30 p-4">
          <p className="text-red-300 text-[10px] font-black uppercase">Egresos (staff)</p>
          <p className="font-display font-black text-2xl mt-1 text-red-100">${Math.round(kpi.egresos_mes).toLocaleString('es-AR')}</p>
          <p className="text-red-200/60 text-[11px]">Pago por hora dictada</p>
        </div>
        <div className={`col-span-2 rounded-2xl border p-4 ${
          kpi.ganancia_mes >= 0 ? 'bg-ball/15 border-ball/40' : 'bg-red-500/20 border-red-500/50'
        }`}>
          <p className="text-ball text-[10px] font-black uppercase">Ganancia neta del mes</p>
          <p className={`font-display font-black text-4xl mt-1 ${kpi.ganancia_mes >= 0 ? 'text-ball' : 'text-red-200'}`}>
            ${Math.round(kpi.ganancia_mes).toLocaleString('es-AR')}
          </p>
        </div>
      </div>

      {/* Métricas operativas */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
          <p className="font-display font-black text-2xl text-ball">{kpi.alumnos_activos}</p>
          <p className="text-white/50 text-[10px] font-black uppercase mt-0.5">Alumnos</p>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
          <p className="font-display font-black text-2xl text-ball">+{kpi.nuevos_mes}</p>
          <p className="text-white/50 text-[10px] font-black uppercase mt-0.5">Nuevos mes</p>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
          <p className={`font-display font-black text-2xl ${kpi.tasa_ausentismo > 15 ? 'text-red-300' : 'text-ball'}`}>
            {kpi.tasa_ausentismo.toFixed(0)}%
          </p>
          <p className="text-white/50 text-[10px] font-black uppercase mt-0.5">Ausentismo</p>
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-white/5 border border-white/10 p-4">
        <p className="text-white/60 text-[10px] font-black uppercase">Horas dictadas este mes</p>
        <p className="font-display font-black text-3xl text-ball mt-1">{kpi.horas_totales_mes.toFixed(1)}h</p>
      </div>

      {/* Ranking coaches */}
      <div className="mt-6">
        <p className="text-ball text-[11px] font-black tracking-widest mb-2">🏆 RANKING STAFF (este mes)</p>
        {kpi.coaches.length === 0 ? (
          <p className="text-white/40 text-sm py-4 text-center bg-white/5 rounded-xl">Sin datos aún</p>
        ) : (
          <div className="space-y-2">
            {kpi.coaches.map((c: any, i: number) => (
              <div key={i} className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 p-3">
                <span className="text-2xl w-8 text-center font-display font-black text-white/40">{i + 1}</span>
                {c.profile?.avatar_url
                  ? <img src={c.profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                  : <span className="w-10 h-10 rounded-full bg-grafito text-white font-black flex items-center justify-center shrink-0">{c.profile?.first_name?.[0]}</span>}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm">{c.profile?.first_name} {c.profile?.last_name}</p>
                  <p className="text-white/50 text-xs">
                    {c.hours.toFixed(1)}h · {c.sesiones} sesiones · {c.students_count} alumnos
                    {c.ausentes > 0 && ` · ${c.ausentes} ausentes`}
                  </p>
                </div>
                {c.earned > 0 && (
                  <p className="text-emerald-300 font-black text-sm shrink-0">${Math.round(c.earned).toLocaleString('es-AR')}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-2xl bg-white/5 border border-white/10 p-4 opacity-60">
        <p className="text-white/60 text-[11px] font-black uppercase">Próximamente</p>
        <p className="text-white/80 text-sm mt-1">💰 Bonos automáticos por rendimiento, retención y captación de alumnos</p>
      </div>
    </main>
  );
}
