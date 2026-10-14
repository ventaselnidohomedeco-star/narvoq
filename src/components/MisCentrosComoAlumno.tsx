'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

const PILLAR_ICONS: Record<string, string> = {
  cancha: '🎾', gym: '🏋️', filosofia: '🧠', psicologia: '💭', nutricion: '🥗'
};

export default function MisCentrosComoAlumno({ profileId }: { profileId: string }) {
  const [centros, setCentros] = useState<any[]>([]);
  const [progresos, setProgresos] = useState<Record<string, any[]>>({});
  const [confirmPending, setConfirmPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: cm } = await supabase.from('center_members')
        .select('id, monthly_fee, payment_status, center:training_centers!center_id(id, slug, name, logo_url, brand)')
        .eq('profile_id', profileId).eq('role', 'student').eq('active', true);
      setCentros(cm ?? []);

      if (cm && cm.length > 0) {
        const centerIds = cm.map((c: any) => c.center?.id).filter(Boolean);
        // Progreso por pilar en últimos 30 días
        const { data: prog } = await supabase.from('v_student_pillar_progress')
          .select('*').eq('student_id', profileId).in('center_id', centerIds);
        const grouped: Record<string, any[]> = {};
        (prog ?? []).forEach((p: any) => {
          (grouped[p.center_id] = grouped[p.center_id] ?? []).push(p);
        });
        setProgresos(grouped);

        // Sesiones futuras sin confirmar
        const today = new Date().toISOString().slice(0, 10);
        const { data: sess } = await supabase.from('pillar_sessions')
          .select('id, date, session_time, pillar, confirmed_at, center_id, coach:profiles!coach_id(first_name)')
          .eq('student_id', profileId)
          .in('center_id', centerIds)
          .gte('date', today)
          .is('confirmed_at', null)
          .order('date').limit(5);
        setConfirmPending(sess ?? []);
      }
      setLoading(false);
    })();
  }, [profileId]);

  if (loading || centros.length === 0) return null;

  return (
    <div className="mt-5 space-y-3">
      {centros.map((cm: any) => {
        const c = cm.center;
        if (!c) return null;
        const prog = progresos[c.id] ?? [];
        const totalHs = prog.reduce((s: number, x: any) => s + Number(x.hours_last_30d), 0);
        return (
          <Link key={c.id} href={`/training/centro/${c.slug}`}
            className="block rounded-2xl bg-gradient-to-br from-ball/15 via-ball/5 to-transparent border-2 border-ball/40 p-4 active:scale-95 transition">
            <div className="flex items-center gap-3">
              {c.logo_url
                ? <img src={c.logo_url} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0 border border-white/20" />
                : <span className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center text-2xl shrink-0">🏫</span>}
              <div className="flex-1 min-w-0">
                <p className="text-ball text-[10px] font-black tracking-widest">🎓 ALUMNO EN</p>
                <p className="font-display font-black text-lg leading-tight text-white">{c.name}</p>
                {c.brand && <p className="text-white/60 text-xs">{c.brand}</p>}
              </div>
              <span className="text-ball text-xl">→</span>
            </div>
            {prog.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {prog.map((p: any) => (
                  <span key={p.pillar} className="text-[11px] bg-white/5 border border-white/10 px-2 py-1 rounded font-black">
                    {PILLAR_ICONS[p.pillar] ?? '📌'} {Number(p.hours_last_30d).toFixed(1)}h
                  </span>
                ))}
                <span className="text-[11px] bg-ball/20 border border-ball/40 text-ball px-2 py-1 rounded font-black ml-auto">
                  Total: {totalHs.toFixed(1)}h este mes
                </span>
              </div>
            )}
            {cm.payment_status === 'vencido' && (
              <p className="mt-2 text-red-300 text-xs font-black">⚠ Cuota vencida — contactá a tu centro</p>
            )}
          </Link>
        );
      })}

      {/* Confirmaciones pendientes */}
      {confirmPending.length > 0 && (
        <div className="rounded-2xl bg-orange-500/10 border border-orange-500/40 p-4">
          <p className="text-orange-200 text-[11px] font-black tracking-widest">📅 CLASES POR CONFIRMAR</p>
          <p className="text-white/80 text-xs mt-1 mb-3">
            Tenés {confirmPending.length} {confirmPending.length === 1 ? 'clase' : 'clases'} próximas sin confirmar
          </p>
          <div className="space-y-1.5">
            {confirmPending.slice(0, 3).map((s: any) => {
              const d = new Date(s.date + 'T00:00:00');
              return (
                <div key={s.id} className="text-sm">
                  <span className="font-black">{PILLAR_ICONS[s.pillar] ?? '📌'}</span>{' '}
                  <span className="text-white">{d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}</span>{' '}
                  <span className="text-white/60">{s.session_time?.slice(0,5) ?? '18:00'}hs</span>
                  {s.coach && <span className="text-white/50 text-xs"> · con {s.coach.first_name}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
