'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { notify } from '@/lib/notify';
import { DonutChart, ChartLegend } from '@/components/Charts';

const Avatar = ({ url, name, size = 'w-10 h-10' }: { url?: string | null; name: string; size?: string }) => url
  ? <img src={url} alt="" className={`${size} rounded-full object-cover shrink-0`} />
  : <span className={`${size} rounded-full bg-grafito text-white font-display font-black flex items-center justify-center shrink-0`}>
      {name?.[0]?.toUpperCase() ?? '?'}
    </span>;

// Publicador rápido de promociones al feed
function PromoBox({ cxId }: { cxId: string }) {
  const [kind, setKind] = useState('promo');
  const [text, setText] = useState('');
  const [ok, setOk] = useState('');
  const KINDS = [['promo', '🔥 Promo'], ['evento', '🎉 Evento'], ['torneo_abierto', '🏆 Torneo']];
  const PLANTILLAS: Record<string, string> = {
    promo: 'Happy hour: 20% de descuento en turnos de 14 a 17 hs 🔥',
    evento: 'Este sábado clínica de bandeja con profe invitado 🎾',
    torneo_abierto: 'Se viene torneo nuevo, ¡atentos a la inscripción! 🏆'
  };
  async function publicar() {
    if (!text.trim()) return;
    const { error } = await supabase.from('posts').insert({ author_complex_id: cxId, kind, text_content: text.trim() });
    if (error) return alert(error.message);
    setText(''); setOk('¡Publicado en el feed! ✓'); setTimeout(() => setOk(''), 2000);
  }
  return (
    <section className="mt-6 bg-white/5 rounded-2xl p-4">
      <p className="font-display font-bold text-ball text-sm">Publicar promoción</p>
      <div className="flex gap-2 mt-2">
        {KINDS.map(([k, l]) => (
          <button key={k} onClick={() => { setKind(k); setText(PLANTILLAS[k]); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${kind === k ? 'bg-ball text-courtdark' : 'bg-white/10 text-white/60'}`}>
            {l}
          </button>
        ))}
      </div>
      <textarea className="input mt-2 resize-none" rows={2}
        placeholder="Escribí tu promo: happy hour, descuentos, clases…"
        value={text} onChange={e => setText(e.target.value)} />
      {ok && <p className="text-green-400 text-sm font-semibold mt-1">{ok}</p>}
      <button onClick={publicar} className="btn-ball w-full mt-2 text-sm">Publicar en el feed</button>
    </section>
  );
}

export default function DashboardComplejo() {
  const [cx, setCx] = useState<any>(null);
  const [periodo, setPeriodo] = useState<'semana' | 'mes' | 'mes_actual' | 'mes_anterior' | 'mes_2atras' | 'mes_3atras'>('mes_actual');
  const [today, setToday] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [reservasPendientes, setReservasPendientes] = useState<any[]>([]);
  const [sociosPendientes, setSociosPendientes] = useState<any[]>([]);
  const [top, setTop] = useState<any[]>([]);
  const [stats, setStats] = useState({
    turnos: 0, libres: 0, ocupacion: 0, plata: 0,
    ingresado: 0,       // ya cobrado por MP/efectivo/transferencia
    porCobrar: 0,       // pendiente (precio total - lo cobrado)
    waitlistTotal: 0,   // gente esperando por turnos ocupados
    cumplimiento: 0     // % de reservas cumplidas (no canceladas)
  });
  const [waitlistShow, setWaitlistShow] = useState(false);
  const [waitlistList, setWaitlistList] = useState<any[]>([]);
  const [incomeByMethod, setIncomeByMethod] = useState<Record<string, number>>({ efectivo: 0, transferencia: 0, mp: 0, otros: 0 });
  const [restantePendiente, setRestantePendiente] = useState<{ monto: number; cantidad: number }>({ monto: 0, cantidad: 0 });

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: complex } = await supabase.from('complexes').select('*, courts(*)').eq('owner_id', user!.id).single();
    setCx(complex);
    if (!complex) return;
    const courtIds = complex.courts.filter((c: any) => c.active).map((c: any) => c.id);

    // ---- Período ----
    let desde: Date, hasta: Date;
    if (periodo === 'semana' || periodo === 'mes') {
      const dias = periodo === 'semana' ? 7 : 30;
      desde = new Date(); desde.setDate(desde.getDate() - dias); desde.setHours(0, 0, 0, 0);
      hasta = new Date();
    } else {
      // Mes calendario: mes_actual = mes en curso, mes_anterior = mes previo, etc.
      const offset = periodo === 'mes_actual' ? 0
        : periodo === 'mes_anterior' ? 1
        : periodo === 'mes_2atras' ? 2
        : 3;
      const now = new Date();
      desde = new Date(now.getFullYear(), now.getMonth() - offset, 1, 0, 0, 0);
      hasta = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0, 23, 59, 59); // último día del mes
    }
    const dias = Math.max(1, Math.ceil((hasta.getTime() - desde.getTime()) / (24 * 3600 * 1000)));

    const { data: periodBks } = await supabase.from('bookings')
      .select('price, type, starts_at, guest_name, player:profiles!player_id(id, username, first_name, last_name, avatar_url)')
      .in('court_id', courtIds).neq('status', 'cancelada')
      .gte('starts_at', desde.toISOString()).lte('starts_at', hasta.toISOString());

    const reservas = (periodBks ?? []).filter(b => b.type === 'reserva');
    // Slots posibles del período
    const [oh] = complex.open_time.split(':').map(Number);
    const [ch] = complex.close_time.split(':').map(Number);
    const horasDia = ((ch <= oh ? ch + 24 : ch) - oh);
    const slotsDia = Math.max(1, Math.floor(horasDia * 60 / complex.slot_minutes));
    const totalSlots = slotsDia * courtIds.length * dias;
    const ocupados = (periodBks ?? []).length; // reservas + bloqueos
    const plataTotal = reservas.reduce((a, b) => a + Number(b.price ?? 0), 0);

    // Ingresos reales del período (ledger) + desglose por método
    const { data: ledger } = await supabase.from('player_ledger')
      .select('amount, kind, method')
      .eq('complex_id', complex.id)
      .in('kind', ['seña_paid', 'restante_paid'])
      .gte('created_at', desde.toISOString());
    const ingresado = (ledger ?? []).reduce((a: number, r: any) => a + Math.abs(Number(r.amount ?? 0)), 0);
    const porCobrar = Math.max(0, plataTotal - ingresado);

    // Desglose por método
    const byMethod: Record<string, number> = { efectivo: 0, transferencia: 0, mp: 0, otros: 0 };
    (ledger ?? []).forEach((r: any) => {
      const m = ['efectivo', 'transferencia', 'mp'].includes(r.method) ? r.method : 'otros';
      byMethod[m] = (byMethod[m] ?? 0) + Math.abs(Number(r.amount ?? 0));
    });
    setIncomeByMethod(byMethod);

    // Reservas con seña pagada pero sin restante: "cobros pendientes en cancha"
    // Estas son las reservas donde el jugador pagó solo la seña y falta cobrar el resto
    const bookingsWithPartial = new Map<string, { paid: number; total: number }>();
    const { data: allBksFull } = await supabase.from('bookings')
      .select('id, price, court:courts(price_per_slot)')
      .in('court_id', courtIds).neq('status', 'cancelada')
      .gte('starts_at', desde.toISOString()).lte('starts_at', hasta.toISOString());
    (allBksFull ?? []).forEach((b: any) => {
      bookingsWithPartial.set(b.id, {
        paid: 0,
        total: Number(b.court?.price_per_slot ?? b.price ?? 0)
      });
    });
    const { data: ledgerByBooking } = await supabase.from('player_ledger')
      .select('ref_booking_id, amount')
      .eq('complex_id', complex.id)
      .in('kind', ['seña_paid', 'restante_paid'])
      .in('ref_booking_id', Array.from(bookingsWithPartial.keys()));
    (ledgerByBooking ?? []).forEach((r: any) => {
      const b = bookingsWithPartial.get(r.ref_booking_id);
      if (b) b.paid += Math.abs(Number(r.amount ?? 0));
    });
    let restantePendiente = 0;
    let cantPendientes = 0;
    bookingsWithPartial.forEach(v => {
      if (v.paid > 0 && v.paid < v.total) {
        restantePendiente += (v.total - v.paid);
        cantPendientes++;
      }
    });
    setRestantePendiente({ monto: restantePendiente, cantidad: cantPendientes });

    // Cumplimiento: reservas confirmadas / (confirmadas + canceladas)
    const { data: allBks } = await supabase.from('bookings')
      .select('status')
      .in('court_id', courtIds).eq('type', 'reserva')
      .gte('starts_at', desde.toISOString()).lte('starts_at', hasta.toISOString());
    const confirmadas = (allBks ?? []).filter((b: any) => b.status === 'confirmada' || b.status === 'completa' || b.status === 'jugada').length;
    const canceladas = (allBks ?? []).filter((b: any) => b.status === 'cancelada').length;
    const cumplimiento = (confirmadas + canceladas) > 0
      ? Math.round(confirmadas / (confirmadas + canceladas) * 100) : 100;

    // Waitlist total: gente esperando por turnos futuros en las canchas del complejo
    let waitlistTotal = 0;
    if (courtIds.length > 0) {
      const { count } = await supabase.from('booking_waitlist')
        .select('*', { count: 'exact', head: true })
        .in('court_id', courtIds)
        .is('fulfilled_at', null)
        .gte('starts_at', new Date().toISOString());
      waitlistTotal = count ?? 0;
    }

    setStats({
      turnos: reservas.length,
      libres: Math.max(0, totalSlots - ocupados),
      ocupacion: totalSlots ? Math.round(ocupados / totalSlots * 100) : 0,
      plata: plataTotal,
      ingresado,
      porCobrar,
      waitlistTotal,
      cumplimiento
    });

    // ---- Top clientes del período ----
    const map = new Map<string, any>();
    reservas.forEach((b: any) => {
      const key = b.player?.id ?? `g:${b.guest_name}`;
      const prev = map.get(key);
      map.set(key, prev ? { ...prev, count: prev.count + 1 } : { player: b.player, guest: b.guest_name, count: 1 });
    });
    setTop(Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 5));

    // ---- Hoy ----
    const from = new Date(); from.setHours(0, 0, 0, 0);
    const to = new Date(from); to.setDate(to.getDate() + 1);
    const { data: bks } = await supabase.from('bookings')
      .select('*, court:courts(name), player:profiles!player_id(first_name, last_name, phone, avatar_url, category)')
      .in('court_id', courtIds)
      .gte('starts_at', from.toISOString()).lt('starts_at', to.toISOString())
      .neq('status', 'cancelada').order('starts_at');
    setToday(bks ?? []);

    // ---- Resultados por validar (SOLO torneos creados por este complejo) ----
    // Los amistosos NO pasan por acá — son autónomos entre jugadores.
    // Solo validamos partidos que forman parte de un torneo cuyo owner
    // es este complejo (o cuyo owner_coach_id es un profe del complejo).
    const { data: res } = await supabase.from('results')
      .select(`
        *,
        match:matches!inner(
          tournament_match_id,
          tournament_match:tournament_matches!inner(
            round,
            tournament:tournaments!inner(id, name, complex_id)
          )
        )
      `)
      .eq('status', 'pendiente')
      .eq('match.tournament_match.tournament.complex_id', complex.id);
    setPending(res ?? []);

    // ---- Reservas de jugadores pendientes de aprobar ----
    const { data: reservasPend } = await supabase.from('bookings')
      .select('id, court_id, starts_at, price, payment_status, payment_proof_url, court:courts(name), player:profiles!player_id(id, first_name, last_name, avatar_url, phone)')
      .in('court_id', courtIds)
      .eq('type', 'reserva')
      .neq('status', 'cancelada')
      .not('payment_status', 'in', '(pagado,no_aplica)')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at').limit(20);
    setReservasPendientes(reservasPend ?? []);

    // ---- Membresías pendientes de aprobar ----
    const { data: memPend } = await supabase.from('membership_members')
      .select('membership_id, player_id, payment_status, payment_proof_url, membership:memberships!inner(complex_id, name, price), player:profiles!player_id(id, first_name, last_name, avatar_url, phone)')
      .eq('membership.complex_id', complex.id)
      .neq('status', 'activa');
    setSociosPendientes(memPend ?? []);
  }
  useEffect(() => { load(); }, [periodo]);

  async function validar(r: any, ok: boolean) {
    const { data: { user } } = await supabase.auth.getUser();
    if (ok) await supabase.from('results').update({ status: 'validado', validated_by: user!.id }).eq('id', r.id);
    else await supabase.from('results').delete().eq('id', r.id);
    load();
  }

  async function aprobarReserva(b: any) {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('bookings').update({
      status: 'confirmada', payment_status: 'pagado',
      payment_confirmed_at: new Date().toISOString(), payment_confirmed_by: user!.id
    }).eq('id', b.id);
    if (b.player?.id) {
      const when = new Date(b.starts_at).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      await notify({
        user_id: b.player.id, kind: 'reserva_ok',
        title: `Tu reserva en ${cx?.name} está confirmada`,
        body: `Turno del ${when}. ¡A jugar!`, link: '/jugador/reservas'
      });
    }
    load();
  }

  async function aprobarSocio(m: any) {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('membership_members').update({
      status: 'activa', payment_status: 'pagado',
      payment_confirmed_at: new Date().toISOString(), payment_confirmed_by: user!.id
    }).eq('membership_id', m.membership_id).eq('player_id', m.player_id);
    if (m.player?.id) {
      await notify({
        user_id: m.player.id, kind: 'membresia_ok',
        title: `Membresía confirmada en ${cx?.name}`,
        body: `Ya sos socio del plan ${m.membership?.name}.`,
        link: `/club/${cx.id}`
      });
    }
    load();
  }

  if (!cx) return <main className="p-8 text-white/70">Cargando complejo…</main>;

  return (
    <main className="px-5 py-6">
      <div className="flex items-center gap-3">
        <Avatar url={cx.logo_url} name={cx.name} size="w-12 h-12" />
        <div className="flex-1">
          <h1 className="font-display font-black text-xl leading-tight">{cx.name}</h1>
          <p className="text-white/50 text-sm">{new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
      </div>

      {/* Aprobaciones pendientes: lo más urgente arriba */}
      {(reservasPendientes.length > 0 || sociosPendientes.length > 0) && (
        <section className="mt-4 rounded-2xl bg-yellow-300/10 border border-yellow-300/40 p-4">
          <p className="font-display font-black text-yellow-300 text-sm">
            🔔 Pendientes de aprobar ({reservasPendientes.length + sociosPendientes.length})
          </p>
          <div className="mt-3 space-y-2">
            {reservasPendientes.map(b => {
              const when = new Date(b.starts_at).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
              const hasProof = !!b.payment_proof_url;
              return (
                <div key={b.id} className="bg-white/5 rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <Avatar url={b.player?.avatar_url} name={b.player?.first_name ?? '?'} size="w-9 h-9" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{b.player?.first_name} {b.player?.last_name}</p>
                      <p className="text-white/50 text-xs truncate">{b.court?.name} · {when} · ${Number(b.price ?? 0).toLocaleString('es-AR')}</p>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-1 rounded ${hasProof ? 'bg-ball/20 text-ball' : 'bg-white/10 text-white/50'}`}>
                      {hasProof ? 'CON COMP' : 'SIN COMP'}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-2">
                    {hasProof && (
                      <a href={b.payment_proof_url} target="_blank"
                        className="flex-1 text-center py-2 rounded-lg bg-white/10 text-xs font-bold">Ver comprobante</a>
                    )}
                    <button onClick={() => aprobarReserva(b)}
                      className="flex-1 py-2 rounded-lg bg-ball text-courtdark text-xs font-black">Aprobar ✓</button>
                  </div>
                </div>
              );
            })}
            {sociosPendientes.map(m => {
              const hasProof = !!m.payment_proof_url;
              return (
                <div key={`${m.membership_id}-${m.player_id}`} className="bg-white/5 rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <Avatar url={m.player?.avatar_url} name={m.player?.first_name ?? '?'} size="w-9 h-9" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{m.player?.first_name} {m.player?.last_name}</p>
                      <p className="text-white/50 text-xs truncate">Membresía: {m.membership?.name} · ${Number(m.membership?.price ?? 0).toLocaleString('es-AR')}/mes</p>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-1 rounded ${hasProof ? 'bg-ball/20 text-ball' : 'bg-white/10 text-white/50'}`}>
                      {hasProof ? 'CON COMP' : 'SIN COMP'}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-2">
                    {hasProof && (
                      <a href={m.payment_proof_url} target="_blank"
                        className="flex-1 text-center py-2 rounded-lg bg-white/10 text-xs font-bold">Ver comprobante</a>
                    )}
                    <button onClick={() => aprobarSocio(m)}
                      className="flex-1 py-2 rounded-lg bg-ball text-courtdark text-xs font-black">Aprobar ✓</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Filtro de período */}
      <div className="mt-4 flex gap-2">
        {(() => {
          const now = new Date();
          const monthLabel = (offset: number) => {
            const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
            return d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
          };
          const options: { k: any; l: string }[] = [
            { k: 'semana', l: '7 días' },
            { k: 'mes_actual', l: `📅 ${monthLabel(0)} (actual)` },
            { k: 'mes_anterior', l: monthLabel(1) },
            { k: 'mes_2atras', l: monthLabel(2) },
            { k: 'mes_3atras', l: monthLabel(3) }
          ];
          return options.map(o => (
            <button key={o.k} onClick={() => setPeriodo(o.k)}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${periodo === o.k ? 'bg-ball text-courtdark' : 'bg-white/10 text-white/60'}`}>
              {o.l}
            </button>
          ));
        })()}
      </div>

      {/* Métricas del período — operativas */}
      <section className="mt-4 grid grid-cols-4 gap-2">
        {[
          { n: stats.turnos, l: 'Turnos' },
          { n: stats.libres, l: 'Libres' },
          { n: `${stats.ocupacion}%`, l: 'Ocupación' },
          { n: `${stats.cumplimiento}%`, l: 'Cumplim.' }
        ].map(s => (
          <div key={s.l} className="bg-white/5 rounded-2xl p-3 text-center">
            <p className="font-display font-black text-xl text-ball">{s.n}</p>
            <p className="text-white/50 text-[10px] font-semibold">{s.l}</p>
          </div>
        ))}
      </section>

      {/* Métricas de dinero */}
      <section className="mt-3 grid grid-cols-3 gap-2">
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3 text-center">
          <p className="font-display font-black text-lg text-emerald-300">
            ${stats.ingresado.toLocaleString('es-AR')}
          </p>
          <p className="text-white/60 text-[10px] font-bold uppercase">💰 Ingresado</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-3 text-center">
          <p className="font-display font-black text-lg text-yellow-300">
            ${stats.porCobrar.toLocaleString('es-AR')}
          </p>
          <p className="text-white/60 text-[10px] font-bold uppercase">⏳ Por cobrar</p>
        </div>
        <button onClick={async () => {
          setWaitlistShow(true);
          const courtIds = cx.courts.filter((c: any) => c.active).map((c: any) => c.id);
          const { data: wl } = await supabase.from('booking_waitlist')
            .select(`id, created_at, court_id, starts_at,
              court:courts(name),
              profile:profiles!player_id(first_name, last_name, avatar_url, phone)`)
            .in('court_id', courtIds)
            .is('fulfilled_at', null)
            .gte('starts_at', new Date().toISOString())
            .order('starts_at');
          setWaitlistList((wl ?? []).map((w: any) => ({
            ...w,
            booking: { starts_at: w.starts_at, court: w.court }
          })));
        }}
          className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-3 text-center active:scale-95 transition">
          <p className="font-display font-black text-lg text-purple-300">
            {stats.waitlistTotal}
          </p>
          <p className="text-white/60 text-[10px] font-bold uppercase">⏱ En espera</p>
        </button>
      </section>

      {/* 💵 Desglose de ingresos por método de pago */}
      <section className="mt-4 bg-white/5 rounded-2xl p-4">
        <p className="font-display font-black text-ball text-sm tracking-widest">💵 INGRESOS POR MÉTODO</p>
        <p className="text-white/50 text-xs mt-1">
          {periodo === 'semana' ? 'Últimos 7 días'
  : periodo === 'mes' ? 'Últimos 30 días'
  : periodo === 'mes_actual' ? 'Mes en curso'
  : periodo === 'mes_anterior' ? 'Mes anterior'
  : 'Meses previos'} · Total: <b className="text-white">${stats.ingresado.toLocaleString('es-AR')}</b>
        </p>
        <div className="mt-3 space-y-2">
          {[
            { key: 'efectivo', label: '💵 Efectivo', color: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
            { key: 'transferencia', label: '🏦 Transferencia', color: 'text-blue-300', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
            { key: 'mp', label: '💳 Mercado Pago', color: 'text-[#009EE3]', bg: 'bg-[#009EE3]/10', border: 'border-[#009EE3]/30' }
          ].map(m => {
            const amount = incomeByMethod[m.key] ?? 0;
            const pct = stats.ingresado > 0 ? Math.round((amount / stats.ingresado) * 100) : 0;
            return (
              <div key={m.key} className={`rounded-xl p-3 border ${m.bg} ${m.border}`}>
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-black ${m.color}`}>{m.label}</p>
                  <p className={`text-sm font-display font-black ${m.color}`}>
                    ${amount.toLocaleString('es-AR')} <span className="text-white/40 text-xs">({pct}%)</span>
                  </p>
                </div>
                <div className="mt-1.5 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className={`h-full ${m.color.replace('text-', 'bg-')}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-white/40 text-[10px] mt-3">
          💡 Efectivo y MP tienen tratamiento fiscal distinto. Usalo para armar tu facturación mensual.
        </p>
      </section>

      {/* ⏳ Cobros pendientes (seña pagada, restante por cobrar) */}
      {restantePendiente.cantidad > 0 && (
        <section className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-display font-black text-yellow-300 text-sm tracking-widest">⏳ COBROS PENDIENTES EN CANCHA</p>
              <p className="text-white/70 text-sm mt-2">
                <b className="text-yellow-300 text-xl">{restantePendiente.cantidad}</b> reserva{restantePendiente.cantidad > 1 ? 's' : ''} con seña paga pero <b>saldo pendiente</b>.
              </p>
              <p className="text-white/50 text-xs mt-1">
                Total a cobrar en cancha: <b className="text-yellow-300">${restantePendiente.monto.toLocaleString('es-AR')}</b>
              </p>
            </div>
          </div>
          <Link href="/complejo/calendario" className="mt-3 inline-block py-2 px-4 rounded-lg bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 text-xs font-black">
            Ver calendario →
          </Link>
        </section>
      )}

      {/* Drawer: lista de gente en espera */}
      {waitlistShow && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-end lg:items-center overflow-y-auto"
          onClick={() => setWaitlistShow(false)}>
          <div className="bg-[#0B0F16] border-2 border-white/15 rounded-t-3xl lg:rounded-2xl w-full max-w-lg mx-auto p-5 pb-10"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-display font-black text-lg">⏱ Lista de espera</p>
              <button onClick={() => setWaitlistShow(false)}
                className="w-9 h-9 rounded-full bg-white/10 text-white font-bold">✕</button>
            </div>
            {waitlistList.length === 0 ? (
              <p className="text-white/50 text-sm mt-4 text-center py-6">Nadie está en espera ahora.</p>
            ) : (
              <ul className="mt-3 space-y-2 max-h-[60vh] overflow-y-auto">
                {waitlistList.map((w: any, i: number) => {
                  const when = w.booking?.starts_at ? new Date(w.booking.starts_at) : null;
                  const wa = w.profile?.phone
                    ? `https://wa.me/${w.profile.phone.replace(/\D/g, '')}?text=${encodeURIComponent('Hola, nos contactamos de ' + (cx?.name ?? '') + ' porque hay un lugar disponible en el turno del ' + (when?.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) ?? '') + '!')}`
                    : null;
                  return (
                    <li key={i} className="bg-white/5 rounded-xl p-3 flex items-center gap-3">
                      {w.profile?.avatar_url
                        ? <img src={w.profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                        : <span className="w-10 h-10 rounded-full bg-grafito flex items-center justify-center font-black">
                            {w.profile?.first_name?.[0] ?? '?'}
                          </span>}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">
                          {w.profile?.first_name} {w.profile?.last_name}
                        </p>
                        <p className="text-white/50 text-xs truncate">
                          {w.booking?.court?.name} · {when?.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} hs
                        </p>
                      </div>
                      {wa && (
                        <a href={wa} target="_blank" rel="noopener"
                          className="bg-[#25D366] text-white text-xs font-black px-3 py-2 rounded-lg">
                          💬 WA
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Chart de ocupación */}
      {(stats.turnos > 0 || stats.libres > 0) && (
        <section className="card mt-4 !p-5">
          <p className="font-display font-black text-ball text-xs tracking-widest">OCUPACIÓN DEL PERÍODO</p>
          <div className="mt-3 flex items-center gap-5">
            <DonutChart
              segments={[
                { label: 'Turnos ocupados', value: stats.turnos, color: '#D8F646' },
                { label: 'Slots libres', value: stats.libres, color: '#3A404A' }
              ]}
              size={140} thickness={26}
              centerLabel={`${stats.ocupacion}%`}
              centerSub="ocupación"
            />
            <div className="flex-1 min-w-0">
              <ChartLegend segments={[
                { label: 'Turnos ocupados', value: stats.turnos, color: '#D8F646' },
                { label: 'Slots libres', value: stats.libres, color: '#3A404A' }
              ]} />
              <Link href="/complejo/rentabilidad" className="text-ball text-xs font-black mt-3 inline-block">
                Ver rentabilidad por cancha →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Top clientes */}
      <section className="mt-4 bg-white/5 rounded-2xl p-4">
        <div className="flex justify-between items-center">
          <p className="font-display font-bold text-ball text-sm">Top clientes ({periodo === 'semana' ? '7 días' : '30 días'})</p>
          <Link href="/complejo/clientes" className="text-white/50 text-xs font-semibold">Ver todos →</Link>
        </div>
        <ul className="mt-2 space-y-2">
          {top.map((f, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="font-display font-black text-ball w-5">{i + 1}</span>
              <Avatar url={f.player?.avatar_url} name={f.player?.first_name ?? f.guest ?? '?'} size="w-8 h-8" />
              <span className="flex-1 text-sm font-semibold truncate">
                {f.player ? `${f.player.first_name} ${f.player.last_name}` : `${f.guest ?? 'Invitado'} (manual)`}
              </span>
              <span className="text-white/50 text-sm font-bold">{f.count} turnos</span>
            </li>
          ))}
          {top.length === 0 && <p className="text-white/40 text-sm">Sin reservas en el período.</p>}
        </ul>
      </section>

      {/* Reservas de hoy */}
      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-ball">Hoy en tus canchas ({today.length})</h2>
          <Link href="/complejo/calendario" className="text-white/60 text-sm font-semibold">Calendario →</Link>
        </div>
        <div className="mt-3 space-y-2">
          {today.map(b => (
            <div key={b.id} className="bg-white/5 rounded-2xl p-3 flex items-center gap-3">
              {b.type === 'block'
                ? <span className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">⛔</span>
                : <Avatar url={b.player?.avatar_url} name={b.player?.first_name ?? b.guest_name ?? '?'} />}
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">
                  {b.type === 'block' ? 'Horario bloqueado'
                    : b.player ? `${b.player.first_name} ${b.player.last_name}`
                    : `${b.guest_name ?? 'Reserva manual'} 📞`}
                </p>
                <p className="text-white/50 text-sm truncate">
                  {b.court.name} · {b.player?.phone ?? b.guest_phone ?? ''}
                </p>
              </div>
              <p className="font-display font-black text-ball shrink-0">
                {new Date(b.starts_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          ))}
          {today.length === 0 && (
            <div className="bg-white/5 rounded-2xl p-6 text-center text-white/50">
              Sin reservas para hoy. Compartí tus horarios libres en el feed 📣
            </div>
          )}
        </div>
      </section>

      <PromoBox cxId={cx.id} />

      {/* Resultados por validar — SOLO torneos del complejo */}
      <section className="mt-6">
        <h2 className="font-display font-bold text-ball">Resultados de torneos por validar ({pending.length})</h2>
        {pending.length === 0 && (
          <p className="text-white/40 text-xs mt-2">Solo aparecen partidos de torneos organizados por tu complejo. Los amistosos no requieren tu validación.</p>
        )}
        <div className="mt-3 space-y-2">
          {pending.map(r => (
            <div key={r.id} className="bg-white/5 rounded-2xl p-3">
              <p className="font-semibold">
                {r.match?.tournament_match?.tournament?.name ?? 'Torneo'}
                {r.match?.tournament_match?.round && (
                  <span className="text-ball text-xs ml-2">· {r.match.tournament_match.round}</span>
                )}
              </p>
              <p className="text-white/50 text-sm">
                Ganó equipo {r.winner_team} · {r.sets.map((s: any) => `${s.t1}-${s.t2}`).join(' / ')}
              </p>
              <div className="flex gap-2 mt-2">
                <button onClick={() => validar(r, true)} className="btn-ball text-sm flex-1">Validar ✓</button>
                <button onClick={() => validar(r, false)} className="flex-1 rounded-xl border border-white/20 text-sm font-semibold">Rechazar</button>
              </div>
            </div>
          ))}
          {pending.length === 0 && <p className="text-white/40 text-sm">Nada pendiente 🎾</p>}
        </div>
      </section>
    </main>
  );
}
