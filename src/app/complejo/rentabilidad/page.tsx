'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import PremiumGate from '@/components/PremiumGate';
import AdminPinGate from '@/components/AdminPinGate';

export default function RentabilidadPage() {
  return (
    <AdminPinGate label="la rentabilidad">
      <Rentabilidad />
    </AdminPinGate>
  );
}

function Rentabilidad() {
  const [cx, setCx] = useState<any>(null);
  const [periodo, setPeriodo] = useState<'semana' | 'mes'>('semana');
  const [porCancha, setPorCancha] = useState<any[]>([]);
  const [neto, setNeto] = useState({
    canchas: 0, buffet: 0, torneos: 0, socios: 0,
    ingresos: 0, gastos: 0, ganancia: 0,
    gastosByCat: [] as { category: string; total: number }[]
  });

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: complex } = await supabase.from('complexes')
      .select('*, courts(*)').eq('owner_id', user.id).single();
    if (!complex) return;
    setCx(complex);

    const dias = periodo === 'semana' ? 7 : 30;
    const desde = new Date(); desde.setDate(desde.getDate() - dias); desde.setHours(0, 0, 0, 0);
    const courtIds = complex.courts.filter((c: any) => c.active).map((c: any) => c.id);

    const { data: bks } = await supabase.from('bookings')
      .select('court_id, price, type, starts_at')
      .in('court_id', courtIds)
      .neq('status', 'cancelada')
      .gte('starts_at', desde.toISOString()).lte('starts_at', new Date().toISOString());

    // Slots totales por cancha en el período
    const [oh] = complex.open_time.split(':').map(Number);
    const [ch] = complex.close_time.split(':').map(Number);
    const horasDia = ((ch <= oh ? ch + 24 : ch) - oh);
    const slotsPorCanchaPorDia = Math.max(1, Math.floor(horasDia * 60 / complex.slot_minutes));
    const slotsTotalPorCancha = slotsPorCanchaPorDia * dias;

    const stats = complex.courts.filter((c: any) => c.active).map((c: any) => {
      const propios = (bks ?? []).filter((b: any) => b.court_id === c.id);
      const reservas = propios.filter((b: any) => b.type === 'reserva');
      return {
        court: c,
        turnos: reservas.length,
        bloqueos: propios.filter((b: any) => b.type === 'block').length,
        libres: Math.max(0, slotsTotalPorCancha - propios.length),
        plata: reservas.reduce((a: any, b: any) => a + Number(b.price ?? 0), 0),
        ocupacion: slotsTotalPorCancha ? Math.round(propios.length / slotsTotalPorCancha * 100) : 0
      };
    });
    setPorCancha(stats);

    // ---- Ganancia neta = ingresos totales del período − gastos ----
    const [{ data: ledger }, { data: pos }, { data: torneos }, { data: gastos }] = await Promise.all([
      supabase.from('player_ledger').select('amount').eq('complex_id', complex.id)
        .in('kind', ['seña_paid', 'restante_paid'])
        .gte('created_at', desde.toISOString()),
      supabase.from('pos_sales').select('total').eq('complex_id', complex.id)
        .gte('created_at', desde.toISOString()),
      supabase.from('tournaments').select('id, price').eq('complex_id', complex.id),
      supabase.from('expenses').select('amount, category').eq('complex_id', complex.id)
        .gte('spent_on', desde.toISOString().slice(0, 10))
    ]);
    const canchasI = (ledger ?? []).reduce((a: number, r: any) => a + Math.abs(Number(r.amount ?? 0)), 0);
    const buffetI = (pos ?? []).reduce((a: number, r: any) => a + Number(r.total ?? 0), 0);
    let torneosI = 0;
    if (torneos && torneos.length > 0) {
      const priceMap = new Map(torneos.map((t: any) => [t.id, Number(t.price) || 0]));
      const { data: pairs } = await supabase.from('tournament_pairs').select('tournament_id')
        .in('tournament_id', torneos.map((t: any) => t.id)).eq('status', 'aprobada')
        .gte('created_at', desde.toISOString());
      (pairs ?? []).forEach((p: any) => { torneosI += priceMap.get(p.tournament_id) ?? 0; });
    }
    const { data: mems } = await supabase.from('membership_members')
      .select('created_at, membership:memberships!inner(complex_id, price)')
      .eq('membership.complex_id', complex.id).eq('status', 'activa')
      .gte('created_at', desde.toISOString());
    const sociosI = (mems ?? []).reduce((a: number, r: any) => a + Number(r.membership?.price ?? 0), 0);

    const gastosTotal = (gastos ?? []).reduce((a: number, r: any) => a + Number(r.amount ?? 0), 0);
    const byCat = new Map<string, number>();
    (gastos ?? []).forEach((g: any) => byCat.set(g.category, (byCat.get(g.category) ?? 0) + Number(g.amount)));
    const ingresos = canchasI + buffetI + torneosI + sociosI;
    setNeto({
      canchas: canchasI, buffet: buffetI, torneos: torneosI, socios: sociosI,
      ingresos, gastos: gastosTotal, ganancia: ingresos - gastosTotal,
      gastosByCat: Array.from(byCat.entries()).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total)
    });
  }
  useEffect(() => { load(); }, [periodo]);

  const total = useMemo(() => porCancha.reduce((a, s) => ({
    turnos: a.turnos + s.turnos, plata: a.plata + s.plata, libres: a.libres + s.libres
  }), { turnos: 0, plata: 0, libres: 0 }), [porCancha]);

  if (!cx) return <main className="p-8 text-white/70">Cargando…</main>;

  // Gate premium: solo suscriptores ven la sección
  if (!cx.is_premium) return (
    <main className="px-5 py-10">
      <h1 className="font-display font-black text-2xl mb-6">Rentabilidad</h1>
      <PremiumGate isPremium={false} feature="financial_reports">
        <div />
      </PremiumGate>
    </main>
  );

  return (
    <main className="px-5 py-6 pb-24">
      <h1 className="font-display font-black text-2xl">Rentabilidad</h1>
      <p className="text-white/50 text-sm">Ocupación y facturación por cancha, y descuentos de baja demanda.</p>

      <div className="mt-4 flex gap-2">
        {(['semana', 'mes'] as const).map(k => (
          <button key={k} onClick={() => setPeriodo(k)}
            className={`px-4 py-2 rounded-xl text-sm font-bold ${periodo === k ? 'bg-ball text-courtdark' : 'bg-white/10 text-white/60'}`}>
            {k === 'semana' ? 'Últimos 7 días' : 'Últimos 30 días'}
          </button>
        ))}
      </div>

      {/* 💰 GANANCIA NETA: ingresos totales − gastos */}
      <section className="mt-4 rounded-3xl bg-gradient-to-br from-ball/10 to-transparent border-2 border-ball/30 p-4">
        <p className="font-display font-black text-ball text-xs tracking-widest">💰 GANANCIA NETA DEL PERÍODO</p>
        <p className={`font-display font-black text-4xl mt-1 ${neto.ganancia >= 0 ? 'text-ball' : 'text-red-400'}`}>
          {neto.ganancia >= 0 ? '' : '−'}${Math.abs(neto.ganancia).toLocaleString('es-AR')}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/5 p-3">
            <p className="text-white/60 text-[10px] font-black uppercase">Ingresos totales</p>
            <p className="font-display font-black text-xl text-white">${neto.ingresos.toLocaleString('es-AR')}</p>
            <p className="text-white/40 text-[10px] mt-1">
              🎾 ${neto.canchas.toLocaleString('es-AR')} · 🧾 ${neto.buffet.toLocaleString('es-AR')} · 🏆 ${neto.torneos.toLocaleString('es-AR')} · 🎫 ${neto.socios.toLocaleString('es-AR')}
            </p>
          </div>
          <div className="rounded-xl bg-red-500/10 p-3">
            <p className="text-red-300 text-[10px] font-black uppercase">Gastos totales</p>
            <p className="font-display font-black text-xl text-red-300">−${neto.gastos.toLocaleString('es-AR')}</p>
            {neto.gastosByCat.length > 0 && (
              <p className="text-white/40 text-[10px] mt-1 truncate">
                {neto.gastosByCat.slice(0, 3).map(c => `${c.category}: $${c.total.toLocaleString('es-AR')}`).join(' · ')}
              </p>
            )}
          </div>
        </div>
        <p className="text-white/50 text-xs mt-3">
          Margen: <b className="text-white">{neto.ingresos > 0 ? Math.round((neto.ganancia / neto.ingresos) * 100) : 0}%</b>
          {' · '}
          <a href="/complejo/gastos" className="text-ball font-bold underline">Registrar gasto →</a>
        </p>
      </section>

      {/* Resumen */}
      <section className="grid grid-cols-3 gap-2 mt-4">
        <div className="card !p-3 text-center"><p className="text-ball font-display font-black text-xl">{total.turnos}</p><p className="text-white/40 text-[10px] font-bold">turnos</p></div>
        <div className="card !p-3 text-center"><p className="text-ball font-display font-black text-lg">${total.plata.toLocaleString('es-AR')}</p><p className="text-white/40 text-[10px] font-bold">facturado</p></div>
        <div className="card !p-3 text-center"><p className="text-ball font-display font-black text-xl">{total.libres}</p><p className="text-white/40 text-[10px] font-bold">huecos libres</p></div>
      </section>

      {/* Por cancha */}
      <section className="mt-4 space-y-2">
        <p className="font-display font-bold text-ball text-sm">Por cancha</p>
        {porCancha.map(s => (
          <div key={s.court.id} className="card">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-display font-bold">{s.court.name}</p>
                <p className="text-white/50 text-xs">${Number(s.court.price_per_slot).toLocaleString('es-AR')} por turno · {s.turnos} reservas</p>
              </div>
              <span className="font-display font-black text-ball text-lg">
                ${s.plata.toLocaleString('es-AR')}
              </span>
            </div>
            <div className="mt-2 flex justify-between text-xs font-bold text-white/60">
              <span>Ocupación</span><span>{s.ocupacion}%</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-ball" style={{ width: `${s.ocupacion}%` }} />
            </div>
            <p className="text-white/40 text-xs mt-2">{s.libres} huecos libres · {s.bloqueos} bloqueos</p>
          </div>
        ))}
      </section>

      <p className="text-white/40 text-xs mt-6 pb-8">
        💡 Los descuentos por baja demanda (happy hour, etc.) ahora se configuran en{' '}
        <a href="/complejo/canchas" className="text-ball font-bold underline">Canchas</a>.
      </p>
    </main>
  );
}
