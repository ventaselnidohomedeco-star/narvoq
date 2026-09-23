'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { buildSlots, type Slot } from '@/lib/slots';

type Complex = {
  id: string; name: string; slug: string; address: string;
  logo_url: string | null; photos: string[] | null;
  open_time: string; close_time: string; slot_minutes: number;
  cancel_hours: number; whatsapp: string | null; phone: string | null;
  auto_confirm_bookings?: boolean; active: boolean; status?: string;
};
type Court = { id: string; name: string; price_per_slot: number; active: boolean };

export default function ReservarPublico() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [cx, setCx] = useState<Complex | null>(null);
  const [inactivo, setInactivo] = useState(false);
  const [courts, setCourts] = useState<Court[]>([]);
  const [court, setCourt] = useState<Court | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [picked, setPicked] = useState<Slot | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const MAX_DAYS = 7;
  const maxDate = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + MAX_DAYS);
    return d.toISOString().slice(0, 10);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: c, error: cErr } = await supabase.from('complexes')
        .select('id, name, slug, address, logo_url, photos, open_time, close_time, slot_minutes, cancel_hours, whatsapp, phone, auto_confirm_bookings, active, status')
        .eq('slug', slug).maybeSingle();
      if (cErr) console.error('[reservar publico] error:', cErr);
      if (!c) { setLoading(false); return; }
      if (!c.active) { setCx(c as Complex); setInactivo(true); setLoading(false); return; }
      setCx(c as Complex);
      const { data: ct } = await supabase.from('courts')
        .select('id, name, price_per_slot, active')
        .eq('complex_id', c.id).eq('active', true).order('name');
      setCourts((ct ?? []) as Court[]);
      if (ct && ct.length > 0) setCourt(ct[0] as Court);
      setLoading(false);
    })();
    const g = typeof window !== 'undefined' ? localStorage.getItem('narvoq_guest') : null;
    if (g) { try { const p = JSON.parse(g); setName(p.name ?? ''); setPhone(p.phone ?? ''); } catch {} }
  }, [slug]);

  useEffect(() => {
    if (!cx || !court) return;
    (async () => {
      const day = new Date(date + 'T00:00:00');
      const nextDay = new Date(day); nextDay.setDate(nextDay.getDate() + 1);
      const { data: bk } = await supabase.from('bookings')
        .select('id, starts_at, ends_at, status, court_id')
        .eq('court_id', court.id)
        .gte('starts_at', day.toISOString())
        .lt('starts_at', nextDay.toISOString());
      setSlots(buildSlots(day, cx.open_time, cx.close_time, cx.slot_minutes, (bk as any) ?? []));
    })();
  }, [cx, court, date]);

  async function reservar() {
    if (!cx || !court || !picked) return;
    setError('');
    const cleanName = name.trim();
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanName.length < 3) return setError('Ingresá tu nombre completo.');
    if (cleanPhone.length < 8) return setError('Ingresá un celular válido (mínimo 8 dígitos).');

    setSaving(true);
    try { localStorage.setItem('narvoq_guest', JSON.stringify({ name: cleanName, phone: cleanPhone })); } catch {}

    const initialStatus = cx.auto_confirm_bookings ? 'confirmada' : 'pendiente';
    const { data: bk, error: err } = await supabase.from('bookings').insert({
      court_id: court.id,
      player_id: null,
      type: 'reserva',
      status: initialStatus,
      starts_at: picked.start.toISOString(),
      ends_at: picked.end.toISOString(),
      price: court.price_per_slot,
      guest_name: cleanName,
      guest_phone: cleanPhone
    }).select().single();

    setSaving(false);
    if (err) { setError(`No se pudo reservar: ${err.message}`); return; }
    router.push(`/${slug}/turnosdisponibles/exito/${bk.id}`);
  }

  if (loading) return <main className="min-h-dvh flex items-center justify-center text-white/60">Cargando complejo…</main>;
  if (!cx) return (
    <main className="min-h-dvh flex flex-col items-center justify-center text-center px-8">
      <p className="text-6xl mb-4">🎾</p>
      <p className="text-xl font-black text-white/80">Complejo no encontrado</p>
      <p className="text-white/50 mt-2 text-sm">
        El link <code className="bg-white/10 px-1.5 py-0.5 rounded">narvoq.com.ar/{slug}/turnosdisponibles</code> no corresponde a ningún complejo activo.
      </p>
      <p className="text-white/40 mt-2 text-xs">Verificá que hayas copiado el link correcto o pedile uno nuevo al complejo.</p>
      <Link href="/" className="mt-6 text-ball font-black">Ir a NarvoQ →</Link>
    </main>
  );
  if (inactivo) return (
    <main className="min-h-dvh flex flex-col items-center justify-center text-center px-8">
      <p className="text-6xl mb-4">⏸</p>
      <p className="text-xl font-black text-white/80">{cx.name}</p>
      <p className="text-white/50 mt-2">Este complejo pausó sus reservas online por el momento.</p>
      <p className="text-white/40 mt-2 text-xs">Contactalo directamente por WhatsApp.</p>
      <Link href="/" className="mt-6 text-ball font-black">Ir a NarvoQ →</Link>
    </main>
  );

  const cover = cx.logo_url || (cx.photos && cx.photos[0]) || null;

  return (
    <main className="min-h-dvh text-white max-w-md mx-auto">
      <div className="relative">
        {cover ? (
          <img src={cover} alt="" className="w-full h-40 object-cover" />
        ) : (
          <div className="w-full h-40 bg-gradient-to-br from-ball/30 to-grafito flex items-center justify-center">
            <span className="text-6xl">🎾</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <p className="text-ball text-[11px] font-black tracking-widest">RESERVAR TURNO</p>
          <h1 className="font-display font-black text-2xl leading-tight mt-1">{cx.name}</h1>
          <p className="text-white/70 text-sm mt-0.5">📍 {cx.address}</p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {courts.length > 1 && (
          <div>
            <p className="text-white/60 text-xs font-black uppercase mb-2">Cancha</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {courts.map(c => (
                <button key={c.id} onClick={() => setCourt(c)}
                  className={`shrink-0 px-4 py-2.5 rounded-xl font-black text-sm transition ${
                    court?.id === c.id ? 'bg-ball text-black' : 'bg-white/5 text-white/70'
                  }`}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-white/60 text-xs font-black uppercase mb-2">Fecha</p>
          <input type="date" value={date} min={new Date().toISOString().slice(0,10)} max={maxDate}
            onChange={e => setDate(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold" />
        </div>

        <div>
          <p className="text-white/60 text-xs font-black uppercase mb-2">Horarios disponibles</p>
          {slots.length === 0 ? (
            <p className="text-white/40 text-sm py-6 text-center">Sin horarios para este día.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slots.map((s, i) => {
                const hhmm = s.start.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
                return (
                  <button key={i} disabled={!s.free}
                    onClick={() => setPicked(s)}
                    className={`py-3 rounded-xl font-black text-sm transition ${
                      !s.free ? 'bg-white/5 text-white/25 line-through cursor-not-allowed' :
                      picked?.start.getTime() === s.start.getTime() ? 'bg-ball text-black ring-2 ring-ball' :
                      'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                    }`}>
                    {hhmm}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {picked && (
          <div className="mt-6 rounded-2xl bg-white/5 border border-white/10 p-5 space-y-3">
            <div>
              <p className="font-display font-black text-lg">Tu turno</p>
              <p className="text-white/70 text-sm">
                {court?.name} · {picked.start.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })} · {picked.start.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })} hs
              </p>
              {court && court.price_per_slot > 0 && (
                <p className="text-ball font-black text-xl mt-1">${Number(court.price_per_slot).toLocaleString('es-AR')} la cancha</p>
              )}
            </div>
            <input type="text" placeholder="Tu nombre y apellido"
              value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40" />
            <input type="tel" placeholder="Tu celular (ej: 2271 555555)"
              inputMode="numeric"
              value={phone} onChange={e => setPhone(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40" />
            {error && <p className="text-red-300 text-sm">{error}</p>}
            <button onClick={reservar} disabled={saving}
              className="w-full py-4 rounded-xl bg-ball text-black font-black text-lg active:scale-95 transition disabled:opacity-50">
              {saving ? 'Reservando…' : `✓ Reservar${cx.auto_confirm_bookings ? '' : ' (queda pendiente de aprobación)'}`}
            </button>
            <p className="text-white/40 text-[11px] text-center">
              Al reservar aceptás recibir un WhatsApp del complejo para confirmar. Sin cuenta, sin descargas.
            </p>
          </div>
        )}

        <div className="pt-8 pb-6 text-center border-t border-white/5 mt-8">
          <p className="text-white/40 text-xs">Reservas gestionadas con</p>
          <Link href="/" className="inline-block mt-1 font-display font-black text-ball">NarvoQ</Link>
        </div>
      </div>
    </main>
  );
}
