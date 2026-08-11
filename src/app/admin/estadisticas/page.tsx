'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { BarChart, DonutChart, LineChart, ChartLegend } from '@/components/Charts';

// /admin/estadisticas — Gráficos y tendencias para análisis.
// Todo se calcula en el cliente desde queries a Supabase (agrupaciones).

const BALL = '#D8F646';

type Bucket = { label: string; value: number };
type WeeklySignups = { players: Bucket[]; coaches: Bucket[]; complexes: Bucket[] };

export default function AdminEstadisticas() {
  const [loading, setLoading] = useState(true);
  const [weekly, setWeekly] = useState<WeeklySignups>({ players: [], coaches: [], complexes: [] });
  const [monthlyRevenue, setMonthlyRevenue] = useState<Bucket[]>([]);
  const [planDist, setPlanDist] = useState<{ label: string; value: number; color: string }[]>([]);
  const [topComplejos, setTopComplejos] = useState<any[]>([]);
  const [topProfes, setTopProfes] = useState<any[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    await Promise.all([loadWeeklySignups(), loadRevenue(), loadPlanDistribution(), loadTops()]);
    setLoading(false);
  }

  // --- Signups semanales (últimas 12 semanas) ---
  async function loadWeeklySignups() {
    const weeks = 12;
    const buckets = { players: [] as Bucket[], coaches: [] as Bucket[], complexes: [] as Bucket[] };
    const now = Date.now();

    const [profs, cxs] = await Promise.all([
      supabase.from('profiles').select('created_at, role').gte('created_at', new Date(now - weeks * 7 * 24 * 3600 * 1000).toISOString()),
      supabase.from('complexes').select('created_at').gte('created_at', new Date(now - weeks * 7 * 24 * 3600 * 1000).toISOString())
    ]);

    for (let w = weeks - 1; w >= 0; w--) {
      const start = now - (w + 1) * 7 * 24 * 3600 * 1000;
      const end = now - w * 7 * 24 * 3600 * 1000;
      const label = new Date(end).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });

      const playersCount = (profs.data ?? []).filter(p => {
        const t = new Date(p.created_at).getTime();
        return t >= start && t < end && p.role === 'player';
      }).length;
      const coachesCount = (profs.data ?? []).filter(p => {
        const t = new Date(p.created_at).getTime();
        return t >= start && t < end && p.role === 'coach';
      }).length;
      const cxCount = (cxs.data ?? []).filter(c => {
        const t = new Date(c.created_at).getTime();
        return t >= start && t < end;
      }).length;

      buckets.players.push({ label, value: playersCount });
      buckets.coaches.push({ label, value: coachesCount });
      buckets.complexes.push({ label, value: cxCount });
    }
    setWeekly(buckets);
  }

  // --- Revenue mensual (últimos 6 meses) desde suscripciones ---
  async function loadRevenue() {
    const months = 6;
    const now = new Date();
    const bucketsMap: Record<string, number> = {};

    const { data: subs } = await supabase.from('subscriptions')
      .select('starts_at, plan:subscription_plans(price_ars, billing_period)');

    (subs ?? []).forEach((s: any) => {
      const start = new Date(s.starts_at);
      const monthKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
      if (!s.plan) return;
      // Para anual, prorrateamos al mes de compra (podríamos distribuir en 12 meses, pero mostrar cash real es más útil)
      const amount = s.plan.billing_period === 'monthly' ? s.plan.price_ars : s.plan.price_ars;
      bucketsMap[monthKey] = (bucketsMap[monthKey] ?? 0) + amount;
    });

    const buckets: Bucket[] = [];
    for (let m = months - 1; m >= 0; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('es-AR', { month: 'short' });
      buckets.push({ label, value: bucketsMap[key] ?? 0 });
    }
    setMonthlyRevenue(buckets);
  }

  // --- Distribución de suscripciones por plan ---
  async function loadPlanDistribution() {
    const { data: activeSubs } = await supabase.from('subscriptions')
      .select('plan:subscription_plans(role, billing_period)')
      .in('status', ['active', 'trial']);

    const counts: Record<string, number> = {};
    (activeSubs ?? []).forEach((s: any) => {
      if (!s.plan) return;
      const key = `${s.plan.role}_${s.plan.billing_period}`;
      counts[key] = (counts[key] ?? 0) + 1;
    });

    const roleLabel = (r: string) => r === 'player' ? '🎾 Jugador' : r === 'coach' ? '🎓 Profe' : '🏟️ Complejo';
    const colors = ['#D8F646', '#8FA82C', '#75AADB', '#4285F4', '#FBBC05', '#EA4335'];
    const dist = Object.entries(counts).map(([k, v], i) => {
      const [role, period] = k.split('_');
      return {
        label: `${roleLabel(role)} ${period === 'monthly' ? '(mes)' : '(año)'}`,
        value: v,
        color: colors[i % colors.length]
      };
    });
    setPlanDist(dist);
  }

  // --- Top 10 complejos por reservas y profes por sesiones ---
  async function loadTops() {
    const now = Date.now();
    const d30 = new Date(now - 30 * 24 * 3600 * 1000).toISOString();

    // Reservas por complejo (últimos 30 días)
    const { data: bookings } = await supabase.from('bookings')
      .select('complex_id, complex:complexes(name)')
      .gte('created_at', d30);
    const cxCounts: Record<string, { name: string; n: number }> = {};
    (bookings ?? []).forEach((b: any) => {
      if (!b.complex_id) return;
      const key = b.complex_id;
      if (!cxCounts[key]) cxCounts[key] = { name: b.complex?.name ?? '—', n: 0 };
      cxCounts[key].n++;
    });
    setTopComplejos(
      Object.entries(cxCounts).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.n - a.n).slice(0, 10)
    );

    // Sesiones por profe (últimos 30 días) — asume tabla training_sessions
    const { data: sess } = await supabase.from('training_sessions')
      .select('coach_id, coach:profiles!coach_id(first_name, last_name)')
      .gte('created_at', d30);
    const coachCounts: Record<string, { name: string; n: number }> = {};
    (sess ?? []).forEach((s: any) => {
      if (!s.coach_id) return;
      const key = s.coach_id;
      const nm = s.coach ? `${s.coach.first_name} ${s.coach.last_name}` : '—';
      if (!coachCounts[key]) coachCounts[key] = { name: nm, n: 0 };
      coachCounts[key].n++;
    });
    setTopProfes(
      Object.entries(coachCounts).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.n - a.n).slice(0, 10)
    );
  }

  if (loading) return <main className="p-8 text-white/60">Cargando estadísticas…</main>;

  return (
    <main className="min-h-dvh max-w-5xl mx-auto px-5 py-8">
      <Link href="/admin" className="text-white/60 text-sm font-bold">← Volver al admin</Link>
      <h1 className="font-display font-black text-3xl mt-3">Estadísticas</h1>
      <p className="text-white/50 text-sm mt-1">Tendencias y análisis de la plataforma.</p>

      {/* Signups semanales por rol */}
      <section className="mt-8 card !p-5">
        <p className="font-display font-black text-ball text-sm mb-3">SIGNUPS SEMANALES (últimas 12 semanas)</p>
        <div className="space-y-4">
          <ChartBlock title="🎾 Jugadores" data={weekly.players} color={BALL} />
          <ChartBlock title="🎓 Entrenadores" data={weekly.coaches} color="#75AADB" />
          <ChartBlock title="🏟️ Complejos" data={weekly.complexes} color="#FBBC05" />
        </div>
      </section>

      {/* Ingresos mensuales */}
      <section className="mt-6 card !p-5">
        <p className="font-display font-black text-ball text-sm mb-3">INGRESOS POR MES (ARS · últimos 6 meses)</p>
        <ChartBlock data={monthlyRevenue} color={BALL} formatValue={v => `$${v.toLocaleString('es-AR')}`} />
      </section>

      {/* Distribución de planes */}
      <section className="mt-6 card !p-5">
        <p className="font-display font-black text-ball text-sm mb-3">SUSCRIPCIONES ACTIVAS POR PLAN</p>
        {planDist.length === 0 ? (
          <p className="text-white/40 text-sm">Todavía no hay suscripciones activas.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4 items-center">
            <div className="flex justify-center">
              <DonutChart
                segments={planDist.map(d => ({ label: d.label, value: d.value, color: d.color }))}
                size={200}
                thickness={35}
                centerLabel={String(planDist.reduce((s, d) => s + d.value, 0))}
                centerSub="total"
              />
            </div>
            <ChartLegend segments={planDist.map(d => ({ label: d.label, value: d.value, color: d.color }))} />
          </div>
        )}
      </section>

      {/* Top 10 */}
      <section className="mt-6 grid md:grid-cols-2 gap-4">
        <div className="card !p-5">
          <p className="font-display font-black text-ball text-sm mb-3">🏟️ TOP COMPLEJOS (30d)</p>
          {topComplejos.length === 0 ? (
            <p className="text-white/40 text-sm">Sin reservas en los últimos 30 días.</p>
          ) : (
            <div className="space-y-1">
              {topComplejos.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3 py-1.5 border-b border-white/5 last:border-0">
                  <span className="w-6 text-center text-ball font-black">{i + 1}</span>
                  <span className="flex-1 text-sm truncate">{c.name}</span>
                  <span className="text-white/60 text-xs font-bold">{c.n} reservas</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card !p-5">
          <p className="font-display font-black text-ball text-sm mb-3">🎓 TOP PROFES (30d)</p>
          {topProfes.length === 0 ? (
            <p className="text-white/40 text-sm">Sin sesiones en los últimos 30 días.</p>
          ) : (
            <div className="space-y-1">
              {topProfes.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 py-1.5 border-b border-white/5 last:border-0">
                  <span className="w-6 text-center text-ball font-black">{i + 1}</span>
                  <span className="flex-1 text-sm truncate">{p.name}</span>
                  <span className="text-white/60 text-xs font-bold">{p.n} sesiones</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

// Bloque de barras horizontal reutilizable
function ChartBlock({ title, data, color, formatValue }: {
  title?: string; data: Bucket[]; color: string;
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <div>
      {title && <p className="text-white/60 text-xs font-bold mb-2">{title}</p>}
      <div className="flex items-end gap-1 h-32">
        {data.map((d, i) => {
          const h = (d.value / max) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <div className="w-full flex items-end justify-center" style={{ height: '100%' }}>
                <div
                  className="w-full rounded-t transition-all"
                  style={{ height: `${Math.max(3, h)}%`, background: color, minHeight: 3 }}
                  title={`${d.label}: ${formatValue ? formatValue(d.value) : d.value}`}
                />
              </div>
              <p className="text-[9px] text-white/40 font-mono truncate w-full text-center">{d.label}</p>
              <p className="text-[10px] text-white/70 font-black leading-none">
                {formatValue ? formatValue(d.value) : d.value}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
