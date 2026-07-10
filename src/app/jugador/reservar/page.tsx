'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { buildSlots, type Slot } from '@/lib/slots';
import type { Complex, Court } from '@/lib/types';
import { uploadImage } from '@/lib/upload';

export default function Reservar() {
  const router = useRouter();
  const [cities, setCities] = useState<any[]>([]);
  const [cityId, setCityId] = useState('');
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [complex, setComplex] = useState<Complex | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [court, setCourt] = useState<Court | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { supabase.from('cities').select('*').eq('active', true).then(({ data }) => setCities(data ?? [])); }, []);

  useEffect(() => {
    if (!cityId) return setComplexes([]);
    supabase.from('complexes').select('*').eq('city_id', cityId).eq('active', true)
      .then(({ data }) => setComplexes(data ?? []));
  }, [cityId]);

  useEffect(() => {
    if (!complex) return setCourts([]);
    supabase.from('courts').select('*').eq('complex_id', complex.id).eq('active', true)
      .then(({ data }) => { setCourts(data ?? []); setCourt(null); });
  }, [complex]);

  useEffect(() => {
    if (!court || !complex) return setSlots([]);
    const day = new Date(date + 'T00:00:00');
    const from = new Date(day); const to = new Date(day); to.setDate(to.getDate() + 1);
    supabase.from('bookings').select('*')
      .eq('court_id', court.id)
      .gte('starts_at', from.toISOString()).lt('starts_at', to.toISOString())
      .then(({ data }) => setSlots(buildSlots(day, complex.open_time, complex.close_time, complex.slot_minutes, data ?? [])));
  }, [court, date, complex]);

  async function reservar(slot: Slot) {
    if (!court || saving) return;
    setSaving(true); setError('');
    const { data: { user } } = await supabase.auth.getUser();
    const { data: booking, error: bErr } = await supabase.from('bookings').insert({
      court_id: court.id, player_id: user!.id, status: 'pendiente', payment_status: 'pendiente',
      starts_at: slot.start.toISOString(), ends_at: slot.end.toISOString(),
      price: court.price_per_slot
    }).select().single();
    if (bErr) { setError('Ese turno acaba de ocuparse. Elegí otro.'); setSaving(false); return; }

    const { data: profile } = await supabase.from('profiles').select('category').eq('id', user!.id).single();
    const { data: match } = await supabase.from('matches').insert({
      booking_id: booking.id, creator_id: user!.id, suggested_category: profile?.category
    }).select().single();
    await supabase.from('match_players').insert({ match_id: match.id, player_id: user!.id, team: 1 });
    setPending({ booking, match, slot, court, complex });
    setSaving(false);
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
    setPending({ ...pending, booking: { ...pending.booking, payment_proof_url: url, payment_status: 'en_revision' } });
  }

  return (
    <main className="px-5 pt-8">
      <h1 className="font-display font-black text-2xl">Reservar cancha</h1>

      <div className="mt-5 space-y-4">
        <div><label className="label">Ciudad</label>
          <select className="input" value={cityId} onChange={e => { setCityId(e.target.value); setComplex(null); }}>
            <option value="">Elegí ciudad</option>
            {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></div>

        {cityId && (
          <div><label className="label">Complejo</label>
            <div className="grid gap-2">
              {complexes.map(cx => (
                <div key={cx.id} className={`card ${complex?.id === cx.id ? 'ring-2 ring-court' : ''}`}>
                  <button onClick={() => setComplex(cx)} className="text-left w-full">
                    <p className="font-display font-bold">{cx.name}</p>
                    <p className="text-white/50 text-sm">{cx.address}</p>
                  </button>
                  <Link href={`/club/${cx.id}`} className="mt-2 inline-block text-ball text-xs font-bold">
                    Ver perfil, servicios y membresias
                  </Link>
                </div>
              ))}
              {complexes.length === 0 && <p className="text-white/50 text-sm">Todavía no hay complejos en esta ciudad.</p>}
            </div></div>
        )}

        {complex && (
          <>
            <div><label className="label">Cancha</label>
              <div className="grid gap-2">
                {courts.map((c: any) => (
                  <button key={c.id} onClick={() => setCourt(c)}
                    className={`card !p-0 overflow-hidden text-left flex ${court?.id === c.id ? 'ring-2 ring-court' : ''}`}>
                    {c.photo_url
                      ? <img src={c.photo_url} alt="" className="w-24 h-20 object-cover shrink-0" />
                      : <span className="w-24 h-20 bg-court/10 flex items-center justify-center text-2xl shrink-0">🎾</span>}
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
                min={new Date().toISOString().slice(0, 10)} onChange={e => setDate(e.target.value)} /></div>
          </>
        )}

        {pending && (
          <section className="card border border-ball/30">
            <p className="font-display font-black text-xl text-ball">Reserva pendiente de pago</p>
            <p className="text-white/60 text-sm mt-1">
              Tu turno queda reservado mientras el complejo revisa el comprobante. Cuando lo marque como pagado, pasa a confirmada.
            </p>
            <div className="mt-3 rounded-2xl bg-white/5 p-3 text-sm space-y-1">
              <p><b>{pending.complex?.name}</b> · {pending.court?.name}</p>
              <p>{pending.slot.start.toLocaleDateString('es-AR')} · {pending.slot.start.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs</p>
              <p className="font-display font-black text-ball text-lg">${Number(pending.booking.price ?? 0).toLocaleString('es-AR')}</p>
            </div>
            <div className="mt-3 rounded-2xl bg-white/5 p-3 text-sm space-y-1">
              <p className="font-display font-bold text-ball">Transferencia</p>
              {pending.complex?.payment_alias && <p>Alias: <b>{pending.complex.payment_alias}</b></p>}
              {pending.complex?.payment_cbu && <p>CBU/CVU: <b>{pending.complex.payment_cbu}</b></p>}
              {pending.complex?.payment_holder && <p>Titular: <b>{pending.complex.payment_holder}</b></p>}
              {pending.complex?.payment_bank && <p>Banco/billetera: {pending.complex.payment_bank}</p>}
              {pending.complex?.payment_notes && <p className="text-white/60">{pending.complex.payment_notes}</p>}
              {!pending.complex?.payment_alias && !pending.complex?.payment_cbu && (
                <p className="text-yellow-300">Este complejo todavia no cargo datos de transferencia. Contactalo antes de pagar.</p>
              )}
            </div>
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
            <div className="grid grid-cols-3 gap-2">
              {slots.map((s, i) => (
                <button key={i} disabled={!s.free || saving} onClick={() => reservar(s)}
                  className={`py-3 rounded-xl font-display font-bold text-sm
                    ${s.free ? 'bg-ball active:scale-95' : 'bg-white/5 text-white/20 line-through'}`}>
                  {s.start.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </button>
              ))}
            </div>
            {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
          </div>
        )}
      </div>
    </main>
  );
}
