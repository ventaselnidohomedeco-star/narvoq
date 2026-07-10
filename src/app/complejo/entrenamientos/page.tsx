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

export default function EntrenamientosComplejo() {
  const [cx, setCx] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [f, setF] = useState({
    player_id: '',
    type: 'tecnica',
    date: new Date().toISOString().slice(0, 10),
    duration_min: '60',
    focus: 'bandeja, vibora y salida de pared',
    goals: '',
    intensity: '6',
    technical_score: '6',
    tactical_score: '6',
    physical_score: '6',
    homework: '',
    notes: ''
  });

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: complex } = await supabase.from('complexes').select('*').eq('owner_id', user!.id).single();
    setCx(complex);
    const { data: trainings } = await supabase.from('trainings')
      .select('*, player:profiles!player_id(id, username, first_name, last_name, avatar_url, category)')
      .eq('complex_id', complex.id)
      .order('date', { ascending: false })
      .limit(80);
    setItems(trainings ?? []);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (q.trim().length < 2) return setPlayers([]);
    supabase.from('profiles')
      .select('id, username, first_name, last_name, avatar_url, category')
      .eq('role', 'player')
      .or(`username.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
      .limit(8)
      .then(({ data }) => setPlayers(data ?? []));
  }, [q]);

  async function guardar() {
    if (!f.player_id || !cx) return;
    await supabase.from('trainings').insert({
      complex_id: cx.id,
      player_id: f.player_id,
      type: f.type,
      date: f.date,
      duration_min: Number(f.duration_min),
      focus: f.focus || null,
      goals: f.goals || null,
      intensity: Number(f.intensity),
      technical_score: Number(f.technical_score),
      tactical_score: Number(f.tactical_score),
      physical_score: Number(f.physical_score),
      homework: f.homework || null,
      notes: f.notes || null,
      coach: cx.name,
      shared_with_player: true
    });
    setF({ ...f, goals: '', homework: '', notes: '' });
    load();
  }

  const resumen = useMemo(() => {
    const total = items.length;
    const minutes = items.reduce((acc, x) => acc + Number(x.duration_min ?? 0), 0);
    const unique = new Set(items.map(x => x.player_id)).size;
    return { total, minutes, unique };
  }, [items]);

  if (!cx) return <main className="p-8 text-white/70">Cargando...</main>;

  return (
    <main className="px-5 py-6">
      <h1 className="font-display font-black text-xl">Entrenamientos</h1>
      <section className="grid grid-cols-3 gap-2 mt-4">
        <div className="card !p-3 text-center"><p className="text-ball font-display font-black text-xl">{resumen.total}</p><p className="text-white/40 text-[10px] font-bold">sesiones</p></div>
        <div className="card !p-3 text-center"><p className="text-ball font-display font-black text-xl">{resumen.unique}</p><p className="text-white/40 text-[10px] font-bold">jugadores</p></div>
        <div className="card !p-3 text-center"><p className="text-ball font-display font-black text-xl">{resumen.minutes}</p><p className="text-white/40 text-[10px] font-bold">minutos</p></div>
      </section>

      <section className="card mt-4 space-y-3">
        <p className="font-display font-bold text-ball text-sm">Registrar sesion para un jugador</p>
        <input className="input" placeholder="Buscar jugador por usuario, nombre o apellido" value={q} onChange={e => setQ(e.target.value)} />
        {players.length > 0 && (
          <div className="grid gap-2">
            {players.map(p => (
              <button key={p.id} onClick={() => { setF({ ...f, player_id: p.id }); setQ(`${p.first_name} ${p.last_name}`); setPlayers([]); }}
                className={`rounded-xl p-3 text-left bg-white/5 ${f.player_id === p.id ? 'ring-2 ring-ball' : ''}`}>
                <p className="font-semibold">{p.first_name} {p.last_name}</p>
                <p className="text-white/40 text-xs">@{p.username} - cat. {p.category}</p>
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <select className="input" value={f.type} onChange={e => setF({ ...f, type: e.target.value })}>
            {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input className="input" type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input className="input" type="number" placeholder="Minutos" value={f.duration_min} onChange={e => setF({ ...f, duration_min: e.target.value })} />
          <input className="input" value={f.focus} onChange={e => setF({ ...f, focus: e.target.value })} placeholder="Foco tecnico" />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {(['intensity', 'technical_score', 'tactical_score', 'physical_score'] as const).map(k => (
            <input key={k} className="input text-center" type="number" min={1} max={10} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} />
          ))}
        </div>
        <input className="input" placeholder="Objetivo de la sesion" value={f.goals} onChange={e => setF({ ...f, goals: e.target.value })} />
        <input className="input" placeholder="Tarea para el jugador" value={f.homework} onChange={e => setF({ ...f, homework: e.target.value })} />
        <input className="input" placeholder="Notas tecnicas" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} />
        <button onClick={guardar} className="btn-ball w-full">Guardar y compartir al jugador</button>
      </section>

      <section className="mt-4 space-y-2">
        {items.map(t => (
          <div key={t.id} className="card">
            <div className="flex justify-between gap-3">
              <div>
                <p className="font-semibold">{t.player?.first_name} {t.player?.last_name}</p>
                <p className="text-ball text-xs font-bold">{TYPES[t.type]} - {t.focus ?? 'sin foco'}</p>
              </div>
              <p className="text-white/40 text-xs">{new Date(t.date + 'T00:00').toLocaleDateString('es-AR')}</p>
            </div>
            {t.homework && <p className="mt-2 text-yellow-200 text-xs">Tarea: {t.homework}</p>}
          </div>
        ))}
      </section>
    </main>
  );
}
