'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { buildSlots, type Slot } from '@/lib/slots';
import type { Complex, Court } from '@/lib/types';
import { uploadImage } from '@/lib/upload';
import { ruleFor, priceWithRule, type OffpeakRule } from '@/lib/offpeak';
import { notify } from '@/lib/notify';

export default function ReservarPage() {
  return (
    <Suspense fallback={<main className="p-8 text-white/60">Cargando…</main>}>
      <Reservar />
    </Suspense>
  );
}

function Reservar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Params opcionales para pre-selección desde el Buscador Inteligente:
  // ?complex=<id>&court=<id>&date=YYYY-MM-DD&time=HH:MM
  const paramComplex = searchParams?.get('complex');
  const paramCourt = searchParams?.get('court');
  const paramDate = searchParams?.get('date');
  const paramTime = searchParams?.get('time');
  const [cities, setCities] = useState<any[]>([]);
  const [cityId, setCityId] = useState('');
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [myLoc, setMyLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locStatus, setLocStatus] = useState<'idle' | 'loading' | 'granted' | 'denied'>('idle');
  const [nearbyComplexes, setNearbyComplexes] = useState<any[]>([]);
  const [complex, setComplex] = useState<Complex | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [court, setCourt] = useState<Court | null>(null);
  const [date, setDate] = useState(() => paramDate || new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<any>(null);
  const [methodChooser, setMethodChooser] = useState<Slot | null>(null);   // slot esperando elección de método
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [offpeakRules, setOffpeakRules] = useState<OffpeakRule[]>([]);
  const [myWaitlist, setMyWaitlist] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [isPremium, setIsPremium] = useState(false);

  // Free: hasta 5 días de anticipación. Premium: hasta 15 días.
  const MAX_DAYS = isPremium ? 15 : 5;
  const maxDate = (() => {
    const d = new Date(); d.setDate(d.getDate() + MAX_DAYS);
    return d.toISOString().slice(0, 10);
  })();

  useEffect(() => {
    supabase.from('cities').select('*').eq('active', true).then(({ data }) => setCities(data ?? []));
    // Auto-liberar slots de reservas con deadline vencido (para que aparezcan
    // como libres al jugador). Es idempotente y barato.
    supabase.rpc('cancel_expired_bookings').then(() => {});
  }, []);
  useEffect(() => { (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('profiles').select('is_premium').eq('id', user.id).maybeSingle();
    setIsPremium(!!data?.is_premium);
  })(); }, []);

  useEffect(() => {
    if (!cityId) return setComplexes([]);
    // Solo complejos APROBADOS por admin (status='active') y operativos (active=true)
    supabase.from('complexes').select('*')
      .eq('city_id', cityId).eq('active', true).eq('status', 'active')
      .then(({ data }) => setComplexes(data ?? []));
  }, [cityId]);

  // Al aceptar geoloc, traemos TODOS los complejos con lat/lng y los ordenamos por distancia
  async function activarUbicacion() {
    setLocStatus('loading');
    try {
      const { getMyLocation, distanceKm } = await import('@/lib/geo');
      const loc = await getMyLocation();
      setMyLoc(loc);
      setLocStatus('granted');
      const { data } = await supabase.from('complexes').select('*')
        .eq('active', true).eq('status', 'active')
        .not('lat', 'is', null).not('lng', 'is', null);
      const sorted = (data ?? []).map((c: any) => ({
        ...c, distanceKm: distanceKm(loc, { lat: c.lat, lng: c.lng })
      })).sort((a: any, b: any) => a.distanceKm - b.distanceKm).slice(0, 20);
      setNearbyComplexes(sorted);
    } catch {
      setLocStatus('denied');
    }
  }

  useEffect(() => {
    if (!complex) { setCourts([]); setOffpeakRules([]); return; }
    supabase.from('courts').select('*').eq('complex_id', complex.id).eq('active', true)
      .then(({ data }) => {
        setCourts(data ?? []);
        // Pre-seleccionar cancha si vino por deep-link del Buscador
        const preCourt = paramCourt ? (data ?? []).find((c: any) => c.id === paramCourt) : null;
        setCourt(preCourt ?? null);
      });
    supabase.from('offpeak_rules').select('*').eq('complex_id', complex.id).eq('active', true)
      .then(({ data }) => setOffpeakRules(data ?? []));
  }, [complex, paramCourt]);

  // Pre-selección del complejo por deep-link (una sola vez, al cargar cities/complexes)
  useEffect(() => {
    if (!paramComplex || complex) return;
    (async () => {
      const { data } = await supabase.from('complexes').select('*')
        .eq('id', paramComplex).eq('status', 'active').maybeSingle();
      if (data) {
        if (data.city_id) setCityId(data.city_id);
        setComplex(data as any);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramComplex]);

  // Auto-scroll al slot buscado cuando ya cargaron los slots
  useEffect(() => {
    if (!paramTime || !court || slots.length === 0) return;
    const target = document.getElementById(`slot-${paramTime}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('ring-4', 'ring-ball');
      setTimeout(() => target.classList.remove('ring-4', 'ring-ball'), 3000);
    }
  }, [paramTime, court, slots]);

  // Validar formato de fecha; si el usuario tipeó algo inválido no crashear.
  const dateIsValid = (() => {
    const d = new Date(date + 'T00:00:00');
    return !isNaN(d.getTime());
  })();

  useEffect(() => {
    if (!court) { setMyWaitlist([]); return; }
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (!dateIsValid) return;
      const from = new Date(date + 'T00:00:00');
      const to = new Date(from); to.setDate(to.getDate() + 1);
      const { data } = await supabase.from('booking_waitlist')
        .select('*').eq('court_id', court.id).eq('player_id', user.id)
        .gte('starts_at', from.toISOString()).lt('starts_at', to.toISOString())
        .is('fulfilled_at', null);
      setMyWaitlist(data ?? []);
    })();
  }, [court, date]);

  useEffect(() => {
    if (!court || !complex) return setSlots([]);
    if (!dateIsValid) return setSlots([]);
    const day = new Date(date + 'T00:00:00');
    const from = new Date(day); const to = new Date(day); to.setDate(to.getDate() + 1);
    supabase.from('bookings').select('*')
      .eq('court_id', court.id)
      .gte('starts_at', from.toISOString()).lt('starts_at', to.toISOString())
      .then(({ data }) => setSlots(buildSlots(day, complex.open_time, complex.close_time, complex.slot_minutes, data ?? [])));
  }, [court, date, complex]);

  async function reservar(slot: Slot) {
    if (!court || saving) return;
    // Validar límite de días de anticipación (protección extra por si el
    // browser permite tipear fecha fuera del max)
    const daysDiff = Math.floor((slot.start.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysDiff > MAX_DAYS) {
      setError(isPremium
        ? `Solo podés reservar hasta ${MAX_DAYS} días adelante.`
        : `Con Free podés reservar hasta ${MAX_DAYS} días adelante. Con Premium: 15 días.`);
      return;
    }
    if (!slot.start || isNaN(slot.start.getTime())) {
      setError('Hora inválida. Elegí otro turno.');
      return;
    }
    setSaving(true); setError('');
    const { data: { user } } = await supabase.auth.getUser();
    const rule = ruleFor(slot.start, offpeakRules);
    const finalPrice = priceWithRule(Number(court.price_per_slot), rule);
    // Seña: si el complejo definió deposit_amount en la cancha, se cobra eso; sino el total.
    const senaAmount = (court as any).deposit_amount != null
      ? Number((court as any).deposit_amount)
      : finalPrice;
    // Fase 1: deadline para subir comprobante. Usa la config del complejo.
    const timeoutHours = (complex as any)?.booking_payment_timeout_hours ?? 2;
    const deadline = new Date(Date.now() + timeoutHours * 60 * 60 * 1000);
    const { data: booking, error: bErr } = await supabase.from('bookings').insert({
      court_id: court.id, player_id: user!.id, status: 'pendiente', payment_status: 'pendiente',
      starts_at: slot.start.toISOString(), ends_at: slot.end.toISOString(),
      price: senaAmount,   // el "price" del booking es la seña que el jugador paga ahora
      payment_deadline_at: deadline.toISOString()
    }).select().single();
    if (bErr) {
      // Constraint no_overlap_bookings o similar → otro jugador se adelantó
      const msg = String(bErr.message ?? '').toLowerCase();
      if (msg.includes('overlap') || msg.includes('no_overlap') || msg.includes('exclusion') || bErr.code === '23P01') {
        setError('Otro jugador reservó ese turno justo antes que vos. Refrescamos la disponibilidad — elegí otro.');
      } else {
        setError('Ese turno acaba de ocuparse. Elegí otro.');
      }
      setSaving(false);
      // Fuerza refetch tocando la cancha (dispara el useEffect que recarga slots)
      const c = court; setCourt(null); setTimeout(() => setCourt(c), 100);
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('category').eq('id', user!.id).single();
    const { data: match } = await supabase.from('matches').insert({
      booking_id: booking.id, creator_id: user!.id, suggested_category: profile?.category
    }).select().single();
    await supabase.from('match_players').insert({ match_id: match.id, player_id: user!.id, team: 1 });

    // Notificar al dueño del complejo (owner) que hay una nueva reserva pendiente.
    if (complex?.owner_id) {
      const { data: prof } = await supabase.from('profiles')
        .select('first_name, last_name').eq('id', user!.id).maybeSingle();
      const nombre = prof ? `${prof.first_name} ${prof.last_name ?? ''}`.trim() : 'Un jugador';
      const hora = slot.start.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      const fecha = slot.start.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
      await notify({
        user_id: complex.owner_id,
        kind: 'reserva_ok',
        title: '🎾 Nueva reserva',
        body: `${nombre} reservó ${court.name} para el ${fecha} ${hora} hs. Pago pendiente.`,
        link: '/complejo/calendario',
        ref_id: booking.id
      });
    }

    setPending({ booking, match, slot, court, complex });
    setSaving(false);
  }

  async function sumarmeALaEspera(slot: Slot) {
    setMsg(''); setError('');
    if (!court) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setError('Iniciá sesión primero.');
    const { error: err } = await supabase.from('booking_waitlist').insert({
      court_id: court.id, player_id: user.id, starts_at: slot.start.toISOString()
    });
    if (err) {
      if (err.code === '23505') return setMsg('Ya estás en la lista de espera para este turno.');
      return setError(`${err.message}. ¿Ejecutaste update-13-complex-features.sql?`);
    }
    setMsg('Te sumamos a la lista de espera. Te avisamos si se libera 🔔');
    setMyWaitlist([...myWaitlist, { court_id: court.id, starts_at: slot.start.toISOString(), player_id: user.id }]);
  }

  async function salirDeLaEspera(slot: Slot) {
    if (!court) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('booking_waitlist').delete()
      .eq('court_id', court.id).eq('player_id', user.id).eq('starts_at', slot.start.toISOString());
    setMyWaitlist(myWaitlist.filter(w => w.starts_at !== slot.start.toISOString()));
  }

  async function subirComprobante(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !pending) return;
    setUploading(true); setError('');
    const url = await uploadImage(file, 'comprobantes-reservas');
    setUploading(false);
    if (!url) return setError('No pudimos subir el comprobante. Probá de nuevo.');
    const { error: err } = await supabase.from('bookings').update({
      payment_proof_url: url,
      payment_uploaded_at: new Date().toISOString(),
      payment_status: 'en_revision'
    }).eq('id', pending.booking.id);
    if (err) return setError(err.message);

    // Notificar al complejo que hay un comprobante nuevo para revisar
    if (pending.complex?.owner_id) {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: prof } = await supabase.from('profiles')
        .select('first_name, last_name').eq('id', user!.id).maybeSingle();
      const nombre = prof ? `${prof.first_name} ${prof.last_name ?? ''}`.trim() : 'Un jugador';
      await notify({
        user_id: pending.complex.owner_id,
        kind: 'reserva_ok',
        title: '💰 Comprobante recibido',
        body: `${nombre} subió el comprobante de pago. Revisalo en el calendario.`,
        link: '/complejo/calendario',
        ref_id: pending.booking.id
      });
    }

    setPending({ ...pending, booking: { ...pending.booking, payment_proof_url: url, payment_status: 'en_revision' } });
  }

  return (
    <main className="px-5 pt-8">
      <h1 className="font-display font-black text-2xl">Reservar cancha</h1>

      <div className="mt-5 space-y-4">
        {/* 📍 Ubicación — muestra complejos cercanos automáticamente */}
        {locStatus !== 'granted' && (
          <button onClick={activarUbicacion} disabled={locStatus === 'loading'}
            className="w-full py-3 rounded-xl bg-ball/10 border border-ball/40 text-ball font-black text-sm active:scale-95 flex items-center justify-center gap-2">
            {locStatus === 'loading' ? '📍 Buscando tu ubicación…'
              : locStatus === 'denied' ? '⚠️ Permitir ubicación para ver canchas cerca'
              : '📍 Ver canchas cerca mío'}
          </button>
        )}

        {locStatus === 'granted' && nearbyComplexes.length > 0 && (
          <div>
            <div className="flex items-center justify-between">
              <label className="label">Complejos cerca tuyo</label>
              <button onClick={() => { setMyLoc(null); setLocStatus('idle'); setNearbyComplexes([]); }}
                className="text-white/50 text-xs font-bold">✕ Buscar por ciudad</button>
            </div>
            <div className="grid gap-2 mt-2">
              {nearbyComplexes.map((cx: any) => (
                <button key={cx.id}
                  onClick={() => { setComplex(cx); setCourt(null); setPending(null); }}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-left active:scale-[0.99]
                    ${complex?.id === cx.id ? 'border-ball bg-ball/10' : 'border-white/10 bg-white/5'}`}>
                  {cx.logo_url
                    ? <img src={cx.logo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                    : <span className="w-10 h-10 rounded-full bg-court flex items-center justify-center text-xs font-black">PA</span>}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{cx.name}</p>
                    <p className="text-white/50 text-xs truncate">{cx.address ?? ''}</p>
                  </div>
                  <span className="text-ball text-xs font-black shrink-0">
                    {cx.distanceKm.toFixed(1)} km
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {locStatus === 'granted' && nearbyComplexes.length === 0 && (
          <p className="text-yellow-300 text-sm">No hay complejos con ubicación registrada cerca tuyo. Buscá por ciudad ↓</p>
        )}

        {/* Selector por ciudad (siempre disponible como fallback) */}
        {locStatus !== 'granted' && (
          <div><label className="label">O elegí por ciudad</label>
            <select className="input" value={cityId} onChange={e => { setCityId(e.target.value); setComplex(null); setCourt(null); setPending(null); }}>
              <option value="">Elegí ciudad</option>
              {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        {cityId && (
          <div>
            <label className="label">Complejo</label>

            {/* Mapa embebido de Google Maps con la ciudad + complejos */}
            {complexes.length > 0 && (
              <div className="rounded-2xl overflow-hidden border border-white/10 mb-3">
                <iframe
                  key={cityId}
                  title="Mapa de complejos"
                  className="w-full h-56 border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(
                    'canchas de padel ' + (cities.find(c => c.id === cityId)?.name ?? '')
                  )}&output=embed`}
                />
              </div>
            )}

            <div className="grid gap-2">
              {complexes.map(cx => (
                <div key={cx.id} className={`card ${complex?.id === cx.id ? 'ring-2 ring-ball' : ''}`}>
                  <button onClick={() => { setComplex(cx); setCourt(null); setPending(null); }} className="text-left w-full">
                    <p className="font-display font-bold">{cx.name}</p>
                    <p className="text-white/50 text-sm">{cx.address}</p>
                  </button>
                  <div className="mt-2 flex items-center gap-3">
                    <Link href={`/club/${cx.id}`} className="text-ball text-xs font-bold">
                      Ver perfil →
                    </Link>
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cx.name + ' ' + (cx.address ?? ''))}`}
                      target="_blank" rel="noreferrer"
                      className="text-white/60 text-xs font-bold underline">
                      Cómo llegar 🗺️
                    </a>
                  </div>
                </div>
              ))}
              {complexes.length === 0 && <p className="text-white/50 text-sm">Todavía no hay complejos en esta ciudad.</p>}
            </div>
          </div>
        )}

        {complex && (
          <>
            <div><label className="label">Cancha</label>
              <div className="grid gap-2">
                {courts.map((c: any) => (
                  <button key={c.id} onClick={() => { setCourt(c); setPending(null); }}
                    className={`card !p-0 overflow-hidden text-left flex ${court?.id === c.id ? 'ring-2 ring-ball' : ''}`}>
                    {c.photo_url
                      ? <img src={c.photo_url} alt="" className="w-24 h-20 object-cover shrink-0" />
                      : <span className="w-24 h-20 bg-ball/10 flex items-center justify-center text-2xl shrink-0">🎾</span>}
                    <span className="p-3 min-w-0">
                      <span className="font-display font-bold block">
                        {c.name} · ${Number(c.price_per_slot).toLocaleString('es-AR')}
                      </span>
                      <span className="text-white/50 text-xs block truncate">
                        {c.surface}{c.covered ? ' · techada' : ''}{c.description ? ` · ${c.description}` : ''}
                      </span>
                    </span>
                  </button>
                ))}
              </div></div>
            <div><label className="label">Fecha</label>
              <input className="input" type="date" value={date}
                min={new Date().toISOString().slice(0, 10)}
                max={maxDate}
                onChange={e => {
                  const v = e.target.value;
                  if (!v) return;
                  // Snap a maxDate si el usuario tipea una fecha fuera de rango
                  if (v > maxDate) {
                    setDate(maxDate);
                    setError(isPremium
                      ? `Solo podés reservar hasta ${MAX_DAYS} días adelante.`
                      : `Con Free podés reservar hasta ${MAX_DAYS} días adelante. Suscribite a Premium para 15 días.`);
                    return;
                  }
                  setError('');
                  setDate(v);
                }} />
              {!isPremium && (
                <Link href="/planes" className="mt-1 block text-[11px] text-ball font-bold">
                  🔒 Con Premium reservás hasta 15 días adelante
                </Link>
              )}
              {isPremium && (
                <Link href="/jugador/buscar" className="mt-2 block text-[12px] text-ball font-black underline">
                  🔍 Buscar canchas libres en toda la ciudad →
                </Link>
              )}</div>
          </>
        )}

        {pending && (
          <section className="card border border-ball/30">
            <div className="flex items-start justify-between gap-2">
              <p className="font-display font-black text-xl text-ball flex-1">Reserva pendiente de pago</p>
              <button onClick={async () => {
                if (!confirm('¿Descartar esta reserva pendiente? El turno vuelve a estar disponible.')) return;
                // Cancelar el booking pendiente en la DB
                await supabase.from('bookings').update({ status: 'cancelada' }).eq('id', pending.booking.id);
                setPending(null);
              }}
                className="text-red-400 text-xs font-bold px-3 py-1.5 rounded-lg border border-red-400/40 hover:bg-red-500/10">
                ✕ Descartar
              </button>
            </div>
            <p className="text-white/60 text-sm mt-1">
              Tu turno queda reservado mientras el complejo revisa el comprobante. Cuando lo marque como pagado, pasa a confirmada.
            </p>
            {pending.booking.payment_deadline_at && (
              <div className="mt-3 rounded-2xl bg-yellow-500/10 border border-yellow-500/40 p-3 text-sm">
                <p className="text-yellow-300 font-black">⏰ Tenés hasta las {new Date(pending.booking.payment_deadline_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} hs para subir el comprobante.</p>
                <p className="text-white/70 text-xs mt-1">Si no lo subís, la reserva se cancela automáticamente y otro jugador puede tomar el turno.</p>
              </div>
            )}
            <div className="mt-3 rounded-2xl bg-white/5 p-3 text-sm space-y-1">
              <p><b>{pending.complex?.name}</b> · {pending.court?.name}</p>
              <p>{pending.slot.start.toLocaleDateString('es-AR')} · {pending.slot.start.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs</p>
              <p className="font-display font-black text-ball text-lg">${Number(pending.booking.price ?? 0).toLocaleString('es-AR')}</p>
            </div>
            {/* Transferencia (si el complejo la tiene habilitada) */}
            {(pending.complex as any)?.payment_transfer_enabled !== false && (
              <div className="mt-3 rounded-2xl bg-blue-500/10 border border-blue-500/30 p-3 text-sm space-y-1">
                <p className="font-display font-bold text-blue-300">🏦 Transferencia</p>
                {pending.complex?.payment_alias && <p>Alias: <b>{pending.complex.payment_alias}</b></p>}
                {pending.complex?.payment_cbu && <p>CBU/CVU: <b>{pending.complex.payment_cbu}</b></p>}
                {pending.complex?.payment_holder && <p>Titular: <b>{pending.complex.payment_holder}</b></p>}
                {pending.complex?.payment_bank && <p>Banco/billetera: {pending.complex.payment_bank}</p>}
                {pending.complex?.payment_notes && <p className="text-white/60">{pending.complex.payment_notes}</p>}
                {!pending.complex?.payment_alias && !pending.complex?.payment_cbu && (
                  <p className="text-yellow-300">Este complejo todavia no cargo datos de transferencia. Contactalo antes de pagar.</p>
                )}
              </div>
            )}

            {/* Efectivo (informativo — se paga en cancha) */}
            {(pending.complex as any)?.payment_cash_enabled !== false && (
              <div className="mt-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-sm">
                <p className="font-display font-bold text-emerald-300">💵 Efectivo en cancha</p>
                {(pending.complex as any)?.payment_cash_discount_pct > 0 && (
                  <p className="text-white mt-1">
                    <b className="text-ball">{(pending.complex as any).payment_cash_discount_pct}% de descuento</b> pagando en efectivo.
                  </p>
                )}
                {(pending.complex as any)?.payment_cash_notes && (
                  <p className="text-white/60 mt-1">{(pending.complex as any).payment_cash_notes}</p>
                )}
              </div>
            )}
            {/* Pagar automático con Mercado Pago (si el complejo lo tiene conectado Y habilitado) */}
            {(pending.complex as any)?.mp_access_token && (pending.complex as any)?.payment_mp_enabled && (
              <div className="mt-3 rounded-2xl bg-gradient-to-br from-[#009EE3]/15 to-transparent border-2 border-[#009EE3]/40 p-3">
                <p className="font-display font-black text-white">💳 Pagar por Mercado Pago</p>
                <p className="text-white/60 text-xs mt-0.5">La reserva se confirma automáticamente al terminar el pago.</p>
                <div className="mt-3">
                  {(() => {
                    const priceTotal = Number((pending.court as any)?.price_per_slot ?? 0);
                    const senaCustom = (pending.court as any)?.deposit_amount;
                    const hasSena = senaCustom != null && Number(senaCustom) > 0 && Number(senaCustom) < priceTotal;
                    const deposit = hasSena ? Number(senaCustom) : priceTotal;
                    const onlyDeposit = !!(pending.complex as any)?.mp_only_deposit;
                    const payMP = async (kind: 'seña' | 'total') => {
                      const res = await fetch('/api/mp/pay-booking', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ bookingId: pending.booking.id, kind })
                      });
                      const data = await res.json();
                      if (!res.ok) return alert((data.error ?? 'Error') + '\n\n' + JSON.stringify(data, null, 2));
                      window.location.href = data.init_point;
                    };
                    // Si "solo seña por MP" está activado, solo botón de seña
                    if (onlyDeposit && hasSena) {
                      return (
                        <div>
                          <button onClick={() => payMP('seña')}
                            className="w-full py-3 rounded-xl bg-[#009EE3] text-white font-black text-sm active:scale-95">
                            Pagar seña<br/><span className="text-xs">${deposit.toLocaleString('es-AR')}</span>
                          </button>
                          <p className="text-white/50 text-[10px] mt-1 text-center">
                            El resto (${(priceTotal - deposit).toLocaleString('es-AR')}) se paga en cancha
                          </p>
                        </div>
                      );
                    }
                    return (
                      <div className={hasSena ? 'grid grid-cols-2 gap-2' : ''}>
                        {hasSena && (
                          <button onClick={() => payMP('seña')}
                            className="py-3 rounded-xl bg-[#009EE3] text-white font-black text-sm active:scale-95">
                            Seña<br/><span className="text-xs">${deposit.toLocaleString('es-AR')}</span>
                          </button>
                        )}
                        <button onClick={() => payMP('total')}
                          className="py-3 rounded-xl bg-ball text-courtdark font-black text-sm active:scale-95">
                          Turno completo<br/><span className="text-xs">${priceTotal.toLocaleString('es-AR')}</span>
                        </button>
                      </div>
                    );
                  })()}
                </div>
                <p className="text-white/40 text-[10px] mt-2 text-center">O bien subí comprobante de transferencia abajo ↓</p>
              </div>
            )}

            <label className="mt-3 flex items-center justify-center w-full py-3 rounded-xl bg-ball text-courtdark font-display font-black cursor-pointer">
              {uploading ? 'Subiendo...' : pending.booking.payment_proof_url ? 'Cambiar comprobante' : 'Subir comprobante'}
              <input type="file" accept="image/*" className="hidden" onChange={subirComprobante} />
            </label>
            {pending.booking.payment_proof_url && (
              <>
                <img src={pending.booking.payment_proof_url} alt="Comprobante" className="mt-3 rounded-2xl w-full max-h-64 object-cover" />
                <button onClick={() => router.push(`/partido/${pending.match.id}?nueva=1`)}
                  className="mt-3 w-full py-3 rounded-xl border border-white/20 font-semibold">
                  Ir al partido
                </button>
              </>
            )}
            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          </section>
        )}

        {court && !pending && (
          <div>
            <label className="label">Horarios disponibles</label>
            {offpeakRules.length > 0 && (
              <p className="text-ball text-xs font-bold mb-2">
                🔥 Este complejo tiene descuentos en horarios de baja demanda.
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              {slots.map((s, i) => {
                const rule = ruleFor(s.start, offpeakRules);
                const inMyWaitlist = myWaitlist.some(w => new Date(w.starts_at).getTime() === s.start.getTime());
                const slotHour = s.start.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
                return (
                  <button key={i}
                    id={`slot-${slotHour}`}
                    disabled={saving}
                    onClick={() => s.free ? setMethodChooser(s) : (inMyWaitlist ? salirDeLaEspera(s) : sumarmeALaEspera(s))}
                    className={`relative py-3 rounded-xl font-display font-bold text-sm
                      ${s.free ? 'bg-ball text-courtdark active:scale-95'
                        : inMyWaitlist ? 'bg-yellow-300/20 text-yellow-200 border border-yellow-300/40'
                        : 'bg-white/5 text-white/40 border border-white/10'}`}>
                    <span>{s.start.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                    {s.free && rule && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                        -{rule.discount_pct}%
                      </span>
                    )}
                    {!s.free && (
                      <span className="block text-[9px] font-black mt-0.5 uppercase">
                        {inMyWaitlist ? 'Estás en espera' : 'Lista de espera'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {msg && <p className="text-ball text-sm mt-2">{msg}</p>}
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          </div>
        )}
      </div>

      {/* Modal: elegir forma de pago ANTES de reservar */}
      {methodChooser && complex && court && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-end lg:items-center overflow-y-auto"
          onClick={() => setMethodChooser(null)}>
          <div className="bg-[#0B0F16] border-2 border-white/15 rounded-t-3xl lg:rounded-2xl w-full max-w-lg mx-auto p-5 pb-10"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-display font-black text-lg">Elegí cómo pagás</p>
                <p className="text-white/60 text-sm mt-1">
                  {court.name} · {methodChooser.start.toLocaleString('es-AR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} hs
                </p>
              </div>
              <button onClick={() => setMethodChooser(null)}
                className="w-9 h-9 rounded-full bg-white/10 text-white font-bold shrink-0">✕</button>
            </div>

            <div className="mt-4 space-y-2">
              {/* MP */}
              {(complex as any).mp_access_token && (complex as any).payment_mp_enabled && (
                <button onClick={async () => {
                  const s = methodChooser; setMethodChooser(null);
                  await reservar(s);   // crea la reserva y setea pending
                  // Después el user usa los botones de MP del card pending
                }}
                  className="w-full py-4 rounded-xl bg-[#009EE3] hover:bg-[#0088c9] text-white font-black text-left px-4 active:scale-95 transition">
                  <p className="text-lg">💳 Mercado Pago</p>
                  <p className="text-xs opacity-90 font-normal mt-0.5">Pagás ahora, la reserva se confirma automáticamente</p>
                </button>
              )}

              {/* Transferencia */}
              {(complex as any).payment_transfer_enabled !== false && (
                <button onClick={async () => {
                  const s = methodChooser; setMethodChooser(null);
                  await reservar(s);
                }}
                  className="w-full py-4 rounded-xl bg-blue-500/15 border-2 border-blue-500/40 text-blue-200 font-black text-left px-4 active:scale-95 transition">
                  <p className="text-lg">🏦 Transferencia</p>
                  <p className="text-xs opacity-80 font-normal mt-0.5">Transferís y subís el comprobante. El club aprueba.</p>
                </button>
              )}

              {/* Efectivo */}
              {(complex as any).payment_cash_enabled !== false && (
                <button onClick={async () => {
                  const s = methodChooser; setMethodChooser(null);
                  await reservar(s);
                }}
                  className="w-full py-4 rounded-xl bg-emerald-500/15 border-2 border-emerald-500/40 text-emerald-200 font-black text-left px-4 active:scale-95 transition">
                  <p className="text-lg">💵 Efectivo en cancha</p>
                  <p className="text-xs opacity-80 font-normal mt-0.5">
                    Reservás y pagás cuando llegás.
                    {(complex as any).payment_cash_discount_pct > 0 && (
                      <> <b>{(complex as any).payment_cash_discount_pct}% descuento</b> en efectivo</>
                    )}
                  </p>
                </button>
              )}

              {/* Si no hay métodos habilitados */}
              {!((complex as any).mp_access_token && (complex as any).payment_mp_enabled) &&
               (complex as any).payment_transfer_enabled === false &&
               (complex as any).payment_cash_enabled === false && (
                <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/40 p-3 text-sm text-yellow-300">
                  ⚠️ Este complejo no tiene métodos de pago activos. Contactalo antes de reservar.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
