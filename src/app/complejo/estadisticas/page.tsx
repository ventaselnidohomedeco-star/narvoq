'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import BackButton from '@/components/BackButton';
import PremiumGate from '@/components/PremiumGate';
import VerifiedBadge from '@/components/VerifiedBadge';

// /complejo/estadisticas — Reportes financieros y de uso.
// Solo Premium. Calcula todo desde bookings + tournaments + memberships.

type Period = '7d' | '30d' | '90d';

const BALL = '#D8F646';

export default function ComplejoEstadisticas() {
  const [cx, setCx] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('30d');
  const [bookings, setBookings] = useState<any[]>([]);
  const [courts, setCourts] = useState<any[]>([]);
  const [topUsers, setTopUsers] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setLoading(false);
      const { data: complex } = await supabase.from('complexes').select('*, courts(*)').eq('owner_id', user.id).maybeSingle();
      if (!complex) return setLoading(false);
      setCx(complex);
      setCourts(complex.courts ?? []);

      if (!complex.is_premium) return setLoading(false);

      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
      const courtIds = (complex.courts ?? []).map((c: any) => c.id);

      // Reservas del período
      const { data: bks } = await supabase.from('bookings')
        .select('id, court_id, starts_at, price, status, payment_status, player_id, player:profiles!player_id(first_name, last_name, username, avatar_url)')
        .in('court_id', courtIds)
        .gte('starts_at', since)
        .order('starts_at');
      setBookings(bks ?? []);

      // Top 10 usuarios que más reservaron
      const counts: Record<string, { user: any; count: number; ingreso: number }> = {};
      (bks ?? []).forEach((b: any) => {
        if (!b.player_id || b.status === 'cancelada') return;
        if (!counts[b.player_id]) counts[b.player_id] = { user: b.player, count: 0, ingreso: 0 };
        counts[b.player_id].count++;
        counts[b.player_id].ingreso += (b.price ?? 0);
      });
      setTopUsers(Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 10));

      // Torneos del complejo del período
      const { data: ts } = await supabase.from('tournaments')
        .select('id, name, entry_fee_ars, price, platform_commission_pct, status, starts_on, pairs:tournament_pairs(id, status)')
        .eq('complex_id', complex.id)
        .gte('created_at', since);
      setTournaments(ts ?? []);

      setLoading(false);
    })();
  }, [period]);

  // ---- Métricas derivadas ----
  const stats = useMemo(() => {
    const valid = bookings.filter(b => b.status !== 'cancelada');
    const canceladas = bookings.filter(b => b.status === 'cancelada').length;
    const ingresoTotal = valid.reduce((sum, b) => sum + (b.price ?? 0), 0);
    const promDia = valid.length / (period === '7d' ? 7 : period === '30d' ? 30 : 90);
    const promIngresoPorReserva = valid.length > 0 ? ingresoTotal / valid.length : 0;

    // Ocupación por cancha
    const porCancha: Record<string, { name: string; reservas: number; ingreso: number }> = {};
    courts.forEach(c => { porCancha[c.id] = { name: c.name, reservas: 0, ingreso: 0 }; });
    valid.forEach(b => {
      if (porCancha[b.court_id]) {
        porCancha[b.court_id].reservas++;
        porCancha[b.court_id].ingreso += (b.price ?? 0);
      }
    });

    // Reservas por día de la semana
    const porDiaSem: number[] = [0, 0, 0, 0, 0, 0, 0];
    valid.forEach(b => {
      const dia = new Date(b.starts_at).getDay();
      porDiaSem[dia]++;
    });

    // Reservas por horario (hora del día)
    const porHora: Record<number, number> = {};
    valid.forEach(b => {
      const h = new Date(b.starts_at).getHours();
      porHora[h] = (porHora[h] ?? 0) + 1;
    });

    return {
      total: valid.length,
      canceladas,
      ingresoTotal,
      promDia,
      promIngresoPorReserva,
      porCancha: Object.values(porCancha),
      porDiaSem,
      porHora
    };
  }, [bookings, courts, period]);

  // ---- Torneos: ingresos por inscripción + comisión ----
  const tournamentStats = useMemo(() => {
    const totales = tournaments.reduce((acc, t) => {
      const fee = t.entry_fee_ars ?? t.price ?? 0;
      const aprobadas = (t.pairs ?? []).filter((p: any) => p.status === 'aprobada').length;
      const bruto = fee * aprobadas;
      const commissionPct = Number(t.platform_commission_pct ?? 2);
      const comision = Math.round(bruto * commissionPct / 100);
      const neto = bruto - comision;
      return {
        cantidad: acc.cantidad + 1,
        parejasTotal: acc.parejasTotal + aprobadas,
        bruto: acc.bruto + bruto,
        comision: acc.comision + comision,
        neto: acc.neto + neto
      };
    }, { cantidad: 0, parejasTotal: 0, bruto: 0, comision: 0, neto: 0 });
    return totales;
  }, [tournaments]);

  if (loading) return (
    <main className="min-h-dvh p-8 text-white/60">
      Cargando estadísticas...
    </main>
  );

  if (!cx) return (
    <main className="min-h-dvh p-8 text-white/60">
      No se encontró tu complejo.
    </main>
  );

  // Gate premium
  if (!cx.is_premium) return (
    <main className="min-h-dvh max-w-3xl mx-auto px-5 py-8">
      <BackButton fallbackHref="/complejo/dashboard" label="Dashboard" />
      <h1 className="font-display font-black text-3xl mt-4 mb-6">Estadísticas del complejo</h1>
      <PremiumGate isPremium={false} feature="financial_reports">
        <div />
      </PremiumGate>
    </main>
  );

  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  return (
    <main className="min-h-dvh max-w-5xl mx-auto px-5 py-8">
      <BackButton fallbackHref="/complejo/dashboard" label="Dashboard" />
      <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-black text-3xl">
            Estadísticas <VerifiedBadge show size="md" />
          </h1>
          <p className="text-white/50 text-sm mt-1">{cx.name}</p>
        </div>
        {/* Selector de período */}
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-black ${period === p ? 'bg-ball text-courtdark' : 'bg-white/5 text-white/70 border border-white/10'}`}>
              {p === '7d' ? '7 días' : p === '30d' ? '30 días' : '90 días'}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs principales */}
      <section className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <BigStat label="Reservas" value={String(stats.total)} sub={`~${stats.promDia.toFixed(1)} por día`} />
        <BigStat label="Ingresos" value={`$${stats.ingresoTotal.toLocaleString('es-AR')}`} sub={`$${Math.round(stats.promIngresoPorReserva).toLocaleString('es-AR')} promedio`} />
        <BigStat label="Canceladas" value={String(stats.canceladas)} sub={stats.total > 0 ? `${Math.round(stats.canceladas / (stats.canceladas + stats.total) * 100)}% del total` : ''} tone={stats.canceladas > stats.total * 0.15 ? 'warn' : 'ok'} />
        <BigStat label="Torneos" value={String(tournamentStats.cantidad)} sub={`${tournamentStats.parejasTotal} parejas`} />
      </section>

      {/* Ingresos por torneos */}
      {tournamentStats.cantidad > 0 && (
        <section className="mt-6 card !p-5">
          <p className="font-display font-black text-ball text-sm mb-3">TORNEOS - INGRESOS ({period})</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-white/50 text-xs font-bold uppercase">Bruto</p>
              <p className="font-display font-black text-2xl mt-1">${tournamentStats.bruto.toLocaleString('es-AR')}</p>
            </div>
            <div>
              <p className="text-white/50 text-xs font-bold uppercase">Comisión NarvoQ</p>
              <p className="font-display font-black text-2xl mt-1 text-orange-300">-${tournamentStats.comision.toLocaleString('es-AR')}</p>
            </div>
            <div>
              <p className="text-white/50 text-xs font-bold uppercase">Vos recibís</p>
              <p className="font-display font-black text-2xl mt-1 text-ball">${tournamentStats.neto.toLocaleString('es-AR')}</p>
            </div>
          </div>
          <p className="text-white/40 text-xs mt-3">
            La comisión de NarvoQ es del {tournaments[0]?.platform_commission_pct ?? 2}% sobre cada inscripción.
          </p>
        </section>
      )}

      {/* Ocupación por cancha */}
      {stats.porCancha.length > 0 && (
        <section className="mt-6 card !p-5">
          <p className="font-display font-black text-ball text-sm mb-3">OCUPACIÓN POR CANCHA</p>
          <div className="space-y-2">
            {stats.porCancha.sort((a, b) => b.reservas - a.reservas).map((c, i) => {
              const max = Math.max(...stats.porCancha.map(x => x.reservas), 1);
              const pct = (c.reservas / max) * 100;
              return (
                <div key={i} className="flex items-center gap-3">
                  <p className="w-20 text-sm font-bold truncate">{c.name}</p>
                  <div className="flex-1 h-6 bg-white/5 rounded-lg overflow-hidden">
                    <div className="h-full bg-ball" style={{ width: `${Math.max(3, pct)}%` }} />
                  </div>
                  <p className="w-20 text-right text-sm font-black">{c.reservas} reservas</p>
                  <p className="w-24 text-right text-sm text-white/60">${c.ingreso.toLocaleString('es-AR')}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Top usuarios */}
      <section className="mt-6 card !p-5">
        <p className="font-display font-black text-ball text-sm mb-3">TOP USUARIOS ({period})</p>
        {topUsers.length === 0 ? (
          <p className="text-white/40 text-sm">Sin reservas en este período.</p>
        ) : (
          <div className="space-y-1">
            {topUsers.map((u, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                <span className="w-6 text-center text-ball font-black">{i + 1}</span>
                {u.user?.avatar_url ? (
                  <img src={u.user.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <span className="w-8 h-8 rounded-full bg-grafito text-ball text-xs font-black flex items-center justify-center">
                    {(u.user?.first_name?.[0] ?? '?').toUpperCase()}
                  </span>
                )}
                <p className="flex-1 text-sm font-semibold truncate">
                  {u.user?.first_name ?? '—'} {u.user?.last_name ?? ''}
                  {u.user?.username && <span className="text-white/40 text-xs ml-2">@{u.user.username}</span>}
                </p>
                <p className="text-white/60 text-xs font-bold">{u.count} reservas</p>
                <p className="text-ball text-xs font-black w-20 text-right">${u.ingreso.toLocaleString('es-AR')}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Reservas por día de la semana */}
      <section className="mt-6 card !p-5">
        <p className="font-display font-black text-ball text-sm mb-3">RESERVAS POR DÍA DE LA SEMANA</p>
        <div className="flex items-end gap-2 h-32">
          {dias.map((d, i) => {
            const max = Math.max(...stats.porDiaSem, 1);
            const h = (stats.porDiaSem[i] / max) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end" style={{ height: '100%' }}>
                  <div className="w-full rounded-t transition-all"
                    style={{ height: `${Math.max(3, h)}%`, background: BALL, minHeight: 3 }} />
                </div>
                <p className="text-[10px] text-white/40 font-mono">{d}</p>
                <p className="text-[11px] text-white/80 font-black">{stats.porDiaSem[i]}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Reservas por horario */}
      {Object.keys(stats.porHora).length > 0 && (
        <section className="mt-6 card !p-5">
          <p className="font-display font-black text-ball text-sm mb-3">HORARIOS MÁS PEDIDOS</p>
          <div className="flex items-end gap-1 h-32">
            {Array.from({ length: 24 }, (_, h) => {
              const count = stats.porHora[h] ?? 0;
              const max = Math.max(...Object.values(stats.porHora), 1);
              const bh = (count / max) * 100;
              return (
                <div key={h} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <div className="w-full flex items-end" style={{ height: '100%' }}>
                    <div className="w-full rounded-t"
                      style={{ height: count > 0 ? `${Math.max(3, bh)}%` : '0%', background: BALL, minHeight: count > 0 ? 3 : 0 }} />
                  </div>
                  <p className="text-[8px] text-white/40 font-mono">{h}</p>
                </div>
              );
            })}
          </div>
          <p className="text-white/40 text-[10px] mt-2 text-center">Horas del día (0-23)</p>
        </section>
      )}

      {/* CTA */}
      <p className="text-white/40 text-xs text-center mt-6">
        Los datos se actualizan en tiempo real desde tus reservas y torneos.
      </p>
    </main>
  );
}

function BigStat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'warn' }) {
  return (
    <div className="card !p-4">
      <p className="text-white/50 text-[10px] font-black uppercase tracking-wider">{label}</p>
      <p className={`font-display font-black text-2xl mt-1 leading-none ${tone === 'warn' ? 'text-orange-300' : 'text-ball'}`}>{value}</p>
      {sub && <p className="text-white/40 text-[11px] mt-1">{sub}</p>}
    </div>
  );
}
