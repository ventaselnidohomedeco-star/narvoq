'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import BackButton from '@/components/BackButton';
import PremiumGate from '@/components/PremiumGate';

type Sale = {
  id: string;
  client_id: string | null;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: string;
  paid_amount: number;
  status: string;
  notes: string | null;
  created_at: string;
  client?: { name: string } | null;
  items?: any[];
};

type Booking = {
  id: string;
  starts_at: string;
  price: number;
  payment_status: string;
  status: string;
  court?: { name: string };
  player?: { first_name: string; last_name: string };
};

type Period = 'hoy' | '7d' | '30d';

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: '💵 Efectivo', transferencia: '🏦 Transferencia',
  debito: '💳 Débito', credito: '💳 Crédito',
  mp: '📱 MP', 'seña': '⏱ Seña'
};

export default function VentasPage() {
  const [cx, setCx] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('hoy');
  const [sales, setSales] = useState<Sale[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setLoading(false);
      const { data: complex } = await supabase.from('complexes').select('*, courts(id)').eq('owner_id', user.id).maybeSingle();
      setCx(complex);
      if (!complex?.is_premium) return setLoading(false);

      const days = period === 'hoy' ? 0 : period === '7d' ? 7 : 30;
      const since = period === 'hoy'
        ? new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
        : new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

      // Ventas del POS
      const { data: ss } = await supabase.from('pos_sales')
        .select('*, client:pos_clients(name), items:pos_sale_items(product_name, qty, unit_price, subtotal)')
        .eq('complex_id', complex.id)
        .gte('created_at', since)
        .order('created_at', { ascending: false });
      setSales((ss as any) ?? []);

      // Reservas cobradas (unificado)
      const courtIds = (complex.courts ?? []).map((c: any) => c.id);
      if (courtIds.length > 0) {
        const { data: bks } = await supabase.from('bookings')
          .select('id, starts_at, price, payment_status, status, court:courts(name), player:profiles!player_id(first_name, last_name)')
          .in('court_id', courtIds)
          .neq('status', 'cancelada')
          .gte('starts_at', since)
          .order('starts_at', { ascending: false });
        setBookings((bks as any) ?? []);
      }
      setLoading(false);
    })();
  }, [period]);

  // Métricas
  const stats = useMemo(() => {
    const salesTotal = sales.reduce((sum, s) => sum + (s.status === 'completada' ? s.total : s.paid_amount), 0);
    const bookingsTotal = bookings.reduce((sum, b) => sum + (b.payment_status === 'pagado' ? (b.price ?? 0) : 0), 0);
    const bookingsPending = bookings.reduce((sum, b) => sum + (b.payment_status !== 'pagado' && b.payment_status !== 'no_aplica' ? (b.price ?? 0) : 0), 0);
    const pending = sales.reduce((sum, s) => sum + (s.status === 'pendiente' ? (s.total - s.paid_amount) : 0), 0);
    return {
      salesCount: sales.length,
      salesTotal,
      bookingsCount: bookings.length,
      bookingsTotal,
      pending: pending + bookingsPending,
      grandTotal: salesTotal + bookingsTotal
    };
  }, [sales, bookings]);

  if (loading) return <main className="p-8 text-white/60">Cargando…</main>;

  if (!cx?.is_premium) return (
    <main className="min-h-dvh p-6">
      <BackButton fallbackHref="/complejo/crm" label="CRM" />
      <h1 className="font-display font-black text-3xl mt-4 mb-6">Historial de ventas</h1>
      <PremiumGate isPremium={false} feature="financial_reports"><div /></PremiumGate>
    </main>
  );

  return (
    <main className="min-h-dvh max-w-5xl mx-auto px-5 py-6">
      <BackButton fallbackHref="/complejo/crm" label="CRM" />

      <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-black text-3xl">Ventas</h1>
          <p className="text-white/50 text-sm mt-1">POS + reservas de canchas unificado</p>
        </div>
        <div className="flex gap-2">
          {(['hoy', '7d', '30d'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-2 rounded-lg text-sm font-black ${period === p ? 'bg-ball text-courtdark' : 'bg-white/5 text-white/70 border border-white/10'}`}>
              {p === 'hoy' ? 'Hoy' : p === '7d' ? '7 días' : '30 días'}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <section className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-2">
        <Kpi label="Total facturado" value={`$${stats.grandTotal.toLocaleString('es-AR')}`} big />
        <Kpi label="POS" value={`$${stats.salesTotal.toLocaleString('es-AR')}`} sub={`${stats.salesCount} ventas`} />
        <Kpi label="Reservas" value={`$${stats.bookingsTotal.toLocaleString('es-AR')}`} sub={`${stats.bookingsCount} turnos`} />
        <Kpi label="Pendientes de cobro" value={`$${stats.pending.toLocaleString('es-AR')}`} tone={stats.pending > 0 ? 'warn' : 'ok'} />
      </section>

      {/* Ventas POS */}
      <section className="mt-6">
        <h2 className="text-ball text-xs font-black tracking-widest mb-2">VENTAS POS ({sales.length})</h2>
        {sales.length === 0 ? (
          <p className="text-white/40 text-sm">Sin ventas del POS en este período.</p>
        ) : (
          <div className="space-y-2">
            {sales.map(s => (
              <div key={s.id} className={`card !p-3 ${s.status === 'pendiente' ? 'border border-orange-500/30' : ''}`}>
                <button onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                  className="w-full text-left flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">
                      {s.client?.name ?? 'Sin cliente'}
                      {s.status === 'pendiente' && (
                        <span className="ml-2 text-[10px] px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 font-black">PENDIENTE</span>
                      )}
                    </p>
                    <p className="text-white/50 text-xs">
                      {new Date(s.created_at).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      {' · '}{PAYMENT_LABELS[s.payment_method] ?? s.payment_method}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-display font-black text-ball text-lg">${s.total.toLocaleString('es-AR')}</p>
                    {s.status === 'pendiente' && (
                      <p className="text-orange-300 text-[10px]">
                        pagó ${s.paid_amount.toLocaleString('es-AR')} · falta ${(s.total - s.paid_amount).toLocaleString('es-AR')}
                      </p>
                    )}
                  </div>
                  <span className="text-white/40 shrink-0">{expandedId === s.id ? '▲' : '▼'}</span>
                </button>

                {expandedId === s.id && (
                  <div className="mt-3 pt-3 border-t border-white/10 space-y-1">
                    {s.items?.map((it: any, i: number) => (
                      <div key={i} className="flex items-center text-xs">
                        <span className="flex-1 text-white/80">{it.qty}× {it.product_name}</span>
                        <span className="text-white/50">${it.unit_price.toLocaleString('es-AR')}</span>
                        <span className="w-20 text-right font-bold">${it.subtotal.toLocaleString('es-AR')}</span>
                      </div>
                    ))}
                    {s.notes && <p className="text-white/50 text-xs mt-2">📝 {s.notes}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Reservas */}
      <section className="mt-6">
        <h2 className="text-ball text-xs font-black tracking-widest mb-2">RESERVAS DE CANCHAS ({bookings.length})</h2>
        {bookings.length === 0 ? (
          <p className="text-white/40 text-sm">Sin reservas en este período.</p>
        ) : (
          <div className="space-y-2">
            {bookings.slice(0, 20).map(b => (
              <div key={b.id} className="card !p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">
                    {b.court?.name ?? 'Cancha'} · {b.player ? `${b.player.first_name} ${b.player.last_name}` : 'Sin jugador'}
                  </p>
                  <p className="text-white/50 text-xs">
                    {new Date(b.starts_at).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display font-black text-ball">${(b.price ?? 0).toLocaleString('es-AR')}</p>
                  <p className={`text-[10px] font-black uppercase ${b.payment_status === 'pagado' ? 'text-ball' : 'text-orange-300'}`}>
                    {b.payment_status === 'pagado' ? 'pagado' : (b.payment_status ?? 'pendiente')}
                  </p>
                </div>
              </div>
            ))}
            {bookings.length > 20 && (
              <p className="text-white/40 text-center text-xs mt-2">
                +{bookings.length - 20} reservas más. Ver todo en <Link href="/complejo/dashboard" className="text-ball underline">Dashboard</Link>
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

function Kpi({ label, value, sub, tone, big }: { label: string; value: string; sub?: string; tone?: 'ok' | 'warn'; big?: boolean }) {
  return (
    <div className={`card !p-3 ${big ? 'md:col-span-1' : ''}`}>
      <p className="text-white/50 text-[10px] font-bold uppercase">{label}</p>
      <p className={`font-display font-black mt-1 leading-none ${big ? 'text-2xl md:text-3xl' : 'text-xl'} ${tone === 'warn' && (value !== '$0') ? 'text-orange-300' : 'text-ball'}`}>{value}</p>
      {sub && <p className="text-white/40 text-[10px] mt-1">{sub}</p>}
    </div>
  );
}
