'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Brand from '@/components/Brand';
import VerifiedBadge from '@/components/VerifiedBadge';
import { FREE_FEATURES, PREMIUM_FEATURES } from '@/lib/plan-features';

// /planes — Página pública con los planes disponibles.
// Al clickear "Suscribirme" el usuario:
//   1. Si no está logueado → va a /login
//   2. Si está logueado → llamada a /api/mp/create-subscription y redirect a MP

type Plan = {
  id: string;
  role: 'player' | 'coach' | 'complex_admin';
  billing_period: 'monthly' | 'yearly';
  price_ars: number;
  active: boolean;
  features: string[];
};

const ROLE_INFO = {
  player: { title: 'Jugador', plural: 'Jugadores', emoji: '🎾' },
  coach: { title: 'Entrenador', plural: 'Entrenadores', emoji: '🎓' },
  complex_admin: { title: 'Complejo', plural: 'Complejos', emoji: '🏟️' }
};

export default function Planes() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [userRole, setUserRole] = useState<Plan['role'] | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase.from('subscription_plans')
        .select('*').eq('active', true).order('role').order('billing_period');
      setPlans((p as any) ?? []);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email ?? null);
        const { data: prof } = await supabase.from('profiles')
          .select('role, is_premium').eq('id', user.id).maybeSingle();
        setUserRole(prof?.role ?? null);
        setIsPremium(!!prof?.is_premium);
      }
      setLoading(false);
    })();
  }, []);

  // Click en "Suscribirme": si no está logueado va a login, sino redirige
  // directo a MP. Con Preapproval Plans, MP acepta cualquier cuenta MP —
  // no valida email — así que no hace falta el modal de confirmación.
  async function subscribe(plan: Plan) {
    setError('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login?next=/planes');
      return;
    }
    setBusy(plan.id);
    try {
      const res = await fetch('/api/mp/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al crear suscripción');
      window.location.href = data.init_point;
    } catch (e: any) {
      setError(e.message);
      setBusy(null);
    }
  }

  if (loading) return <main className="p-8 text-white/60">Cargando planes…</main>;

  // Agrupar por rol
  const byRole: Record<string, Plan[]> = {};
  plans.forEach(p => { (byRole[p.role] ||= []).push(p); });

  return (
    <main className="min-h-dvh bg-[#0B0F16] text-white">
      {/* Header */}
      <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link href="/"><Brand variant="inline" size={28} /></Link>
        <Link href="/mi-suscripcion" className="text-white/60 text-sm font-bold hover:text-white">
          Mi suscripción →
        </Link>
      </div>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-4 pb-10 text-center">
        <p className="text-ball text-xs font-black tracking-widest">SUMATE A</p>
        <h1 className="font-display font-black text-4xl md:text-6xl mt-2 leading-tight">
          NarvoQ Verificado <VerifiedBadge show size="xl" />
        </h1>
        <p className="text-white/70 text-base md:text-lg mt-4 max-w-2xl mx-auto">
          Elevá tu juego con features premium. Cancelás cuando quieras, sin letra chica.
        </p>
        {isPremium && (
          <div className="mt-6 inline-flex items-center gap-2 bg-ball/15 border border-ball/40 rounded-full px-5 py-2">
            <VerifiedBadge show size="md" />
            <span className="font-black text-sm">Ya sos NarvoQ Verificado</span>
          </div>
        )}
      </section>

      {/* Planes por rol */}
      <section className="max-w-6xl mx-auto px-6 pb-16 space-y-10">
        {(['player', 'coach', 'complex_admin'] as const).map(role => {
          const list = byRole[role];
          if (!list || list.length === 0) return null;
          const roleInfo = ROLE_INFO[role];
          const isCurrentRole = userRole === role;

          return (
            <div key={role}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-4xl">{roleInfo.emoji}</span>
                <div>
                  <h2 className="font-display font-black text-2xl md:text-3xl">
                    Para {roleInfo.plural.toLowerCase()}
                  </h2>
                  {isCurrentRole && <p className="text-ball text-xs font-black">TU ROL</p>}
                </div>
              </div>
              {/* Comparativa Free vs Premium */}
              <div className="card !p-5 mb-4 bg-white/[0.03]">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-white/60 text-xs font-black uppercase tracking-widest mb-3">Free — Gratis</p>
                    <ul className="space-y-1.5 text-sm">
                      {FREE_FEATURES[role].map((f, i) => (
                        <li key={i} className="flex gap-2 items-start">
                          <span className="text-white/50 font-black shrink-0">✓</span>
                          <span className="text-white/70">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-ball text-xs font-black uppercase tracking-widest mb-3">Premium — Todo lo del Free +</p>
                    <ul className="space-y-1.5 text-sm">
                      {PREMIUM_FEATURES[role].map((f, i) => (
                        <li key={i} className="flex gap-2 items-start">
                          <span className="text-ball font-black shrink-0">★</span>
                          <span className="text-white">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {list.map(plan => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    yourRole={userRole === plan.role}
                    busy={busy === plan.id}
                    onSubscribe={() => subscribe(plan)}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {error && (
          <div className="max-w-md mx-auto card !p-4 border border-red-500/40 bg-red-500/10">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 pb-16">
        <h3 className="font-display font-black text-xl mb-4 text-ball">Preguntas comunes</h3>
        <div className="space-y-3 text-sm">
          <FaqItem q="¿Cómo se cobra?"
            a="Suscripción automática con Mercado Pago. Podés pagar con tarjeta, débito, o dinero en cuenta MP." />
          <FaqItem q="¿Puedo cancelar cuándo quiera?"
            a="Sí. Cancelás desde 'Mi suscripción' y mantenés los beneficios premium hasta la fecha de vencimiento." />
          <FaqItem q="¿Qué pasa si falla el cobro?"
            a="MP reintenta automáticamente. Si sigue fallando después de varios intentos, tu cuenta vuelve a Free." />
          <FaqItem q="¿El plan anual tiene descuento?"
            a="Sí, pagando anual ahorrás el equivalente a 2 meses (16% off)." />
        </div>
      </section>

    </main>
  );
}

function PlanCard({ plan, yourRole, busy, onSubscribe }: {
  plan: Plan;
  yourRole: boolean;
  busy: boolean;
  onSubscribe: () => void;
}) {
  const isYearly = plan.billing_period === 'yearly';
  const monthlyPrice = isYearly ? Math.round(plan.price_ars / 12) : plan.price_ars;

  return (
    <div className={`card !p-6 border ${isYearly ? 'border-ball bg-gradient-to-br from-ball/10 to-transparent' : 'border-white/10'} relative`}>
      {isYearly && (
        <span className="absolute -top-3 right-4 bg-ball text-courtdark text-[10px] font-black uppercase px-3 py-1 rounded-full">
          16% off · Más elegido
        </span>
      )}
      <p className="text-white/60 text-xs font-black uppercase tracking-widest">
        {isYearly ? 'Anual' : 'Mensual'}
      </p>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="font-display font-black text-4xl md:text-5xl">
          ${monthlyPrice.toLocaleString('es-AR')}
        </p>
        <span className="text-white/50 text-sm">/mes</span>
      </div>
      {isYearly && (
        <p className="text-white/50 text-xs mt-1">
          ${plan.price_ars.toLocaleString('es-AR')} pagados una vez al año
        </p>
      )}

      <p className="text-white/60 text-xs mt-3">
        Todos los beneficios Premium listados arriba.
      </p>

      <button
        onClick={onSubscribe}
        disabled={busy || !yourRole}
        className={`w-full mt-6 py-4 rounded-2xl font-display font-black text-base transition
          ${isYearly ? 'bg-ball text-courtdark' : 'bg-white/10 border border-white/20 text-white'}
          disabled:opacity-50 active:scale-[0.98]`}>
        {busy ? 'Redirigiendo a MP…' : !yourRole ? 'Este plan no es para tu rol' : `Suscribirme`}
      </button>

      {!yourRole && (
        <p className="text-white/40 text-xs text-center mt-2">
          Iniciá sesión con una cuenta de {ROLE_INFO[plan.role].title.toLowerCase()}
        </p>
      )}
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="card !p-4">
      <summary className="font-bold cursor-pointer text-white">{q}</summary>
      <p className="text-white/70 mt-2 leading-snug">{a}</p>
    </details>
  );
}
