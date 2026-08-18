'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import BackButton from '@/components/BackButton';
import PremiumGate from '@/components/PremiumGate';
import VerifiedBadge from '@/components/VerifiedBadge';

// /complejo/crm — Hub del CRM del complejo (POS + Productos + Clientes + Ventas)
// Todo bloqueado detrás de Premium.
export default function CrmHub() {
  const [cx, setCx] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ products: 0, clients: 0, salesToday: 0, incomeToday: 0 });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setLoading(false);
      const { data: complex } = await supabase.from('complexes').select('*').eq('owner_id', user.id).maybeSingle();
      setCx(complex);
      if (!complex?.is_premium) return setLoading(false);

      // Stats rápidos
      const today0 = new Date();
      today0.setHours(0, 0, 0, 0);
      const [{ count: pc }, { count: cc }, { data: sales }] = await Promise.all([
        supabase.from('pos_products').select('*', { count: 'exact', head: true }).eq('complex_id', complex.id).eq('active', true),
        supabase.from('pos_clients').select('*', { count: 'exact', head: true }).eq('complex_id', complex.id),
        supabase.from('pos_sales').select('total').eq('complex_id', complex.id).eq('status', 'completada').gte('created_at', today0.toISOString())
      ]);

      const income = (sales ?? []).reduce((sum, s: any) => sum + (s.total ?? 0), 0);
      setStats({
        products: pc ?? 0,
        clients: cc ?? 0,
        salesToday: (sales ?? []).length,
        incomeToday: income
      });
      setLoading(false);
    })();
  }, []);

  if (loading) return <main className="p-8 text-white/60">Cargando…</main>;
  if (!cx) return <main className="p-8 text-white/60">Sin complejo</main>;

  if (!cx.is_premium) return (
    <main className="min-h-dvh max-w-3xl mx-auto px-5 py-8">
      <BackButton fallbackHref="/complejo/mas" label="Más" />
      <h1 className="font-display font-black text-3xl mt-4 mb-6">CRM del complejo</h1>
      <PremiumGate isPremium={false} feature="financial_reports">
        <div />
      </PremiumGate>
    </main>
  );

  return (
    <main className="min-h-dvh max-w-4xl mx-auto px-5 py-8">
      <BackButton fallbackHref="/complejo/mas" label="Más" />
      <h1 className="font-display font-black text-3xl mt-4 flex items-center gap-2">
        CRM <VerifiedBadge show size="md" />
      </h1>
      <p className="text-white/60 text-sm mt-1">Ventas, productos, clientes y punto de venta.</p>

      {/* KPIs de hoy */}
      <section className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-2">
        <MiniKpi label="Ventas hoy" value={String(stats.salesToday)} />
        <MiniKpi label="$ hoy" value={`$${stats.incomeToday.toLocaleString('es-AR')}`} />
        <MiniKpi label="Productos" value={String(stats.products)} />
        <MiniKpi label="Clientes" value={String(stats.clients)} />
      </section>

      {/* Botón grande POS */}
      <Link href="/complejo/crm/pos"
        className="mt-6 block bg-ball text-courtdark rounded-2xl p-6 text-center hover:scale-[1.01] transition">
        <p className="font-display font-black text-3xl">🛒 ABRIR CAJA</p>
        <p className="font-semibold text-sm mt-1 opacity-80">Punto de venta rápido</p>
      </Link>

      {/* Módulos */}
      <section className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
        <ModuleCard href="/complejo/crm/productos" emoji="📦" title="Productos" desc="ABM stock, precios, categorías" />
        <ModuleCard href="/complejo/crm/clientes" emoji="👥" title="Clientes" desc="Base de datos + historial" />
        <ModuleCard href="/complejo/crm/ventas" emoji="🧾" title="Ventas" desc="Historial + reportes" />
      </section>

      <div className="mt-6 text-white/40 text-xs">
        <p className="mb-1">Próximas funciones (en desarrollo):</p>
        <p>• Escaneo de códigos EAN con cámara · Impresión de etiquetas · Descuentos por forma de pago · Compras con costo unitario · Gastos mensuales · Rentabilidad proyectada</p>
      </div>
    </main>
  );
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card !p-3">
      <p className="text-white/50 text-[10px] font-bold uppercase">{label}</p>
      <p className="font-display font-black text-xl text-ball mt-1 leading-none truncate">{value}</p>
    </div>
  );
}

function ModuleCard({ href, emoji, title, desc }: { href: string; emoji: string; title: string; desc: string }) {
  return (
    <Link href={href} className="card !p-4 hover:bg-white/5 transition">
      <p className="text-3xl">{emoji}</p>
      <p className="font-display font-black text-lg mt-2">{title}</p>
      <p className="text-white/50 text-xs mt-1">{desc}</p>
    </Link>
  );
}
