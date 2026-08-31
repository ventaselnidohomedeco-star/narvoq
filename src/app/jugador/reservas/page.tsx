'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { notify } from '@/lib/notify';

function ReservasInner() {
  const params = useSearchParams();
  const initial = (params.get('tab') as any) || 'proximas';
  const [tab, setTab] = useState<'proximas' | 'cargar' | 'historial'>(initial);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [toLoad, setToLoad] = useState<any[]>([]);
  const [historial, setHistorial] = useState<any[]>([]);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: mp } = await supabase.from('match_players')
      .select(`match:matches(id, status, tournament_match_id,
        booking:bookings(id, court_id, starts_at, ends_at, price, status, payment_status, payment_proof_url,
          court:courts(name, photo_url, price_per_slot, complex:complexes(id, name, address, cancel_hours, payment_alias, payment_cbu, payment_holder, payment_bank, payment_transfer_enabled, payment_cash_enabled))),
        result:results(id, status, sets, winner_team),
        players:match_players(player_id, team, profile:profiles!player_id(username, first_name, last_name, avatar_url)))`)
      .eq('player_id', user.id).limit(100);

    const matches = (mp ?? []).map((r: any) => r.match).filter((m: any) => m?.booking);

    // Cargar pagos hechos por booking (para mostrar cuánto pagó, método, restante)
    const bookingIds = matches.map((m: any) => m.booking.id);
    if (bookingIds.length > 0) {
      const { data: ledger } = await supabase.from('player_ledger')
        .select('ref_booking_id, method, amount, kind')
        .in('kind', ['seña_paid', 'restante_paid'])
        .in('ref_booking_id', bookingIds);
      const byBooking = new Map<string, { paid: number; methods: any[] }>();
      (ledger ?? []).forEach((r: any) => {
        const b = byBooking.get(r.ref_booking_id) ?? { paid: 0, methods: [] };
        b.paid += Math.abs(Number(r.amount ?? 0));
        b.methods.push({ method: r.method, amount: Math.abs(Number(r.amount)), kind: r.kind });
        byBooking.set(r.ref_booking_id, b);
      });
      matches.forEach((m: any) => {
        const p = byBooking.get(m.booking.id);
        m.booking.paid = p?.paid ?? 0;
        m.booking.methods = p?.methods ?? [];
      });
    }
    const now = new Date();
    setUpcoming(matches
      .filter((m: any) => new Date(m.booking.starts_at) > now && m.booking.status !== 'cancelada')
      .sort((a: any, b: any) => a.booking.starts_at.localeCompare(b.booking.starts_at)));
    setToLoad(matches
      .filter((m: any) => new Date(m.booking.ends_at ?? m.booking.starts_at) < now
        && m.booking.status !== 'cancelada'
        && (!m.result || m.result.length === 0))
      .sort((a: any, b: any) => b.booking.starts_at.localeCompare(a.booking.starts_at)));
    setHistorial(matches
      .filter((m: any) => m.result && m.result.length > 0)
      .sort((a: any, b: any) => b.booking.starts_at.localeCompare(a.booking.starts_at)));
  }
  useEffect(() => { load(); }, []);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('es-AR', { weekday: 'long', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });

  async function cancelar(m: any, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    const horas = (new Date(m.booking.starts_at).getTime() - Date.now()) / 3600000;
    const limite = m.booking.court.complex.cancel_hours ?? 0;
    if (horas < limite)
      return alert(`Este complejo solo permite cancelar hasta ${limite} hs antes del turno. Comunicate directamente con el complejo.`);
    if (!confirm('Cancelar esta reserva? El turno queda libre para otros jugadores.')) return;
    await supabase.from('bookings').update({ status: 'cancelada' }).eq('id', m.booking.id);
    await supabase.from('matches').update({ status: 'cancelada' }).eq('id', m.id);
    // Aviso al primero en lista de espera
    const { data: wl } = await supabase.from('booking_waitlist')
      .select('id, player_id')
      .eq('court_id', m.booking.court_id)
      .eq('starts_at', m.booking.starts_at)
      .is('fulfilled_at', null).is('notified_at', null)
      .order('created_at').limit(1);
    const next = wl?.[0];
    if (next) {
      await supabase.from('booking_waitlist').update({ notified_at: new Date().toISOString() })
        .eq('id', next.id);
      const when = new Date(m.booking.starts_at).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      await notify({
        user_id: next.player_id, kind: 'reserva_ok',
        title: `Se liberó un turno en ${m.booking.court.complex.name}`,
        body: `${m.booking.court.name} · ${when}. ¡Reservalo antes que otro!`,
        link: '/jugador/reservar'
      });
    }
    setUpcoming(upcoming.filter((x: any) => x.id !== m.id));
  }

  const paymentText = (b: any) => b.payment_status === 'pagado'
    ? 'Pago confirmado'
    : b.payment_proof_url ? 'Comprobante en revision' : 'Pago pendiente';

  const Avatar = ({ url, name }: any) => url
    ? <img src={url} alt="" className="w-8 h-8 rounded-full object-cover" />
    : <span className="w-8 h-8 rounded-full bg-grafito text-ball text-xs font-display font-black flex items-center justify-center">
        {name?.[0]?.toUpperCase() ?? '?'}
      </span>;

  const HistorialCard = ({ m }: any) => {
    const result = m.result?.[0];
    const players = m.players ?? [];
    const team1 = players.filter((p: any) => p.team === 1);
    const team2 = players.filter((p: any) => p.team === 2);
    const isTorneo = !!m.tournament_match_id;
    const validado = result?.status === 'validado';
    const score = result?.sets?.map((s: any) => `${s.t1}-${s.t2}`).join(' / ');
    return (
      <Link href={`/partido/${m.id}`} className="card flex flex-col gap-2">
        <div className="flex justify-between items-start">
          <div>
            <p className="font-display font-bold">{m.booking.court.complex.name}</p>
            <p className="text-white/60 text-sm">{fmt(m.booking.starts_at)} hs</p>
          </div>
          <span className={`text-[10px] font-black px-2 py-1 rounded ${isTorneo ? 'bg-ball/20 text-ball' : 'bg-white/10 text-white/60'}`}>
            {isTorneo ? 'TORNEO' : 'AMISTOSO'}
          </span>
        </div>
        <div className="grid grid-cols-3 items-center gap-2">
          <div className="flex flex-col gap-1 items-start">
            {team1.map((p: any) => (
              <span key={p.player_id} className="flex items-center gap-1.5">
                <Avatar url={p.profile?.avatar_url} name={p.profile?.first_name} />
                <span className="text-xs font-bold truncate">{p.profile?.first_name} {p.profile?.last_name?.[0] ?? ''}.</span>
              </span>
            ))}
          </div>
          <p className="text-ball font-display font-black text-lg text-center">{score ?? '—'}</p>
          <div className="flex flex-col gap-1 items-end">
            {team2.map((p: any) => (
              <span key={p.player_id} className="flex items-center gap-1.5">
                <span className="text-xs font-bold truncate">{p.profile?.first_name} {p.profile?.last_name?.[0] ?? ''}.</span>
                <Avatar url={p.profile?.avatar_url} name={p.profile?.first_name} />
              </span>
            ))}
          </div>
        </div>
        <p className="text-white/40 text-[10px] text-center">
          {isTorneo ? (validado ? 'Puntos sumados al ranking' : 'Pendiente de validación') : 'Amistoso · no suma al ranking'}
        </p>
      </Link>
    );
  };

  const Card = ({ m, cta, cancelable }: any) => {
    const total = Number(m.booking.court?.price_per_slot ?? m.booking.price ?? 0);
    const paid = Number(m.booking.paid ?? 0);
    const remaining = Math.max(0, total - paid);
    const methods = m.booking.methods ?? [];
    const cx = m.booking.court.complex;
    return (
      <div className="card !p-0 overflow-hidden">
        <Link href={`/partido/${m.id}`} className="flex">
          {m.booking.court.photo_url
            ? <img src={m.booking.court.photo_url} alt="" className="w-24 object-cover shrink-0" />
            : <span className="w-24 bg-grafito/10 flex items-center justify-center text-2xl shrink-0">PA</span>}
          <div className="p-3 flex-1 min-w-0">
            <p className="font-display font-bold truncate">{cx.name}</p>
            <p className="text-white/50 text-sm">{m.booking.court.name} - {fmt(m.booking.starts_at)} hs</p>
            <p className={`text-xs font-black mt-1 ${m.booking.payment_status === 'pagado' ? 'text-green-400' : m.booking.payment_proof_url ? 'text-yellow-300' : 'text-red-300'}`}>
              {paymentText(m.booking)}
            </p>
            <p className="text-ball text-sm font-bold mt-1">{cta}</p>
          </div>
        </Link>

        {/* Detalle de pagos si hay algún cobro */}
        {(paid > 0 || total > 0) && (
          <div className="border-t border-white/10 p-3 bg-white/[0.02]">
            <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
              <div>
                <p className="text-white/40 uppercase font-black">Total</p>
                <p className="font-display font-black text-white text-sm mt-0.5">${total.toLocaleString('es-AR')}</p>
              </div>
              <div>
                <p className="text-white/40 uppercase font-black">Pagaste</p>
                <p className="font-display font-black text-ball text-sm mt-0.5">${paid.toLocaleString('es-AR')}</p>
              </div>
              <div>
                <p className="text-white/40 uppercase font-black">Restante</p>
                <p className={`font-display font-black text-sm mt-0.5 ${remaining > 0 ? 'text-yellow-300' : 'text-green-400'}`}>
                  ${remaining.toLocaleString('es-AR')}
                </p>
              </div>
            </div>

            {/* Métodos usados */}
            {methods.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {methods.map((m: any, i: number) => {
                  const label = m.method === 'efectivo' ? '💵'
                    : m.method === 'transferencia' ? '🏦'
                    : m.method === 'mp' ? '💳 MP' : m.method;
                  return (
                    <span key={i} className="text-[10px] font-bold bg-white/10 rounded px-2 py-0.5">
                      {label} ${m.amount.toLocaleString('es-AR')} <span className="text-white/40">({m.kind === 'seña_paid' ? 'seña' : 'restante'})</span>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Info de cómo pagar el restante */}
            {remaining > 0 && (
              <div className="mt-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-2 text-[11px] text-white/80">
                <p className="font-black text-yellow-300">💰 Falta pagar ${remaining.toLocaleString('es-AR')}</p>
                {cx.payment_cash_enabled !== false && (
                  <p className="mt-0.5">💵 <b>Efectivo en cancha</b> cuando llegues.</p>
                )}
                {cx.payment_transfer_enabled !== false && cx.payment_alias && (
                  <p className="mt-0.5">🏦 <b>Transferencia:</b> {cx.payment_alias}
                    {cx.payment_cbu && <> · CBU {cx.payment_cbu}</>}
                    {cx.payment_holder && <> · {cx.payment_holder}</>}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {cancelable && (
          <button onClick={e => cancelar(m, e)}
            className="border-t border-white/10 w-full py-2 text-xs font-bold text-red-500 hover:bg-red-500/5">
            Cancelar reserva
          </button>
        )}
      </div>
    );
  };

  return (
    <main className="px-5 pt-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-black text-2xl">Reservas</h1>
        <Link href="/jugador/reservar" className="btn-ball text-sm">+ Nueva reserva</Link>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {[
          { k: 'proximas', l: `Próximas`, n: upcoming.length },
          { k: 'cargar', l: `Cargar resultado`, n: toLoad.length },
          { k: 'historial', l: `Historial`, n: historial.length }
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as any)}
            className={`shrink-0 rounded-full px-5 py-3 text-sm font-black transition min-h-[48px]
              ${tab === t.k
                ? 'bg-ball text-courtdark'
                : 'bg-white/5 text-white/70 border border-white/10'}`}>
            {t.l} <span className="opacity-70 font-bold">· {t.n}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3 pb-8">
        {tab === 'proximas' && (upcoming.length
          ? upcoming.map(m => <Card key={m.id} m={m} cta="Ver partido e invitar" cancelable />)
          : <div className="card text-center py-10">
              <p className="text-white/50 mt-2">No tenes reservas proximas.</p>
              <Link href="/jugador/reservar" className="btn-ball inline-block mt-3">Reservar cancha</Link>
            </div>)}
        {tab === 'historial' && (historial.length
          ? historial.map(m => <HistorialCard key={m.id} m={m} />)
          : <div className="card text-center py-10">
              <p className="text-white/50 mt-2">Todavía no tenés partidos con resultado cargado.</p>
            </div>)}
        {tab === 'cargar' && (toLoad.length
          ? toLoad.map(m => <Card key={m.id} m={m} cta="Cargar resultado" />)
          : <div className="card text-center py-10">
              <p className="text-white/50 mt-2">No tenes resultados pendientes de cargar.</p>
            </div>)}
      </div>
    </main>
  );
}

export default function Reservas() {
  return (
    <Suspense fallback={<main className="p-8 text-white/50">Cargando…</main>}>
      <ReservasInner />
    </Suspense>
  );
}
