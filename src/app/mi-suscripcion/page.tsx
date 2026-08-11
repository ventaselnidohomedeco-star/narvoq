'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Brand from '@/components/Brand';
import VerifiedBadge from '@/components/VerifiedBadge';

// /mi-suscripcion — Vista del usuario para ver su plan actual, próxima
// renovación, historial y cancelar.

type Sub = {
  id: string;
  status: string;
  starts_at: string;
  expires_at: string;
  cancelled_at: string | null;
  mp_preapproval_id: string | null;
  plan: {
    role: string;
    billing_period: string;
    price_ars: number;
    features: string[];
  } | null;
};

export default function MiSuscripcion() {
  const params = useSearchParams();
  const justSubscribed = params.get('ref');   // viene de MP back_url

  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('subscriptions')
        .select(`*, plan:subscription_plans(role, billing_period, price_ars, features)`)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setSubs((data as any) ?? []);
      setLoading(false);
    })();
  }, []);

  async function cancel(sub: Sub) {
    if (!confirm('¿Cancelar tu suscripción? Vas a mantener los beneficios premium hasta la fecha de vencimiento. Después la cuenta vuelve a Free.')) return;
    setCancelling(sub.id); setMsg('');
    try {
      const res = await fetch('/api/mp/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: sub.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al cancelar');
      setMsg('✓ Suscripción cancelada. Tus beneficios siguen activos hasta el vencimiento.');
      // Recargar
      const { data: fresh } = await supabase.from('subscriptions')
        .select(`*, plan:subscription_plans(role, billing_period, price_ars, features)`)
        .order('created_at', { ascending: false });
      setSubs((fresh as any) ?? []);
    } catch (e: any) {
      setMsg(`Error: ${e.message}`);
    }
    setCancelling(null);
  }

  const active = subs.find(s => s.status === 'active' || s.status === 'trial');
  const pending = subs.find(s => s.status === 'pending');
  const history = subs.filter(s => s !== active && s !== pending);

  if (loading) return <main className="p-8 text-white/60">Cargando…</main>;

  return (
    <main className="min-h-dvh bg-[#0B0F16] text-white">
      <div className="max-w-2xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link href="/"><Brand variant="inline" size={26} /></Link>
        <Link href="/planes" className="text-ball text-sm font-bold">Ver planes →</Link>
      </div>

      <section className="max-w-2xl mx-auto px-6 pb-16">
        <h1 className="font-display font-black text-3xl">Mi suscripción</h1>

        {/* Aviso post-checkout */}
        {justSubscribed && (
          <div className="mt-5 card !p-4 border-2 border-ball/50 bg-ball/10">
            <p className="font-display font-black text-ball">🎉 ¡Suscripción creada!</p>
            <p className="text-white/70 text-sm mt-1">
              MP nos avisa cuando se apruebe el primer cobro (puede tardar unos minutos).
              Cuando esté todo listo, vas a ver el badge <VerifiedBadge show size="sm" /> en tu perfil.
            </p>
          </div>
        )}

        {msg && <p className="mt-4 text-ball text-sm">{msg}</p>}

        {/* Suscripción activa */}
        {active ? (
          <div className="mt-6 card !p-6 border-2 border-ball">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-ball text-xs font-black tracking-widest">ACTIVA</p>
                <p className="font-display font-black text-2xl mt-1">
                  NarvoQ Verificado <VerifiedBadge show size="lg" />
                </p>
                <p className="text-white/60 text-sm mt-1">
                  {active.plan?.billing_period === 'monthly' ? 'Plan mensual' : 'Plan anual'}
                  {' · '}${active.plan?.price_ars.toLocaleString('es-AR')}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-white/40 text-xs uppercase font-bold">Vence</p>
                <p className="mt-1 font-bold">{new Date(active.expires_at).toLocaleDateString('es-AR')}</p>
              </div>
              <div>
                <p className="text-white/40 text-xs uppercase font-bold">Desde</p>
                <p className="mt-1 font-bold">{new Date(active.starts_at).toLocaleDateString('es-AR')}</p>
              </div>
            </div>

            {active.plan?.features && active.plan.features.length > 0 && (
              <div className="mt-5 pt-4 border-t border-white/10">
                <p className="text-white/60 text-xs font-black uppercase mb-2">Beneficios incluidos</p>
                <ul className="space-y-1.5 text-sm">
                  {active.plan.features.map((f, i) => (
                    <li key={i} className="flex gap-2 items-start">
                      <span className="text-ball font-black">✓</span>
                      <span className="text-white/80">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {active.status !== 'cancelled' && (
              <button
                onClick={() => cancel(active)}
                disabled={cancelling === active.id}
                className="w-full mt-5 py-3 rounded-xl bg-red-500/10 border border-red-500/40 text-red-300 font-black text-sm disabled:opacity-50">
                {cancelling === active.id ? 'Cancelando…' : 'Cancelar suscripción'}
              </button>
            )}
          </div>
        ) : pending ? (
          <div className="mt-6 card !p-6 border-2 border-yellow-500/50 bg-yellow-500/5">
            <p className="text-yellow-300 text-xs font-black tracking-widest">PENDIENTE DE PAGO</p>
            <p className="font-display font-black text-xl mt-1">
              Esperando confirmación de Mercado Pago
            </p>
            <p className="text-white/60 text-sm mt-2">
              Ya creamos tu suscripción. Cuando MP confirme el primer cobro, se activa automáticamente.
            </p>
          </div>
        ) : (
          <div className="mt-6 card !p-6 text-center">
            <p className="text-white/60 mb-4">Todavía no tenés una suscripción activa.</p>
            <Link href="/planes" className="btn-ball inline-block">Ver planes →</Link>
          </div>
        )}

        {/* Historial */}
        {history.length > 0 && (
          <section className="mt-8">
            <h2 className="text-ball text-xs font-black tracking-widest mb-3">HISTORIAL</h2>
            <div className="space-y-2">
              {history.map(s => (
                <div key={s.id} className="card !p-3 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-bold">
                      {s.plan?.billing_period === 'monthly' ? 'Mensual' : 'Anual'}
                      {' · '}${s.plan?.price_ars.toLocaleString('es-AR')}
                    </p>
                    <p className="text-white/50 text-xs">
                      {new Date(s.starts_at).toLocaleDateString('es-AR')} → {new Date(s.expires_at).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                  <span className="text-white/40 text-xs font-black uppercase">{s.status}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
