'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { buildSlots } from '@/lib/slots';
import { notify } from '@/lib/notify';

const Avatar = ({ url, name }: { url?: string | null; name: string }) => url
  ? <img src={url} alt="" className="w-7 h-7 rounded-full object-cover" />
  : <span className="w-7 h-7 rounded-full bg-grafito text-white text-xs font-display font-black flex items-center justify-center">
      {name?.[0]?.toUpperCase() ?? '?'}
    </span>;

export default function Calendario() {
  const [cx, setCx] = useState<any>(null);
  const [dayOffset, setDayOffset] = useState(0);
  const [bookings, setBookings] = useState<any[]>([]);
  const [waitlistCounts, setWaitlistCounts] = useState<Map<string, number>>(new Map());
  const [sel, setSel] = useState<any>(null);           // celda seleccionada
  const [form, setForm] = useState({
    name: '', phone: '',
    repeat: 1 as 1 | 2 | 3 | 4,            // 1 = solo hoy, 2..4 = ese día + N-1 semanas
    payKind: 'sin_pago' as 'sin_pago' | 'sena' | 'total',
    payMethod: 'efectivo' as 'efectivo' | 'transferencia' | 'mp',
    payAmount: ''                            // vacío = usa deposit_amount de la cancha
  });
  const [selWaitlist, setSelWaitlist] = useState<any[]>([]); // gente en espera del turno seleccionado
  const [cobro, setCobro] = useState<{ show: boolean; monto: string; metodo: 'efectivo' | 'transferencia' }>({ show: false, monto: '', metodo: 'efectivo' });
  const [selPaid, setSelPaid] = useState<number>(0);   // ya cobrado de la reserva seleccionada

  const day = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + dayOffset);
    return d;
  }, [dayOffset]);

  // Ventana de 30 días — scrolleables horizontalmente
  const days = useMemo(() => Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i);
    return d;
  }), []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: complex } = await supabase.from('complexes')
      .select('*, courts(*)').eq('owner_id', user!.id).single();
    if (complex) complex.courts = complex.courts.filter((c: any) => c.active)
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
    setCx(complex);
    if (!complex) return;

    // Auto-cancelar reservas cuyo deadline de pago venció.
    // Llamamos a la función SQL cancel_expired_bookings() que hace el UPDATE y
    // devuelve la lista de bookings cancelados para notificar a los jugadores.
    try {
      const { data: expired } = await supabase.rpc('cancel_expired_bookings');
      if (expired && expired.length > 0) {
        // eslint-disable-next-line no-console
        console.log('[calendario] auto-canceladas por deadline:', expired.length);
        for (const b of expired as any[]) {
          if (b.complex_id !== complex.id) continue;   // solo notificar por nuestro complejo
          if (!b.player_id) continue;
          const when = new Date(b.starts_at).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
          await notify({
            user_id: b.player_id, kind: 'reserva_ok',
            title: `⏰ Reserva cancelada por vencimiento`,
            body: `No subiste el comprobante a tiempo. Tu turno del ${when} quedó libre.`,
            link: '/jugador/reservas'
          });
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[calendario] cancel_expired_bookings error:', e);
    }
    const to = new Date(day); to.setDate(to.getDate() + 1);
    const { data, error } = await supabase.from('bookings')
      .select('*, player:profiles!player_id(first_name, last_name, phone, avatar_url)')
      .in('court_id', complex.courts.map((c: any) => c.id))
      .gte('starts_at', day.toISOString()).lt('starts_at', to.toISOString())
      .neq('status', 'cancelada');
    if (error) console.error('Error cargando bookings:', error);
    setBookings(data ?? []);

    // Waitlist del día — para pintar badges en las celdas
    const { data: wl } = await supabase.from('booking_waitlist')
      .select('court_id, starts_at')
      .in('court_id', complex.courts.map((c: any) => c.id))
      .gte('starts_at', day.toISOString()).lt('starts_at', to.toISOString())
      .is('fulfilled_at', null);
    // Normalizar starts_at con new Date().toISOString() para que matchee con
    // lo que después usamos como key en el grid (JS y Postgres formatean diferente).
    const counts = new Map<string, number>();
    (wl ?? []).forEach((w: any) => {
      const key = `${w.court_id}|${new Date(w.starts_at).toISOString()}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    setWaitlistCounts(counts);
  }
  useEffect(() => { if (cx || dayOffset >= 0) load(); }, [dayOffset]); // eslint-disable-line

  // Cada vez que se abre una reserva, cargar cuánto ya se cobró
  useEffect(() => {
    (async () => {
      if (!sel?.booking?.id) { setSelPaid(0); setCobro({ show: false, monto: '', metodo: 'efectivo' }); return; }
      const { data } = await supabase.rpc('get_booking_paid', { p_booking_id: sel.booking.id });
      setSelPaid(Number(data ?? 0));
    })();
  }, [sel?.booking?.id]);

  // Al abrir un slot, cargar quiénes están en lista de espera para ese slot exacto
  useEffect(() => {
    (async () => {
      if (!sel) { setSelWaitlist([]); return; }
      const starts = sel.t.toISOString();
      const { data: wl } = await supabase.from('booking_waitlist')
        .select('id, player_id, created_at, notified_at, fulfilled_at, profile:profiles!player_id(first_name, last_name, avatar_url, phone)')
        .eq('court_id', sel.court.id)
        .eq('starts_at', starts)
        .is('fulfilled_at', null)
        .order('created_at');
      setSelWaitlist(wl ?? []);
    })();
  }, [sel]);

  // Modal post-cancelación con lista de espera + WA
  const [postCancel, setPostCancel] = useState<null | { court: any; starts: Date; wl: any[] }>(null);
  // Modal para ver la waitlist de un slot al tocar el botón verde
  const [waitlistModal, setWaitlistModal] = useState<null | { court: any; starts: Date; wl: any[] }>(null);

  async function abrirWaitlistModal(court: any, starts: Date) {
    const { data: wl } = await supabase.from('booking_waitlist')
      .select('id, player_id, created_at, profile:profiles!player_id(username, first_name, last_name, avatar_url, phone)')
      .eq('court_id', court.id)
      .eq('starts_at', starts.toISOString())
      .is('fulfilled_at', null)
      .order('created_at');
    setWaitlistModal({ court, starts, wl: wl ?? [] });
  }

  async function cobrarRestante() {
    const monto = Number(cobro.monto.replace(',', '.'));
    if (!monto || monto <= 0) return alert('Ingresá un monto válido');
    const b = sel.booking;
    if (!b?.player_id) return alert('Solo se puede cobrar restante a jugadores registrados');
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('player_ledger').insert({
      player_id: b.player_id,
      complex_id: cx.id,
      kind: 'restante_paid',
      amount: monto,
      method: cobro.metodo,
      description: `Restante cancha · ${new Date(b.starts_at).toLocaleDateString('es-AR')} ${new Date(b.starts_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`,
      ref_booking_id: b.id,
      created_by: user!.id
    });
    if (error) return alert('Error: ' + error.message);
    // Recalcular cobrado
    const { data } = await supabase.rpc('get_booking_paid', { p_booking_id: b.id });
    setSelPaid(Number(data ?? 0));
    setCobro({ show: false, monto: '', metodo: 'efectivo' });
  }

  // Horarios del día (filas de la grilla)
  const times = useMemo(() => {
    if (!cx) return [];
    return buildSlots(day, cx.open_time, cx.close_time, cx.slot_minutes, []).map(s => s.start);
  }, [cx, day]);

  function cellBooking(courtId: string, t: Date) {
    const end = new Date(t.getTime() + cx.slot_minutes * 60000);
    return bookings.find(b => b.court_id === courtId &&
      new Date(b.starts_at) < end && new Date(b.ends_at) > t);
  }

  async function accion(tipo: 'manual' | 'block') {
    const startsBase = sel.t;
    const durationMs = cx.slot_minutes * 60000;
    const priceTotal = Number(sel.court.price_per_slot ?? 0);
    const deposit = sel.court.deposit_amount != null ? Number(sel.court.deposit_amount) : priceTotal;
    const cobrado = tipo === 'manual' && form.payKind !== 'sin_pago'
      ? (form.payAmount ? Number(form.payAmount) : (form.payKind === 'total' ? priceTotal : deposit))
      : 0;

    const { data: { user } } = await supabase.auth.getUser();
    const semanas = tipo === 'block' ? 1 : Math.max(1, Math.min(4, Number(form.repeat)));

    // Bloque de reservas — 1 por semana durante N semanas consecutivas (mismo día/horario/cancha)
    const rows: any[] = [];
    for (let w = 0; w < semanas; w++) {
      const starts = new Date(startsBase.getTime() + w * 7 * 24 * 3600 * 1000);
      const ends = new Date(starts.getTime() + durationMs);
      rows.push({
        court_id: sel.court.id,
        type: tipo === 'block' ? 'block' : 'reserva',
        status: 'confirmada',
        // Reserva creada por el propio complejo — no requiere aprobación
        payment_status: tipo === 'manual'
          ? (form.payKind === 'sin_pago' ? 'no_aplica' : 'pagado')
          : 'no_aplica',
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        price: tipo === 'manual' ? priceTotal : null,
        guest_name: tipo === 'manual' ? (form.name || 'Reserva manual') : null,
        guest_phone: tipo === 'manual' ? form.phone : null,
        notes: tipo === 'block' ? 'Bloqueo' : null
      });
    }

    const { data: inserted, error } = await supabase.from('bookings').insert(rows).select();
    if (error) {
      alert('No se pudo guardar: ' + error.message);
      return;
    }

    // Registrar pago (si aplica) para cada reserva creada
    if (tipo === 'manual' && cobrado > 0 && inserted) {
      const kind = form.payKind === 'total' ? 'seña_paid' : 'seña_paid';
      const ledgerRows = inserted.map((b: any) => ({
        player_id: null,   // manual, sin jugador registrado
        complex_id: cx.id,
        kind,
        amount: cobrado,
        method: form.payMethod,
        description: `Reserva manual · ${form.name || 'Sin nombre'} · ${form.payKind === 'total' ? 'turno completo' : 'seña'}`,
        ref_booking_id: b.id,
        created_by: user!.id
      }));
      await supabase.from('player_ledger').insert(ledgerRows);
    }

    setSel(null);
    setForm({ name: '', phone: '', repeat: 1, payKind: 'sin_pago', payMethod: 'efectivo', payAmount: '' });
    load();
  }

  async function cancelar(b: any) {
    if (!confirm('¿Cancelar esta reserva?')) return;

    // Si tenía seña pagada, la convertimos en crédito a favor del jugador
    if (b.payment_status === 'pagado' && b.player_id && b.price) {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('player_ledger').insert({
        player_id: b.player_id,
        complex_id: cx.id,
        kind: 'refund',
        amount: Number(b.price),
        method: 'saldo_favor',
        description: `Reserva cancelada: ${new Date(b.starts_at).toLocaleDateString('es-AR')} ${new Date(b.starts_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`,
        ref_booking_id: b.id,
        created_by: user!.id
      });
    }
    await supabase.from('bookings').update({ status: 'cancelada' }).eq('id', b.id);

    // Avisar al jugador que su reserva fue cancelada por el complejo
    if (b.player_id && b.type === 'reserva') {
      const when = new Date(b.starts_at).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      const court = cx?.courts?.find((c: any) => c.id === b.court_id);
      await notify({
        user_id: b.player_id, kind: 'reserva_ok',
        title: `❌ Tu reserva fue cancelada`,
        body: `${cx?.name ?? 'El complejo'} canceló tu turno del ${when} en ${court?.name ?? 'la cancha'}. Contactalos para más info.`,
        link: '/jugador/reservas'
      });
    }
    // Aviso al primero en lista de espera de ese turno
    if (b.type === 'reserva') {
      const { data: wl } = await supabase.from('booking_waitlist')
        .select('id, player_id')
        .eq('court_id', b.court_id)
        .eq('starts_at', b.starts_at)
        .is('fulfilled_at', null)
        .is('notified_at', null)
        .order('created_at').limit(1);
      const next = wl?.[0];
      if (next) {
        await supabase.from('booking_waitlist').update({ notified_at: new Date().toISOString() })
          .eq('id', next.id);
        const when = new Date(b.starts_at).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        const court = cx?.courts?.find((c: any) => c.id === b.court_id);
        await notify({
          user_id: next.player_id, kind: 'reserva_ok',
          title: `Se liberó un turno en ${cx?.name}`,
          body: `${court?.name ?? 'Cancha'} · ${when}. ¡Reservalo antes que otro!`,
          link: '/jugador/reservar'
        });
      }

      // Cargar TODA la lista de espera de ese slot para mostrar al complejo con WA pre-armado
      const { data: allWL } = await supabase.from('booking_waitlist')
        .select('id, player_id, created_at, profile:profiles!player_id(first_name, last_name, avatar_url, phone)')
        .eq('court_id', b.court_id)
        .eq('starts_at', b.starts_at)
        .is('fulfilled_at', null)
        .order('created_at');
      if ((allWL ?? []).length > 0) {
        const court = cx?.courts?.find((c: any) => c.id === b.court_id);
        setPostCancel({ court, starts: new Date(b.starts_at), wl: allWL ?? [] });
      }
    }
    setSel(null); load();
  }

  async function marcarPagado(b: any) {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('bookings').update({
      status: 'confirmada',
      payment_status: 'pagado',
      payment_confirmed_at: new Date().toISOString(),
      payment_confirmed_by: user!.id
    }).eq('id', b.id);

    // Registrar la seña cobrada. amount = monto en efectivo, no afecta saldo del jugador.
    if (b.player_id && b.price) {
      await supabase.from('player_ledger').insert({
        player_id: b.player_id,
        complex_id: cx.id,
        kind: 'seña_paid',
        amount: Number(b.price),
        method: 'transferencia',
        description: `Seña · ${new Date(b.starts_at).toLocaleDateString('es-AR')} ${new Date(b.starts_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`,
        ref_booking_id: b.id,
        created_by: user!.id
      });
    }
    if (b.player_id) {
      const when = new Date(b.starts_at).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      await notify({
        user_id: b.player_id, kind: 'reserva_ok',
        title: `Tu reserva en ${cx?.name ?? 'el complejo'} está confirmada`,
        body: `Turno del ${when}. ¡A jugar!`,
        link: '/jugador/reservas'
      });
    }
    setSel(null); load();
  }

  if (!cx) return <main className="p-8 text-white/70">Cargando…</main>;

  const pendientes = bookings.filter(b =>
    b.type === 'reserva' && b.payment_status !== 'pagado' && b.payment_status !== 'no_aplica'
  );

  return (
    <main className="px-3 py-6">
      <h1 className="font-display font-black text-xl px-2">Calendario</h1>

      {pendientes.length > 0 && (
        <section className="mx-2 mt-3 rounded-2xl bg-yellow-300/10 border border-yellow-300/40 p-3">
          <p className="font-display font-black text-yellow-300 text-sm">
            🔔 Tenés {pendientes.length} reserva{pendientes.length > 1 ? 's' : ''} esperando aprobación
          </p>
          <div className="mt-2 space-y-1">
            {pendientes.slice(0, 4).map(b => {
              const court = cx.courts.find((c: any) => c.id === b.court_id);
              const when = new Date(b.starts_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
              return (
                <button key={b.id} onClick={() => setSel({ court, t: new Date(b.starts_at), booking: b })}
                  className="w-full flex items-center gap-2 bg-white/5 rounded-lg px-2 py-2 text-left text-xs">
                  <Avatar url={b.player?.avatar_url} name={b.player?.first_name ?? b.guest_name ?? '?'} />
                  <span className="flex-1 truncate">
                    {b.player ? `${b.player.first_name} ${b.player.last_name}` : b.guest_name}
                  </span>
                  <span className="text-white/60">{court?.name} · {when}</span>
                  <span className="text-ball font-bold">→</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Selector de día — 30 días scrolleables */}
      <div className="mt-3 relative">
        <div className="flex gap-2 overflow-x-auto px-2 pb-2 scroll-smooth snap-x">
          {days.map((d, i) => {
            const isToday = i === 0;
            const isMonday = d.getDay() === 1 && i > 0;
            const monthChange = i > 0 && d.getDate() === 1;
            return (
              <div key={i} className="flex items-stretch snap-start">
                {(isMonday || monthChange) && (
                  <div className="border-l-2 border-white/10 mx-1" />
                )}
                <button onClick={() => setDayOffset(i)}
                  className={`shrink-0 rounded-xl px-3 py-2 text-center min-w-[54px] ${i === dayOffset ? 'bg-ball text-courtdark' : isToday ? 'bg-white/10 text-white border border-ball/30' : 'bg-white/5 text-white/70'}`}>
                  <p className="text-[9px] font-bold uppercase">
                    {isToday ? 'HOY' : d.toLocaleDateString('es-AR', { weekday: 'short' })}
                  </p>
                  <p className="font-display font-black text-lg leading-none">{d.getDate()}</p>
                  {monthChange && (
                    <p className="text-[9px] font-bold uppercase mt-0.5">
                      {d.toLocaleDateString('es-AR', { month: 'short' })}
                    </p>
                  )}
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-white/40 text-[10px] text-center mt-1">← desliza para ver más días →</p>
      </div>

      {/* Grilla: filas = horarios, columnas = canchas */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-separate" style={{ borderSpacing: 4, minWidth: cx.courts.length * 110 + 60 }}>
          <thead>
            <tr>
              <th className="w-14"></th>
              {cx.courts.map((c: any) => (
                <th key={c.id} className="text-ball font-display text-xs font-bold pb-1">{c.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {times.map((t, ti) => (
              <tr key={ti}>
                <td className="text-white/50 text-xs font-bold text-right pr-1 align-top pt-2">
                  {t.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </td>
                {cx.courts.map((c: any) => {
                  const b = cellBooking(c.id, t);
                  const wlCount = waitlistCounts.get(`${c.id}|${new Date(t).toISOString()}`) ?? 0;
                  if (b) {
                    const name = b.type === 'block' ? 'Bloqueado'
                      : b.player ? `${b.player.first_name} ${b.player.last_name?.[0] ?? ''}.`
                      : b.guest_name ?? 'Manual';
                    return (
                      <td key={c.id} className="relative">
                        <button onClick={() => setSel({ court: c, t, booking: b })}
                          className={`w-full rounded-lg px-1.5 py-1.5 text-left ${b.type === 'block' ? 'bg-white/10' : 'bg-grafito'}`}>
                          <span className="flex items-center gap-1.5">
                            {b.type === 'block'
                              ? <span className="text-sm">⛔</span>
                              : <Avatar url={b.player?.avatar_url} name={name} />}
                            <span className="text-[11px] font-semibold leading-tight truncate">{name}</span>
                            {b.type !== 'block' && b.payment_status !== 'pagado' && (
                              <span className="ml-auto text-[9px] bg-yellow-300 text-black rounded px-1 font-black">PEND</span>
                            )}
                          </span>
                        </button>
                        {wlCount > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); abrirWaitlistModal(c, t); }}
                            title={`${wlCount} en lista de espera — tocá para ver`}
                            className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-ball text-courtdark text-[11px] font-black flex items-center justify-center border-2 border-black shadow-lg active:scale-90 hover:scale-110 transition z-10"
                            style={{ boxShadow: '0 0 12px rgba(184,255,61,0.7), 0 0 4px rgba(184,255,61,1)' }}>
                            🎾{wlCount}
                          </button>
                        )}
                      </td>
                    );
                  }
                  const past = t < new Date();
                  return (
                    <td key={c.id} className="relative">
                      <button disabled={past} onClick={() => setSel({ court: c, t, booking: null })}
                        className={`w-full rounded-lg py-2.5 text-xs font-bold border border-dashed
                          ${past ? 'border-white/5 text-white/10' : 'border-white/20 text-white/40 active:bg-white/10'}`}>
                        {past ? '' : '+'}
                      </button>
                      {wlCount > 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); abrirWaitlistModal(c, t); }}
                          title={`${wlCount} en lista de espera — tocá para ver`}
                          className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-ball text-courtdark text-[11px] font-black flex items-center justify-center border-2 border-black shadow-lg active:scale-90 hover:scale-110 transition z-10"
                          style={{ boxShadow: '0 0 12px rgba(184,255,61,0.7), 0 0 4px rgba(184,255,61,1)' }}>
                          🎾{wlCount}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Panel de acción sobre una celda */}
      {sel && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-end lg:items-center overflow-y-auto" onClick={() => setSel(null)}>
          <div className="bg-[#0B0F16] border-2 border-white/15 rounded-t-3xl lg:rounded-2xl w-full max-w-lg mx-auto p-5 pb-10 relative shadow-2xl my-auto"
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setSel(null)} aria-label="Cerrar"
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white text-xl font-bold flex items-center justify-center active:scale-90">
              ✕
            </button>
            <p className="font-display font-black text-lg pr-12">
              {sel.court.name} · {sel.t.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
            </p>
            <p className="text-white/50 text-sm">
              {day.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>

            {sel.booking ? (
              <div className="mt-4">
                <div className="bg-white/5 rounded-2xl p-4 flex items-center gap-3">
                  {sel.booking.type === 'block'
                    ? <span className="text-2xl">⛔</span>
                    : <Avatar url={sel.booking.player?.avatar_url}
                        name={sel.booking.player?.first_name ?? sel.booking.guest_name ?? '?'} />}
                  <div>
                    <p className="font-semibold">
                      {sel.booking.type === 'block' ? 'Horario bloqueado'
                        : sel.booking.player ? `${sel.booking.player.first_name} ${sel.booking.player.last_name}`
                        : sel.booking.guest_name}
                    </p>
                    <p className="text-white/50 text-sm">
                      {sel.booking.player?.phone ?? sel.booking.guest_phone ?? ''}
                    </p>
                    {sel.booking.type !== 'block' && (
                      <>
                        <p className={`text-xs font-bold mt-1 ${sel.booking.payment_status === 'pagado' ? 'text-green-400' : 'text-yellow-300'}`}>
                          Pago: {sel.booking.payment_status === 'pagado' ? 'pagado y confirmado' : sel.booking.payment_proof_url ? 'comprobante en revision' : 'pendiente'}
                        </p>
                        {sel.booking.payment_status !== 'pagado' && sel.booking.payment_deadline_at && (
                          <p className="text-white/50 text-[11px] mt-1">
                            {new Date(sel.booking.payment_deadline_at) > new Date()
                              ? `Deadline: ${new Date(sel.booking.payment_deadline_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} hs`
                              : '⏰ Deadline vencido — se cancela sola'}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {sel.booking.payment_proof_url && (
                  <div className="mt-3">
                    <p className="label text-white/60">Comprobante</p>
                    <a href={sel.booking.payment_proof_url} target="_blank">
                      <img src={sel.booking.payment_proof_url} alt="Comprobante de pago" className="rounded-2xl w-full max-h-72 object-cover" />
                    </a>
                  </div>
                )}
                {/* Aprobar/rechazar — reservas de jugadores pendientes (con o sin comprobante) */}
                {sel.booking.type !== 'block' &&
                 sel.booking.player_id &&
                 sel.booking.payment_status !== 'pagado' && (
                  <div className="mt-3 rounded-2xl bg-yellow-500/10 border border-yellow-500/40 p-3">
                    <p className="font-display font-black text-yellow-300 text-sm">
                      ⏳ Reserva pendiente de aprobación
                    </p>
                    <p className="text-white/60 text-xs mt-1">
                      {sel.booking.payment_proof_url
                        ? 'El jugador subió un comprobante. Revisalo y aprobá si está OK.'
                        : 'El jugador todavía no subió comprobante. Podés aprobar igual (si te pagó por afuera) o rechazar.'}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button onClick={() => marcarPagado(sel.booking)}
                        className="py-3 rounded-xl bg-ball text-courtdark font-display font-black text-sm">
                        ✓ Aprobar
                      </button>
                      <button onClick={() => cancelar(sel.booking)}
                        className="py-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 font-black text-sm">
                        ✕ Rechazar
                      </button>
                    </div>
                  </div>
                )}

                {/* Cobrar restante — solo si es reserva de jugador registrado y ya está confirmada */}
                {sel.booking.type !== 'block' && sel.booking.player_id && sel.booking.status === 'confirmada' && (
                  <div className="mt-4 bg-white/5 rounded-2xl p-4">
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div>
                        <p className="text-white/40 uppercase font-black">Total turno</p>
                        <p className="font-display font-black text-white mt-1">
                          ${Number(sel.court?.price_per_slot ?? sel.booking.price ?? 0).toLocaleString('es-AR')}
                        </p>
                      </div>
                      <div>
                        <p className="text-white/40 uppercase font-black">Cobrado</p>
                        <p className="font-display font-black text-ball mt-1">${selPaid.toLocaleString('es-AR')}</p>
                      </div>
                      <div>
                        <p className="text-white/40 uppercase font-black">Restante</p>
                        <p className="font-display font-black text-yellow-300 mt-1">
                          ${Math.max(0, Number(sel.court?.price_per_slot ?? sel.booking.price ?? 0) - selPaid).toLocaleString('es-AR')}
                        </p>
                      </div>
                    </div>

                    {!cobro.show ? (
                      <button onClick={() => {
                        const rest = Math.max(0, Number(sel.court?.price_per_slot ?? sel.booking.price ?? 0) - selPaid);
                        setCobro({ show: true, monto: String(rest || ''), metodo: 'efectivo' });
                      }} className="mt-3 w-full py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-black text-sm">
                        💰 Cobrar restante en cancha
                      </button>
                    ) : (
                      <div className="mt-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => setCobro({ ...cobro, metodo: 'efectivo' })}
                            className={`py-2 rounded-lg text-sm font-black border ${cobro.metodo === 'efectivo' ? 'bg-ball text-courtdark border-ball' : 'bg-white/5 border-white/10 text-white/70'}`}>
                            💵 Efectivo
                          </button>
                          <button onClick={() => setCobro({ ...cobro, metodo: 'transferencia' })}
                            className={`py-2 rounded-lg text-sm font-black border ${cobro.metodo === 'transferencia' ? 'bg-ball text-courtdark border-ball' : 'bg-white/5 border-white/10 text-white/70'}`}>
                            🏦 Transferencia
                          </button>
                        </div>
                        <input type="number" inputMode="decimal"
                          className="input" placeholder="Monto a cobrar"
                          value={cobro.monto} onChange={e => setCobro({ ...cobro, monto: e.target.value })} />
                        <p className="text-white/40 text-[10px]">Puede ser parcial. Podés cobrar el resto con otro método después.</p>
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => setCobro({ show: false, monto: '', metodo: 'efectivo' })}
                            className="py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 text-sm">
                            Cancelar
                          </button>
                          <button onClick={cobrarRestante}
                            className="py-2 rounded-lg bg-ball text-courtdark font-black text-sm">
                            ✓ Confirmar cobro
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button onClick={() => cancelar(sel.booking)}
                  className="mt-3 w-full py-3 rounded-xl border border-red-400/40 text-red-400 font-semibold">
                  {sel.booking.type === 'block' ? 'Quitar bloqueo' : 'Cancelar reserva'}
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {/* Lista de espera existente (si hay) */}
                {selWaitlist.length > 0 && (
                  <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-2xl p-3">
                    <p className="text-yellow-300 font-black text-sm">
                      ⏳ {selWaitlist.length} jugador{selWaitlist.length > 1 ? 'es' : ''} en lista de espera
                    </p>
                    <div className="mt-2 space-y-1">
                      {selWaitlist.map((w: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          {w.profile?.avatar_url
                            ? <img src={w.profile.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                            : <span className="w-6 h-6 rounded-full bg-grafito flex items-center justify-center text-xs font-black">
                                {w.profile?.first_name?.[0] ?? '?'}
                              </span>}
                          <span className="flex-1 truncate">
                            {w.profile?.first_name} {w.profile?.last_name}
                          </span>
                          {w.profile?.phone && (
                            <a href={`https://wa.me/${w.profile.phone.replace(/\D/g, '')}?text=${encodeURIComponent('Hola, nos contactamos de ' + (cx?.name ?? '') + ' porque hay un lugar disponible!')}`}
                              target="_blank" rel="noopener"
                              className="text-[#25D366] text-xs font-black">
                              💬
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-white/70 text-sm font-semibold">Cargar reserva manual:</p>
                <input className="input" placeholder="Nombre de quien reserva"
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <input className="input" placeholder="Teléfono (opcional)" inputMode="tel"
                  value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />

                {/* Repetir por N semanas */}
                <div>
                  <label className="label text-white/60 text-xs">🔁 Repetir semanalmente</label>
                  <div className="grid grid-cols-4 gap-1">
                    {([1, 2, 3, 4] as const).map(n => (
                      <button key={n} onClick={() => setForm({ ...form, repeat: n })}
                        className={`py-2 rounded-lg text-sm font-black border ${form.repeat === n ? 'bg-ball text-courtdark border-ball' : 'bg-white/5 border-white/10 text-white/70'}`}>
                        {n === 1 ? 'Solo hoy' : `${n} sem.`}
                      </button>
                    ))}
                  </div>
                  {form.repeat > 1 && (
                    <p className="text-white/40 text-[11px] mt-1">
                      Se creará {form.repeat} reservas: hoy + los próximos {form.repeat - 1} {form.repeat - 1 === 1 ? 'lunes/martes/etc' : 'mismos días'} de las siguientes semanas.
                    </p>
                  )}
                </div>

                {/* Pago */}
                <div>
                  <label className="label text-white/60 text-xs">💰 Pago</label>
                  <div className="grid grid-cols-3 gap-1">
                    <button onClick={() => setForm({ ...form, payKind: 'sin_pago' })}
                      className={`py-2 rounded-lg text-xs font-black border ${form.payKind === 'sin_pago' ? 'bg-ball text-courtdark border-ball' : 'bg-white/5 border-white/10 text-white/70'}`}>
                      Sin pago
                    </button>
                    <button onClick={() => setForm({ ...form, payKind: 'sena' })}
                      className={`py-2 rounded-lg text-xs font-black border ${form.payKind === 'sena' ? 'bg-ball text-courtdark border-ball' : 'bg-white/5 border-white/10 text-white/70'}`}>
                      Seña
                    </button>
                    <button onClick={() => setForm({ ...form, payKind: 'total' })}
                      className={`py-2 rounded-lg text-xs font-black border ${form.payKind === 'total' ? 'bg-ball text-courtdark border-ball' : 'bg-white/5 border-white/10 text-white/70'}`}>
                      Total
                    </button>
                  </div>
                  {form.payKind !== 'sin_pago' && (
                    <>
                      <div className="grid grid-cols-3 gap-1 mt-2">
                        {(['efectivo', 'transferencia', 'mp'] as const).map(m => (
                          <button key={m} onClick={() => setForm({ ...form, payMethod: m })}
                            className={`py-2 rounded-lg text-xs font-black border ${form.payMethod === m ? 'bg-ball/20 border-ball/60 text-ball' : 'bg-white/5 border-white/10 text-white/60'}`}>
                            {m === 'efectivo' ? '💵 Efvo' : m === 'transferencia' ? '🏦 Transf' : '💳 MP'}
                          </button>
                        ))}
                      </div>
                      <input type="number" inputMode="decimal" className="input mt-2"
                        placeholder={`Monto${form.payKind === 'sena' && sel.court.deposit_amount ? ` (default $${sel.court.deposit_amount})` : ''}`}
                        value={form.payAmount}
                        onChange={e => setForm({ ...form, payAmount: e.target.value })} />
                    </>
                  )}
                </div>

                <button onClick={() => accion('manual')} className="btn-ball w-full">
                  Guardar reserva{form.repeat > 1 ? ` (x${form.repeat})` : ''}
                </button>
                <button onClick={() => accion('block')}
                  className="w-full py-3 rounded-xl border border-white/20 font-semibold text-white/70">
                  ⛔ Bloquear este horario
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: ver waitlist de un slot al tocar el botón verde 🎾 */}
      {waitlistModal && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-end lg:items-center overflow-y-auto"
          onClick={() => setWaitlistModal(null)}>
          <div className="bg-[#0B0F16] border-2 border-ball/50 rounded-t-3xl lg:rounded-2xl w-full max-w-lg mx-auto p-5 pb-10"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-ball text-xs font-black uppercase">🎾 Lista de espera</p>
                <p className="font-display font-black text-lg mt-1">{waitlistModal.wl.length} jugador{waitlistModal.wl.length !== 1 ? 'es' : ''} esperando</p>
                <p className="text-white/60 text-sm">
                  {waitlistModal.court?.name} · {waitlistModal.starts.toLocaleString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} hs
                </p>
              </div>
              <button onClick={() => setWaitlistModal(null)}
                className="w-9 h-9 rounded-full bg-white/10 text-white font-bold shrink-0">✕</button>
            </div>

            {waitlistModal.wl.length === 0 ? (
              <p className="text-white/50 text-center py-6 mt-3">No hay nadie en espera ahora.</p>
            ) : (
              <ul className="mt-4 space-y-2 max-h-[60vh] overflow-y-auto">
                {waitlistModal.wl.map((w: any, i: number) => {
                  const p = w.profile;
                  const days = Math.floor((Date.now() - new Date(w.created_at).getTime()) / (1000 * 60 * 60 * 24));
                  const whenText = waitlistModal.starts.toLocaleString('es-AR', {
                    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
                  });
                  const daysText = days === 0 ? 'hoy'
                    : days === 1 ? 'ayer'
                    : `hace ${days} días`;
                  const msg =
                    `¡Hola ${p?.first_name || ''}! Se liberó la cancha ${waitlistModal.court?.name} el ${whenText} hs y notamos que estás en lista de espera desde ${daysText}. ¿Querés tomar el turno?\n\n` +
                    `Respondenos a la brevedad para poder asignártela.\n\n` +
                    `Muchas gracias,\n${cx?.name ?? 'Complejo'}`;
                  const wa = p?.phone
                    ? `https://wa.me/${p.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`
                    : null;
                  return (
                    <li key={w.id} className="bg-white/5 rounded-xl p-3">
                      <div className="flex items-center gap-3">
                        <span className="font-display font-black text-ball w-6 text-center">{i + 1}</span>
                        {p?.avatar_url
                          ? <img src={p.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover border-2 border-ball/40" />
                          : <span className="w-11 h-11 rounded-full bg-grafito flex items-center justify-center font-black">
                              {p?.first_name?.[0] ?? '?'}
                            </span>}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{p?.first_name} {p?.last_name}</p>
                          <p className="text-white/50 text-xs truncate">
                            @{p?.username ?? 'sin_usuario'}
                          </p>
                          <p className="text-white/40 text-[11px]">
                            En espera {daysText}{p?.phone ? ` · 📱 ${p.phone}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {p?.username ? (
                          <a href={`/u/${p.username}`} target="_blank"
                            className="py-2 rounded-lg bg-ball/10 border border-ball/40 text-ball text-xs font-black text-center active:scale-95">
                            👤 Ver perfil
                          </a>
                        ) : (
                          <span className="py-2 rounded-lg bg-white/5 text-white/30 text-xs text-center">Sin perfil</span>
                        )}
                        {wa ? (
                          <a href={wa} target="_blank" rel="noopener"
                            className="py-2 rounded-lg bg-[#25D366] text-white text-xs font-black text-center active:scale-95">
                            💬 WhatsApp
                          </a>
                        ) : (
                          <span className="py-2 rounded-lg bg-white/5 text-white/30 text-xs text-center">Sin celular</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Modal post-cancelación: mostrar lista de espera + WA con mensaje pre-armado */}
      {postCancel && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-end lg:items-center overflow-y-auto"
          onClick={() => setPostCancel(null)}>
          <div className="bg-[#0B0F16] border-2 border-yellow-500/40 rounded-t-3xl lg:rounded-2xl w-full max-w-lg mx-auto p-5 pb-10"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-yellow-300 text-xs font-black uppercase">💡 Reserva cancelada</p>
                <p className="font-display font-black text-lg mt-1">Tenés {postCancel.wl.length} en lista de espera</p>
                <p className="text-white/60 text-sm mt-1">
                  {postCancel.court?.name} · {postCancel.starts.toLocaleString('es-AR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} hs
                </p>
              </div>
              <button onClick={() => setPostCancel(null)}
                className="w-9 h-9 rounded-full bg-white/10 text-white font-bold shrink-0">✕</button>
            </div>

            <p className="text-white/50 text-xs mt-3">
              Contactá a los jugadores en orden — el primero en anotarse tiene prioridad. Tocá el botón de WhatsApp para enviar el mensaje pre-armado.
            </p>

            <ul className="mt-3 space-y-2 max-h-[55vh] overflow-y-auto">
              {postCancel.wl.map((w: any, i: number) => {
                const p = w.profile;
                const inWaitSince = new Date(w.created_at);
                const days = Math.floor((Date.now() - inWaitSince.getTime()) / (1000 * 60 * 60 * 24));
                const whenText = postCancel.starts.toLocaleString('es-AR', {
                  weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
                });
                const daysText = days === 0 ? 'hoy'
                  : days === 1 ? 'ayer'
                  : `hace ${days} días`;
                const msg =
                  `¡Hola ${p?.first_name || ''}! Se liberó la cancha ${postCancel.court?.name} el ${whenText} hs y notamos que estás en lista de espera desde ${daysText}. ¿Querés tomar el turno?\n\n` +
                  `Respondenos a la brevedad para poder asignártela.\n\n` +
                  `Muchas gracias,\n${cx?.name ?? 'Complejo'}`;
                const wa = p?.phone
                  ? `https://wa.me/${p.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`
                  : null;
                return (
                  <li key={w.id} className="bg-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-3">
                      <span className="font-display font-black text-yellow-300 w-6 text-center">{i + 1}</span>
                      {p?.avatar_url
                        ? <img src={p.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                        : <span className="w-10 h-10 rounded-full bg-grafito flex items-center justify-center font-black">
                            {p?.first_name?.[0] ?? '?'}
                          </span>}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{p?.first_name} {p?.last_name}</p>
                        <p className="text-white/40 text-[11px]">
                          En espera {daysText} {p?.phone ? `· 📱 ${p.phone}` : '· sin celular'}
                        </p>
                      </div>
                      {wa ? (
                        <a href={wa} target="_blank" rel="noopener"
                          className="bg-[#25D366] text-white text-xs font-black px-3 py-2 rounded-lg active:scale-95 shrink-0">
                          💬 Enviar WA
                        </a>
                      ) : (
                        <span className="text-white/30 text-xs font-bold shrink-0">Sin celular</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </main>
  );
}
