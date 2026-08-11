'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

// Panel admin: editar precios de planes + ver suscripciones activas.
// Solo super_admin (el middleware ya filtra /admin/*).

type Plan = {
  id: string;
  role: 'player' | 'coach' | 'complex_admin';
  billing_period: 'monthly' | 'yearly';
  price_ars: number;
  active: boolean;
  features: string[];
};

type Sub = {
  id: string;
  user_id: string | null;
  complex_id: string | null;
  plan_id: string;
  status: string;
  starts_at: string;
  expires_at: string;
  created_at: string;
};

const ROLE_LABEL: Record<Plan['role'], string> = {
  player: '🎾 Jugador',
  coach: '🎓 Entrenador',
  complex_admin: '🏟️ Complejo'
};

export default function AdminPlanes() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  async function load() {
    setLoading(true);
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.from('subscription_plans').select('*').order('role').order('billing_period'),
      supabase.from('subscriptions').select('*').order('created_at', { ascending: false }).limit(50)
    ]);
    setPlans((p as any) ?? []);
    setSubs((s as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function savePlan(plan: Plan) {
    setMsg('');
    const { error } = await supabase.from('subscription_plans').update({
      price_ars: plan.price_ars,
      active: plan.active,
      features: plan.features
    }).eq('id', plan.id);
    if (error) { setMsg(`Error: ${error.message}`); return; }
    setMsg(`✓ Guardado ${ROLE_LABEL[plan.role]} ${plan.billing_period}`);
  }

  if (loading) return <main className="p-8 text-white/60">Cargando planes…</main>;

  // Agrupar por rol
  const byRole: Record<string, Plan[]> = {};
  plans.forEach(p => { (byRole[p.role] ||= []).push(p); });

  const activeSubs = subs.filter(s => s.status === 'active' || s.status === 'trial').length;
  const totalMonthlyRevenue = subs
    .filter(s => s.status === 'active' || s.status === 'trial')
    .reduce((sum, s) => {
      const plan = plans.find(p => p.id === s.plan_id);
      if (!plan) return sum;
      return sum + (plan.billing_period === 'monthly' ? plan.price_ars : plan.price_ars / 12);
    }, 0);

  return (
    <main className="min-h-dvh max-w-4xl mx-auto px-5 py-8">
      <Link href="/admin" className="text-white/60 text-sm font-bold">← Volver al admin</Link>
      <h1 className="font-display font-black text-3xl mt-3">Planes y suscripciones</h1>

      {/* Stats rápidas */}
      <section className="mt-6 grid grid-cols-3 gap-3">
        <StatCard n={String(activeSubs)} l="Suscripciones activas" />
        <StatCard n={`$${Math.round(totalMonthlyRevenue).toLocaleString('es-AR')}`} l="MRR estimado (ARS)" />
        <StatCard n={String(plans.filter(p => p.active).length)} l="Planes activos" />
      </section>

      {/* Editor de planes por rol */}
      <section className="mt-8 space-y-6">
        <h2 className="font-display font-black text-xl text-ball">Precios y features</h2>
        {(['player', 'coach', 'complex_admin'] as const).map(role => (
          <div key={role} className="card !p-5 space-y-4">
            <p className="font-display font-black text-lg">{ROLE_LABEL[role]}</p>
            <div className="grid md:grid-cols-2 gap-4">
              {byRole[role]?.map(plan => (
                <PlanEditor key={plan.id} plan={plan} onSave={savePlan} />
              ))}
            </div>
          </div>
        ))}
        {msg && <p className="text-ball text-sm">{msg}</p>}
      </section>

      {/* Suscripciones recientes */}
      <section className="mt-10">
        <h2 className="font-display font-black text-xl text-ball mb-3">Últimas suscripciones</h2>
        {subs.length === 0 ? (
          <p className="text-white/50 text-sm">Todavía no hay suscripciones. Se van a listar acá cuando activemos MP.</p>
        ) : (
          <div className="space-y-2">
            {subs.map(s => {
              const plan = plans.find(p => p.id === s.plan_id);
              const statusColor = s.status === 'active' ? 'text-ball' :
                s.status === 'trial' ? 'text-yellow-300' :
                s.status === 'past_due' ? 'text-orange-400' :
                'text-red-400';
              return (
                <div key={s.id} className="card !p-3 flex items-center justify-between text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">
                      {plan ? `${ROLE_LABEL[plan.role]} ${plan.billing_period === 'monthly' ? '(mensual)' : '(anual)'}` : 'Plan desconocido'}
                    </p>
                    <p className="text-white/50 text-xs">
                      {s.user_id ? `Usuario: ${s.user_id.slice(0, 8)}…` : `Complejo: ${s.complex_id?.slice(0, 8)}…`}
                      {' · vence: '}{new Date(s.expires_at).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                  <span className={`text-xs font-black uppercase ${statusColor}`}>{s.status}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function StatCard({ n, l }: { n: string; l: string }) {
  return (
    <div className="card !p-4 text-center">
      <p className="font-display font-black text-2xl text-ball leading-none">{n}</p>
      <p className="text-white/50 text-[10px] font-bold uppercase mt-2">{l}</p>
    </div>
  );
}

function PlanEditor({ plan, onSave }: { plan: Plan; onSave: (p: Plan) => Promise<void> }) {
  const [price, setPrice] = useState(String(plan.price_ars));
  const [active, setActive] = useState(plan.active);
  const [featuresText, setFeaturesText] = useState((plan.features ?? []).join('\n'));
  const [saving, setSaving] = useState(false);

  async function guardar() {
    setSaving(true);
    await onSave({
      ...plan,
      price_ars: Number(price) || 0,
      active,
      features: featuresText.split('\n').map(l => l.trim()).filter(Boolean)
    });
    setSaving(false);
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-display font-black text-white/90">
          {plan.billing_period === 'monthly' ? 'Mensual' : 'Anual'}
        </p>
        <label className="flex items-center gap-2 text-xs font-bold">
          <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)}
            className="w-4 h-4 accent-ball" />
          <span className={active ? 'text-ball' : 'text-white/40'}>
            {active ? 'Visible' : 'Oculto'}
          </span>
        </label>
      </div>

      <div>
        <label className="text-white/60 text-xs font-bold">Precio (ARS)</label>
        <input
          type="number" value={price} onChange={e => setPrice(e.target.value)}
          className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-black text-lg" />
      </div>

      <div>
        <label className="text-white/60 text-xs font-bold">Features (una por línea)</label>
        <textarea
          value={featuresText} onChange={e => setFeaturesText(e.target.value)}
          rows={5}
          className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono" />
      </div>

      <button
        onClick={guardar} disabled={saving}
        className="w-full py-2 rounded-lg bg-ball text-courtdark font-black text-sm disabled:opacity-50">
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
    </div>
  );
}
