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
  const [sel, setSel] = useState<any>(null);           // celda seleccionada
  const [form, setForm] = useState({ name: '', phone: '' });

  const day = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + dayOffset);
    return d;
  }, [dayOffset]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
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
    const to = new Date(day); to.setDate(to.getDate() + 1);
    const { data, error } = await supabase.from('bookings')
      .select('*, player:profiles!player_id(first_name, last_name, phone, avatar_url)')
      .in('court_id', complex.courts.map((c: any) => c.id))
      .gte('starts_at', day.toISOString()).lt('starts_at', to.toISOString())
      .neq('status', 'cancelada');
    if (error) console.error('Error cargando bookings:', error);
    setBookings(data ?? []);
  }
  useEffect(() => { if (cx || dayOffset >= 0) load(); }, [dayOffset]); // eslint-disable-line

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
    const starts = sel.t; const ends = new Date(starts.getTime() + cx.slot_minutes * 60000);
    const { error } = await supabase.from('bookings').insert({
      court_id: sel.court.id,
      type: tipo === 'block' ? 'block' : 'reserva',
      status: 'confirmada',
      payment_status: tipo === 'manual' ? 'pagado' : 'no_aplica',
      starts_at: starts.toISOString(), ends_at: ends.toISOString(),
      price: tipo === 'manual' ? sel.court.price_per_slot : null,
      guest_name: tipo === 'manual' ? (form.name || 'Reserva manual') : null,
      guest_phone: tipo === 'manual' ? form.phone : null,
      notes: tipo === 'block' ? 'Bloqueo' : null
    });
    if (error) alert('No se pudo guardar. ¿Ejecutaste update-02-panel.sql en Supabase?');
    setSel(null); setForm({ name: '', phone: '' }); load();
  }

  async function cancelar(b: any) {
    if (!confirm('¿Cancelar esta reserva?')) return;
    await supabase.from('bookings').update({ status: 'cancelada' }).eq('id', b.id);
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

      {/* Selector de día */}
      <div className="mt-3 flex gap-2 overflow-x-auto px-2 pb-1">
        {days.map((d, i) => (
          <button key={i} onClick={() => setDayOffset(i)}
            className={`shrink-0 rounded-xl px-3 py-2 text-center ${i === dayOffset ? 'bg-ball text-courtdark' : 'bg-white/5 text-white/70'}`}>
            <p className="text-[10px] font-bold uppercase">{d.toLocaleDateString('es-AR', { weekday: 'short' })}</p>
            <p className="font-display font-black text-lg leading-none">{d.getDate()}</p>
          </button>
        ))}
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
                  if (b) {
                    const name = b.type === 'block' ? 'Bloqueado'
                      : b.player ? `${b.player.first_name} ${b.player.last_name?.[0] ?? ''}.`
                      : b.guest_name ?? 'Manual';
                    return (
                      <td key={c.id}>
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
                      </td>
                    );
                  }
                  const past = t < new Date();
                  return (
                    <td key={c.id}>
                      <button disabled={past} onClick={() => setSel({ court: c, t, booking: null })}
                        className={`w-full rounded-lg py-2.5 text-xs font-bold border border-dashed
                          ${past ? 'border-white/5 text-white/10' : 'border-white/20 text-white/40 active:bg-white/10'}`}>
                        {past ? '' : '+'}
                      </button>
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
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={() => setSel(null)}>
          <div className="bg-grafitodark border-t border-white/10 rounded-t-3xl w-full max-w-lg mx-auto p-5 pb-10 relative"
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
                      <p className={`text-xs font-bold mt-1 ${sel.booking.payment_status === 'pagado' ? 'text-green-400' : 'text-yellow-300'}`}>
                        Pago: {sel.booking.payment_status === 'pagado' ? 'pagado y confirmado' : sel.booking.payment_proof_url ? 'comprobante en revision' : 'pendiente'}
                      </p>
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
                {sel.booking.type !== 'block' && sel.booking.payment_status !== 'pagado' && sel.booking.payment_proof_url && (
                  <button onClick={() => marcarPagado(sel.booking)}
                    className="mt-3 w-full py-3 rounded-xl bg-ball text-courtdark font-display font-black">
                    Marcar pagado y confirmar reserva
                  </button>
                )}
                <button onClick={() => cancelar(sel.booking)}
                  className="mt-3 w-full py-3 rounded-xl border border-red-400/40 text-red-400 font-semibold">
                  {sel.booking.type === 'block' ? 'Quitar bloqueo' : 'Cancelar reserva'}
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-white/70 text-sm font-semibold">Cargar reserva manual (WhatsApp / mostrador):</p>
                <input className="input" placeholder="Nombre de quien reserva"
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <input className="input" placeholder="Teléfono (opcional)" inputMode="tel"
                  value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                <button onClick={() => accion('manual')} className="btn-ball w-full">Guardar reserva</button>
                <button onClick={() => accion('block')}
                  className="w-full py-3 rounded-xl border border-white/20 font-semibold text-white/70">
                  ⛔ Bloquear este horario
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
