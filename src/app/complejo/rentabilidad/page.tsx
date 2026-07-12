'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

const DAYS = [
  { k: 1, l: 'Lun' }, { k: 2, l: 'Mar' }, { k: 3, l: 'Mié' },
  { k: 4, l: 'Jue' }, { k: 5, l: 'Vie' }, { k: 6, l: 'Sáb' }, { k: 0, l: 'Dom' }
];

export default function Rentabilidad() {
  const [cx, setCx] = useState<any>(null);
  const [rules, setRules] = useState<any[]>([]);
  const [periodo, setPeriodo] = useState<'semana' | 'mes'>('semana');
  const [porCancha, setPorCancha] = useState<any[]>([]);
  const [f, setF] = useState({
    name: 'Happy hour', weekdays: [1, 2, 3, 4] as number[],
    from_time: '14:00', to_time: '17:00', discount_pct: '20'
  });
  const [error, setError] = useState('');

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: complex } = await supabase.from('complexes')
      .select('*, courts(*)').eq('owner_id', user.id).single();
    if (!complex) return;
    setCx(complex);

    const { data: rs } = await supabase.from('offpeak_rules')
      .select('*').eq('complex_id', complex.id)
      .order('created_at', { ascending: false });
    setRules(rs ?? []);

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
  }
  useEffect(() => { load(); }, [periodo]);

  async function crearRegla() {
    setError('');
    if (!cx) return;
    if (f.weekdays.length === 0) return setError('Elegí al menos un día de la semana.');
    if (!f.from_time || !f.to_time) return setError('Cargá los horarios.');
    const { error: err } = await supabase.from('offpeak_rules').insert({
      complex_id: cx.id, name: f.name.trim() || 'Descuento',
      weekdays: f.weekdays, from_time: f.from_time, to_time: f.to_time,
      discount_pct: Number(f.discount_pct)
    });
    if (err) return setError(`${err.message}. ¿Ejecutaste update-13-complex-features.sql?`);
    setF({ ...f, name: 'Happy hour' });
    load();
  }

  async function toggleRegla(r: any) {
    await supabase.from('offpeak_rules').update({ active: !r.active }).eq('id', r.id);
    load();
  }

  async function borrarRegla(r: any) {
    if (!confirm('¿Borrar esta regla de descuento?')) return;
    await supabase.from('offpeak_rules').delete().eq('id', r.id);
    load();
  }

  function toggleDia(k: number) {
    setF(prev => prev.weekdays.includes(k)
      ? { ...prev, weekdays: prev.weekdays.filter(d => d !== k) }
      : { ...prev, weekdays: [...prev.weekdays, k].sort() });
  }

  const total = useMemo(() => porCancha.reduce((a, s) => ({
    turnos: a.turnos + s.turnos, plata: a.plata + s.plata, libres: a.libres + s.libres
  }), { turnos: 0, plata: 0, libres: 0 }), [porCancha]);

  if (!cx) return <main className="p-8 text-white/70">Cargando…</main>;

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

      {/* Descuentos automáticos */}
      <section className="card mt-6 space-y-3">
        <p className="font-display font-bold text-ball text-sm">Descuentos por baja demanda</p>
        <p className="text-white/50 text-xs">Los turnos en estos horarios ofrecen precio con descuento automático al jugador.</p>

        <input className="input" placeholder="Nombre (ej: Happy hour miércoles)"
          value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />

        <div className="flex flex-wrap gap-2">
          {DAYS.map(d => (
            <button key={d.k} onClick={() => toggleDia(d.k)}
              className={`px-3 py-2 rounded-xl text-xs font-black uppercase
                ${f.weekdays.includes(d.k) ? 'bg-ball text-courtdark' : 'bg-white/10 text-white/50'}`}>
              {d.l}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div><label className="label">Desde</label>
            <input className="input" type="time" value={f.from_time}
              onChange={e => setF({ ...f, from_time: e.target.value })} /></div>
          <div><label className="label">Hasta</label>
            <input className="input" type="time" value={f.to_time}
              onChange={e => setF({ ...f, to_time: e.target.value })} /></div>
          <div><label className="label">% off</label>
            <input className="input text-center" type="number" min={5} max={70}
              value={f.discount_pct} onChange={e => setF({ ...f, discount_pct: e.target.value })} /></div>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button onClick={crearRegla} className="btn-ball w-full">Crear regla</button>
      </section>

      <section className="mt-4 space-y-2 pb-8">
        <p className="font-display font-bold text-ball text-sm">Reglas activas</p>
        {rules.length === 0 && <p className="text-white/40 text-sm">Todavía no cargaste ninguna.</p>}
        {rules.map(r => {
          const dias = DAYS.filter(d => r.weekdays?.includes(d.k)).map(d => d.l).join(' ');
          return (
            <div key={r.id} className="card flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{r.name} · -{r.discount_pct}%</p>
                <p className="text-white/50 text-xs truncate">{dias} · {r.from_time?.slice(0, 5)}-{r.to_time?.slice(0, 5)}</p>
              </div>
              <button onClick={() => toggleRegla(r)}
                className={`text-xs font-bold px-2.5 py-1.5 rounded-lg shrink-0 ${r.active ? 'bg-ball text-courtdark' : 'bg-white/10 text-white/50'}`}>
                {r.active ? 'ON' : 'OFF'}
              </button>
              <button onClick={() => borrarRegla(r)} className="text-white/40 shrink-0">×</button>
            </div>
          );
        })}
      </section>
    </main>
  );
}
