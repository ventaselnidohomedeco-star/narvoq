'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

// /jugador/buscar — Buscador inteligente de canchas libres. PREMIUM.
// Input: ciudad + fecha + hora + duración → devuelve complejos con canchas
// disponibles en ese slot. Filtra por bookings existentes que colisionan.

type Complex = { id: string; name: string; address: string; logo_url: string | null; city_id: string };
type Court = { id: string; complex_id: string; name: string; price_per_slot: number; surface: string; covered: boolean; active: boolean };
type Booking = { court_id: string; starts_at: string; ends_at: string };

export default function BuscarCanchas() {
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [cities, setCities] = useState<any[]>([]);
  const [cityId, setCityId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('20:00');
  const [duration, setDuration] = useState(90);
  const [results, setResults] = useState<Array<Complex & { courts: Court[] }>>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsPremium(false); return; }
      const { data } = await supabase.from('profiles')
        .select('is_premium, city_id').eq('id', user.id).maybeSingle();
      setIsPremium(!!data?.is_premium);
      if (data?.city_id) setCityId(data.city_id);
    })();
    (async () => {
      const [{ data: dbCities }, { data: cx }] = await Promise.all([
        supabase.from('cities').select('*').eq('active', true),
        supabase.from('complexes').select('locality, province').eq('active', true).eq('status', 'active').not('locality', 'is', null)
      ]);
      const merged: any[] = [...(dbCities ?? [])];
      const existingNames = new Set(merged.map((c: any) => (c.name ?? '').toLowerCase()));
      for (const c of cx ?? []) {
        const loc = (c as any).locality?.trim();
        if (!loc || existingNames.has(loc.toLowerCase())) continue;
        existingNames.add(loc.toLowerCase());
        merged.push({ id: `loc:${loc}`, name: loc, _fromLocality: true });
      }
      merged.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
      setCities(merged);
    })();
  }, []);

  async function buscar() {
    if (!cityId) return setMsg('Elegí una ciudad primero.');
    setMsg(''); setLoading(true); setResults([]); setSearched(true);

    // Rango de tiempo a chequear
    const [hh, mm] = time.split(':').map(Number);
    const from = new Date(date + 'T00:00:00');
    from.setHours(hh, mm, 0, 0);
    const to = new Date(from.getTime() + duration * 60 * 1000);

    // Complejos aprobados: por city_id (viejo) O por locality (nuevo/precargados)
    const selected = cities.find((c: any) => c.id === cityId);
    const isVirtual = String(cityId).startsWith('loc:');
    const cityName = selected?.name ?? '';
    let cq = supabase.from('complexes')
      .select('id, name, address, logo_url, city_id')
      .eq('active', true).eq('status', 'active');
    if (isVirtual) cq = cq.ilike('locality', cityName);
    else cq = cq.or(`city_id.eq.${cityId}${cityName ? `,locality.ilike.${cityName}` : ''}`);
    const { data: complexes } = await cq;

    if (!complexes || complexes.length === 0) { setLoading(false); return; }

    // Traer canchas de esos complejos
    const complexIds = complexes.map(c => c.id);
    const { data: courts } = await supabase.from('courts')
      .select('id, complex_id, name, price_per_slot, surface, covered, active')
      .in('complex_id', complexIds).eq('active', true);
    if (!courts) { setLoading(false); return; }

    // Traer bookings que solapan el rango
    const courtIds = courts.map(c => c.id);
    const dayStart = new Date(from); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
    const { data: bookings } = await supabase.from('bookings')
      .select('court_id, starts_at, ends_at')
      .in('court_id', courtIds)
      .gte('starts_at', dayStart.toISOString()).lt('starts_at', dayEnd.toISOString())
      .neq('status', 'cancelada');

    // Para cada cancha: ¿colisiona con algún booking en el rango buscado?
    const busyByCourt = new Map<string, Booking[]>();
    (bookings ?? []).forEach(b => {
      const arr = busyByCourt.get(b.court_id) ?? [];
      arr.push(b as Booking);
      busyByCourt.set(b.court_id, arr);
    });
    const isFree = (court: Court) => {
      const bs = busyByCourt.get(court.id) ?? [];
      return !bs.some(b => {
        const bStart = new Date(b.starts_at).getTime();
        const bEnd = new Date(b.ends_at).getTime();
        return bStart < to.getTime() && bEnd > from.getTime();
      });
    };

    // Agrupar por complejo
    const grouped: Array<Complex & { courts: Court[] }> = [];
    for (const cx of complexes) {
      const availableCourts = courts.filter(c => c.complex_id === cx.id && isFree(c));
      if (availableCourts.length > 0) {
        grouped.push({ ...cx, courts: availableCourts });
      }
    }
    grouped.sort((a, b) => a.name.localeCompare(b.name));
    setResults(grouped);
    setLoading(false);
  }

  const timeOptions = useMemo(() => {
    const opts: string[] = [];
    for (let h = 8; h < 24; h++) {
      for (const m of [0, 30]) {
        opts.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    return opts;
  }, []);

  if (isPremium === null) return <main className="p-8 text-white/60">Cargando…</main>;

  if (!isPremium) return (
    <main className="min-h-dvh px-5 pt-10 pb-16 max-w-lg mx-auto text-center">
      <div className="text-6xl mb-4">🔍</div>
      <h1 className="font-display font-black text-3xl">Buscador de canchas</h1>
      <p className="text-white/60 mt-3">
        Encontrá canchas libres en tu zona por día y horario, sin entrar complejo por complejo.
      </p>
      <div className="mt-6 card border-2 border-ball/40 bg-ball/10 text-left">
        <p className="font-black text-ball">⭐ Función Premium</p>
        <p className="text-white/70 text-sm mt-2">
          Con NarvoQ Verificado, elegís ciudad, día y horario y te mostramos todos los complejos con disponibilidad.
        </p>
        <Link href="/planes" className="block text-center mt-4 py-3 rounded-xl bg-ball text-courtdark font-display font-black">
          Ver planes
        </Link>
      </div>
    </main>
  );

  return (
    <main className="min-h-dvh px-5 pt-6 pb-16 max-w-3xl mx-auto">
      <p className="text-ball text-xs font-black tracking-widest">PREMIUM</p>
      <h1 className="font-display font-black text-3xl mt-1">Buscar canchas libres</h1>
      <p className="text-white/60 text-sm mt-1">Ciudad + día + horario → ves quién tiene disponibilidad.</p>

      {/* Filtros */}
      <section className="mt-6 card space-y-3">
        <div>
          <label className="text-white/60 text-xs font-black uppercase">Ciudad</label>
          <select className="input mt-1" value={cityId} onChange={e => setCityId(e.target.value)}>
            <option value="">Elegí tu ciudad…</option>
            {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-white/60 text-xs font-black uppercase">Día</label>
            <input type="date" className="input mt-1" value={date}
              min={new Date().toISOString().slice(0, 10)}
              max={(() => { const d = new Date(); d.setDate(d.getDate() + 15); return d.toISOString().slice(0, 10); })()}
              onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label className="text-white/60 text-xs font-black uppercase">Hora</label>
            <select className="input mt-1" value={time} onChange={e => setTime(e.target.value)}>
              {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-white/60 text-xs font-black uppercase">Duración</label>
            <select className="input mt-1" value={duration} onChange={e => setDuration(Number(e.target.value))}>
              <option value={60}>60′</option>
              <option value={90}>90′</option>
              <option value={120}>120′</option>
            </select>
          </div>
        </div>
        <button onClick={buscar} disabled={loading}
          className="w-full py-3 rounded-xl bg-ball text-courtdark font-display font-black disabled:opacity-50">
          {loading ? 'Buscando…' : '🔍 Buscar disponibilidad'}
        </button>
        {msg && <p className="text-yellow-300 text-sm">{msg}</p>}
      </section>

      {/* Resultados */}
      {searched && !loading && (
        <section className="mt-6">
          <p className="text-white/50 text-xs font-black uppercase tracking-widest mb-3">
            {results.length === 0 ? 'Sin resultados' : `${results.length} complejo${results.length === 1 ? '' : 's'} con disponibilidad`}
          </p>
          {results.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-3xl">😕</p>
              <p className="text-white/60 mt-2 text-sm">Ningún complejo tiene canchas libres ese día y horario. Probá otra hora o ciudad.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map(cx => (
                <div key={cx.id} className="card !p-4">
                  <div className="flex items-center gap-3">
                    {cx.logo_url
                      ? <img src={cx.logo_url} alt="" className="w-12 h-12 rounded-xl object-cover" />
                      : <div className="w-12 h-12 rounded-xl bg-grafito flex items-center justify-center text-ball font-black text-xl">{cx.name[0]}</div>}
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-black text-lg truncate">{cx.name}</p>
                      <p className="text-white/50 text-xs truncate">{cx.address}</p>
                    </div>
                    <Link href={`/club/${cx.id}`} className="text-ball text-xs font-bold underline">Perfil ↗</Link>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {cx.courts.map(c => {
                      // Query params para pre-seleccionar todo en /jugador/reservar
                      const qs = new URLSearchParams({
                        complex: cx.id,
                        court: c.id,
                        date,
                        time
                      }).toString();
                      return (
                        <Link key={c.id} href={`/jugador/reservar?${qs}`}
                          className="flex items-center justify-between bg-ball/5 border border-ball/30 hover:bg-ball/15 rounded-xl p-3 active:scale-[0.98] transition">
                          <div>
                            <p className="font-bold text-sm">{c.name}</p>
                            <p className="text-white/50 text-xs">{c.surface}{c.covered ? ' · techada' : ''}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-display font-black text-ball">${Number(c.price_per_slot).toLocaleString('es-AR')}</p>
                            <p className="text-ball text-[10px] font-bold">Reservar →</p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
