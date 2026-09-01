'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

// Reglas de descuento por baja demanda (happy hour, etc.) para complejos.
// Antes vivía en Rentabilidad — se movió a Canchas porque es config de precios.

const DAYS = [
  { k: 1, l: 'Lun' }, { k: 2, l: 'Mar' }, { k: 3, l: 'Mié' },
  { k: 4, l: 'Jue' }, { k: 5, l: 'Vie' }, { k: 6, l: 'Sáb' }, { k: 0, l: 'Dom' }
];

export default function OffpeakRulesManager({ complexId }: { complexId: string }) {
  const [rules, setRules] = useState<any[]>([]);
  const [f, setF] = useState({
    name: 'Happy hour', weekdays: [1, 2, 3, 4] as number[],
    from_time: '14:00', to_time: '17:00', discount_pct: '20'
  });
  const [error, setError] = useState('');

  async function load() {
    const { data } = await supabase.from('offpeak_rules')
      .select('*').eq('complex_id', complexId)
      .order('created_at', { ascending: false });
    setRules(data ?? []);
  }
  useEffect(() => { load(); }, [complexId]);

  function toggleDia(k: number) {
    setF(prev => prev.weekdays.includes(k)
      ? { ...prev, weekdays: prev.weekdays.filter(d => d !== k) }
      : { ...prev, weekdays: [...prev.weekdays, k].sort() });
  }

  async function crearRegla() {
    setError('');
    if (f.weekdays.length === 0) return setError('Elegí al menos un día de la semana.');
    if (!f.from_time || !f.to_time) return setError('Cargá los horarios.');
    const { error: err } = await supabase.from('offpeak_rules').insert({
      complex_id: complexId, name: f.name.trim() || 'Descuento',
      weekdays: f.weekdays, from_time: f.from_time, to_time: f.to_time,
      discount_pct: Number(f.discount_pct)
    });
    if (err) return setError(err.message);
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

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div>
          <p className="font-display font-bold text-ball text-sm">🕐 Descuentos por baja demanda</p>
          <p className="text-white/50 text-xs mt-1">Turnos en estos horarios muestran precio con descuento automático al jugador.</p>
        </div>

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
      </div>

      <div className="space-y-2">
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
      </div>
    </div>
  );
}
