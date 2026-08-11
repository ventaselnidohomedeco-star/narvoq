'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Brand from '@/components/Brand';
import VerifiedBadge from '@/components/VerifiedBadge';

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
  player: { title: 'Jugador', emoji: '🎾' },
  coach: { title: 'Entrenador', emoji: '🎓' },
  complex_admin: { title: 'Complejo', emoji: '🏟️' }
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
  // Modal de advertencia: pareja (plan, userEmail) cuando el usuario clickeó Suscribirme
  const [confirmPlan, setConfirmPlan] = useState<Plan | null>(null);

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

  // Click en "Suscribirme": si no está logueado va a login, sino abre modal
  // de advertencia con el email (para que verifique que su cuenta MP coincida).
  async function subscribe(plan: Plan) {
    setError('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login?next=/planes');
      return;
    }
    setConfirmPlan(plan);
  }

  // Después del modal: hace la llamada real a MP.
  async function doSubscribe(plan: Plan) {
    setBusy(plan.id); setError('');
    setConfirmPlan(null);
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
                    Para {roleInfo.title.toLowerCase()}s
                  </h2>
                  {isCurrentRole && <p className="text-ball text-xs font-black">TU ROL</p>}
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

      {/* Modal de advertencia antes de ir a MP */}
      {confirmPlan && userEmail && (
        <MpConfirmModal
          plan={confirmPlan}
          userEmail={userEmail}
          busy={busy === confirmPlan.id}
          onConfirm={() => doSubscribe(confirmPlan)}
          onCancel={() => setConfirmPlan(null)}
        />
      )}
    </main>
  );
}

// Modal que muestra el email del usuario y advierte que su cuenta MP debe
// tener el mismo email. Sin esto MP rechaza el pago con
// "Tu e-mail no coincide con el de la suscripción".
function MpConfirmModal({ plan, userEmail, busy, onConfirm, onCancel }: {
  plan: Plan; userEmail: string; busy: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  const isYearly = plan.billing_period === 'yearly';
  const roleLabel = plan.role === 'player' ? 'Jugador' : plan.role === 'coach' ? 'Entrenador' : 'Complejo';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      onClick={onCancel}>
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md bg-[#0F141D] border-t-2 sm:border-2 border-ball rounded-t-3xl sm:rounded-3xl overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-gradient-to-b from-ball/20 to-transparent">
          <p className="text-ball text-xs font-black tracking-widest">CONFIRMÁ TU EMAIL DE MP</p>
          <h3 className="font-display font-black text-2xl mt-2 leading-tight">
            Antes de pagar, revisá esto
          </h3>
        </div>

        {/* Body */}
        <div className="px-6 pb-5 space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-white/60 text-xs font-bold uppercase">Vas a suscribirte con este email:</p>
            <p className="font-display font-black text-lg mt-1 break-all">{userEmail}</p>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
            <p className="text-yellow-200 font-black text-sm">⚠️ Muy importante</p>
            <p className="text-white/85 text-sm mt-2 leading-snug">
              Tu cuenta de <b>Mercado Pago debe tener el mismo email</b> (<b className="text-ball">{userEmail}</b>).
              Si es distinto, MP no te va a dejar pagar.
            </p>
          </div>

          <div className="text-white/60 text-xs leading-snug">
            <p>💡 <b>¿No tenés cuenta de MP con ese email?</b></p>
            <a
              href="https://www.mercadopago.com.ar/registration"
              target="_blank" rel="noopener"
              className="text-ball font-bold underline mt-1 inline-block">
              Creá una gratis acá →
            </a>
            {' '}(usá el mismo email: <b>{userEmail}</b>)
          </div>

          <div className="pt-2 border-t border-white/10">
            <p className="text-white/60 text-xs">Suscripción:</p>
            <p className="font-display font-black">
              NarvoQ Verificado - {roleLabel} {isYearly ? 'Anual' : 'Mensual'}
              <span className="text-ball ml-2">${plan.price_ars.toLocaleString('es-AR')}</span>
            </p>
          </div>
        </div>

        {/* CTAs */}
        <div className="px-6 pb-6 space-y-2">
          <button
            onClick={onConfirm}
            disabled={busy}
            className="w-full bg-ball text-courtdark font-display font-black rounded-2xl py-4 text-base disabled:opacity-50 active:scale-[0.98]">
            {busy ? 'Redirigiendo a MP…' : `Sí, mi MP usa ${userEmail.length > 25 ? 'ese email' : userEmail}`}
          </button>
          <button
            onClick={onCancel}
            disabled={busy}
            className="w-full py-3 text-white/70 font-bold text-sm">
            Cancelar
          </button>
        </div>
      </div>
    </div>
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

      <ul className="mt-5 space-y-2">
        {(plan.features ?? []).map((f, i) => (
          <li key={i} className="flex gap-2 items-start text-sm">
            <span className="text-ball font-black shrink-0">✓</span>
            <span className="text-white/85">{f}</span>
          </li>
        ))}
      </ul>

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
