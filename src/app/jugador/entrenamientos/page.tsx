'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

const TYPES: Record<string, string> = {
  tecnica: 'Tecnica',
  fisico: 'Fisico',
  clase_individual: 'Clase individual',
  clase_grupal: 'Clase grupal',
  partido_entrenamiento: 'Partido entrenamiento'
};

const avg = (items: any[], key: string) => {
  const nums = items.map(i => Number(i[key] ?? 0)).filter(Boolean);
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
};

export default function Entrenamientos() {
  const [items, setItems] = useState<any[]>([]);
  const [f, setF] = useState({
    type: 'tecnica',
    date: new Date().toISOString().slice(0, 10),
    duration_min: '60',
    notes: '',
    coach: '',
    goals: '',
    focus: 'bandeja y salida de pared',
    intensity: '6',
    technical_score: '6',
    tactical_score: '6',
    physical_score: '6',
    homework: ''
  });

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from('trainings')
      .select('*, complex:complexes(name)')
      .eq('player_id', user!.id)
      .order('date', { ascending: false })
      .limit(60);
    setItems(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function guardar() {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('trainings').insert({
      player_id: user!.id,
      type: f.type,
      date: f.date,
      duration_min: Number(f.duration_min),
      notes: f.notes || null,
      coach: f.coach || null,
      goals: f.goals || null,
      focus: f.focus || null,
      intensity: Number(f.intensity),
      technical_score: Number(f.technical_score),
      tactical_score: Number(f.tactical_score),
      physical_score: Number(f.physical_score),
      homework: f.homework || null,
      shared_with_player: true
    });
    setF({ ...f, notes: '', homework: '' }); load();
  }

  const stats = useMemo(() => {
    const last30 = items.filter(i => Date.now() - new Date(i.date).getTime() <= 30 * 86400000);
    return {
      sesiones: last30.length,
      minutos: last30.reduce((a, b) => a + Number(b.duration_min ?? 0), 0),
      intensidad: avg(last30, 'intensity'),
      tecnica: avg(last30, 'technical_score'),
      tactica: avg(last30, 'tactical_score'),
      fisico: avg(last30, 'physical_score')
    };
  }, [items]);

  return (
    <main className="px-5 pt-8">
      <h1 className="font-display font-black text-2xl">Entrenamientos</h1>

      <section className="grid grid-cols-3 gap-2 mt-4">
        <div className="card !p-3 text-center"><p className="text-ball font-display font-black text-xl">{stats.sesiones}</p><p className="text-white/40 text-[10px] font-bold">30 dias</p></div>
        <div className="card !p-3 text-center"><p className="text-ball font-display font-black text-xl">{stats.minutos}</p><p className="text-white/40 text-[10px] font-bold">minutos</p></div>
        <div className="card !p-3 text-center"><p className="text-ball font-display font-black text-xl">{stats.intensidad}/10</p><p className="text-white/40 text-[10px] font-bold">intensidad</p></div>
      </section>

      <section className="card mt-3">
        <p className="font-display font-bold text-ball text-sm">Balance tecnico</p>
        {[
          ['Tecnica', stats.tecnica],
          ['Tactica', stats.tactica],
          ['Fisico', stats.fisico]
        ].map(([label, value]: any) => (
          <div key={label} className="mt-3">
            <div className="flex justify-between text-xs font-bold text-white/60"><span>{label}</span><span>{value}/10</span></div>
            <div className="mt-1 h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-ball" style={{ width: `${value * 10}%` }} /></div>
          </div>
        ))}
      </section>

      <section className="card mt-4 space-y-3">
        <p className="font-display font-bold text-ball text-sm">Cargar entrenamiento propio</p>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Tipo</label>
            <select className="input" value={f.type} onChange={e => setF({ ...f, type: e.target.value })}>
              {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
          <div><label className="label">Minutos</label>
            <input className="input" type="number" value={f.duration_min}
              onChange={e => setF({ ...f, duration_min: e.target.value })} /></div>
        </div>
        <div><label className="label">Fecha</label>
          <input className="input" type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Profesor</label>
            <input className="input" value={f.coach} onChange={e => setF({ ...f, coach: e.target.value })} placeholder="Ej: Profe Martin" /></div>
          <div><label className="label">Foco principal</label>
            <input className="input" value={f.focus} onChange={e => setF({ ...f, focus: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {(['intensity', 'technical_score', 'tactical_score', 'physical_score'] as const).map(k => (
            <div key={k}><label className="label">{k === 'intensity' ? 'Int.' : k === 'technical_score' ? 'Tec.' : k === 'tactical_score' ? 'Tac.' : 'Fis.'}</label>
              <input className="input text-center" type="number" min={1} max={10} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} /></div>
          ))}
        </div>
        <input className="input" placeholder="Objetivo: mejorar bandeja, bajar errores no forzados..." value={f.goals} onChange={e => setF({ ...f, goals: e.target.value })} />
        <input className="input" placeholder="Tarea: 3 bloques de saque + primera volea" value={f.homework} onChange={e => setF({ ...f, homework: e.target.value })} />
        <input className="input" placeholder="Notas de la sesion" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} />
        <button onClick={guardar} className="btn-ball w-full">Guardar entrenamiento</button>
      </section>

      <ul className="mt-5 space-y-2">
        {items.map(t => (
          <li key={t.id} className="card">
            <div className="flex justify-between gap-3">
              <div>
                <p className="font-semibold">{TYPES[t.type]}{t.coach ? ` - ${t.coach}` : t.complex?.name ? ` - ${t.complex.name}` : ''}</p>
                {t.focus && <p className="text-ball text-xs font-semibold">Foco: {t.focus}</p>}
                {t.goals && <p className="text-white/50 text-sm">{t.goals}</p>}
              </div>
              <div className="text-right text-sm text-white/50 shrink-0">
                <p>{new Date(t.date + 'T00:00').toLocaleDateString('es-AR')}</p>
                <p className="font-bold text-court">{t.duration_min} min</p>
              </div>
            </div>
            {t.homework && <p className="mt-2 text-xs text-yellow-200">Tarea: {t.homework}</p>}
            {t.notes && <p className="mt-1 text-white/45 text-sm">{t.notes}</p>}
          </li>
        ))}
      </ul>
    </main>
  );
}
