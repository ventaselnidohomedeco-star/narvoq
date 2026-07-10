'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

const TYPES: Record<string, string> = {
  tecnica: 'Técnica',
  fisico: 'Físico',
  clase_individual: 'Clase individual',
  clase_grupal: 'Clase grupal',
  partido_entrenamiento: 'Partido entrenamiento'
};

const avg = (items: any[], key: string) => {
  const nums = items.map(i => Number(i[key] ?? 0)).filter(Boolean);
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
};

export default function AlumnoDashboard() {
  const { id } = useParams<{ id: string }>();
  const [me, setMe] = useState<any>(null);
  const [player, setPlayer] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [f, setF] = useState({
    type: 'tecnica',
    date: new Date().toISOString().slice(0, 10),
    duration_min: '60',
    focus: 'bandeja, víbora y salida de pared',
    goals: '',
    intensity: '6',
    technical_score: '6',
    tactical_score: '6',
    physical_score: '6',
    homework: '',
    notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: coach } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setMe(coach);
    const { data: p } = await supabase.from('profiles').select('*').eq('id', id).single();
    setPlayer(p);
    const { data } = await supabase.from('trainings')
      .select('*')
      .eq('player_id', id)
      .order('date', { ascending: false })
      .limit(60);
    setItems(data ?? []);
  }
  useEffect(() => { if (id) load(); }, [id]);

  async function guardar() {
    if (!me || !player) return;
    setSaving(true); setErr('');
    const { error } = await supabase.from('trainings').insert({
      player_id: player.id,
      coach_id: me.id,
      coach: `${me.first_name} ${me.last_name}`,
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
      shared_with_player: true
    });
    setSaving(false);
    if (error) return setErr(error.message);
    setF({ ...f, goals: '', homework: '', notes: '' });
    load();
  }

  async function compartir() {
    if (!player) return;
    const url = `${location.origin}/u/${player.username}`;
    try {
      if (navigator.share) await navigator.share({ title: `Dashboard de ${player.first_name}`, url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch { /* usuario cancela */ }
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

  if (!player) return <main className="p-8 text-white/60">Cargando alumno…</main>;

  return (
    <main className="px-5 py-6">
      <Link href="/training/alumnos" className="text-ball text-xs font-bold">← Alumnos</Link>
      <header className="mt-3 flex items-center gap-3">
        {player.avatar_url
          ? <img src={player.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover" />
          : <span className="w-14 h-14 rounded-full bg-court text-white font-display font-black flex items-center justify-center text-lg">{player.first_name?.[0]}</span>}
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-black text-xl truncate">{player.first_name} {player.last_name}</h1>
          <p className="text-white/50 text-xs truncate">@{player.username} · cat. {player.category}</p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 mt-4">
        <button onClick={compartir} className="btn-ball">{copied ? 'Link copiado' : 'Compartir con el alumno'}</button>
        <Link href={`/u/${player.username}`} className="text-center py-3 rounded-xl border border-white/15 font-semibold">Ver su perfil público</Link>
      </div>

      <section className="grid grid-cols-3 gap-2 mt-4">
        <div className="card !p-3 text-center"><p className="text-ball font-display font-black text-xl">{stats.sesiones}</p><p className="text-white/40 text-[10px] font-bold">30 días</p></div>
        <div className="card !p-3 text-center"><p className="text-ball font-display font-black text-xl">{stats.minutos}</p><p className="text-white/40 text-[10px] font-bold">minutos</p></div>
        <div className="card !p-3 text-center"><p className="text-ball font-display font-black text-xl">{stats.intensidad}/10</p><p className="text-white/40 text-[10px] font-bold">intensidad</p></div>
      </section>

      <section className="card mt-3">
        <p className="font-display font-bold text-ball text-sm">Balance técnico</p>
        {[
          ['Técnica', stats.tecnica],
          ['Táctica', stats.tactica],
          ['Físico', stats.fisico]
        ].map(([label, value]: any) => (
          <div key={label} className="mt-3">
            <div className="flex justify-between text-xs font-bold text-white/60"><span>{label}</span><span>{value}/10</span></div>
            <div className="mt-1 h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-ball" style={{ width: `${value * 10}%` }} /></div>
          </div>
        ))}
      </section>

      <section className="card mt-4 space-y-3">
        <p className="font-display font-bold text-ball text-sm">Registrar sesión de {player.first_name}</p>
        <div className="grid grid-cols-2 gap-3">
          <select className="input" value={f.type} onChange={e => setF({ ...f, type: e.target.value })}>
            {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input className="input" type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input className="input" type="number" placeholder="Minutos" value={f.duration_min} onChange={e => setF({ ...f, duration_min: e.target.value })} />
          <input className="input" value={f.focus} onChange={e => setF({ ...f, focus: e.target.value })} placeholder="Foco técnico" />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {(['intensity', 'technical_score', 'tactical_score', 'physical_score'] as const).map(k => (
            <div key={k}><label className="label">{k === 'intensity' ? 'Int.' : k === 'technical_score' ? 'Tec.' : k === 'tactical_score' ? 'Tac.' : 'Fis.'}</label>
              <input className="input text-center" type="number" min={1} max={10} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} /></div>
          ))}
        </div>
        <input className="input" placeholder="Objetivo de la sesión" value={f.goals} onChange={e => setF({ ...f, goals: e.target.value })} />
        <input className="input" placeholder="Tarea para el alumno" value={f.homework} onChange={e => setF({ ...f, homework: e.target.value })} />
        <input className="input" placeholder="Notas técnicas" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} />
        {err && <p className="text-red-500 text-sm">{err}</p>}
        <button onClick={guardar} disabled={saving} className="btn-ball w-full disabled:opacity-40">
          {saving ? 'Guardando…' : 'Guardar y compartir con el alumno'}
        </button>
      </section>

      <section className="mt-5 space-y-2">
        <p className="font-display font-bold text-ball text-sm">Historial</p>
        {items.length === 0 && <p className="text-white/40 text-sm">Todavía no hay sesiones cargadas.</p>}
        {items.map(t => (
          <div key={t.id} className="card">
            <div className="flex justify-between gap-3">
              <div>
                <p className="font-semibold">{TYPES[t.type] ?? t.type}{t.coach ? ` — ${t.coach}` : ''}</p>
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
          </div>
        ))}
      </section>
    </main>
  );
}
