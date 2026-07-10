'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { notify } from '@/lib/notify';

export default function Alumnos() {
  const [me, setMe] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState('');

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMe(user.id);
    const { data } = await supabase.from('coach_students')
      .select('nickname, player:profiles!player_id(id, username, first_name, last_name, avatar_url, category)')
      .eq('coach_id', user.id)
      .order('created_at', { ascending: false });
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (q.trim().length < 2) return setCandidates([]);
    supabase.from('profiles')
      .select('id, username, first_name, last_name, avatar_url, category, role')
      .eq('role', 'player')
      .or(`username.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
      .limit(8)
      .then(({ data }) => setCandidates(data ?? []));
  }, [q]);

  async function agregar(p: any) {
    setError('');
    if (!me) return;
    const { error: err } = await supabase.from('coach_students').insert({ coach_id: me, player_id: p.id });
    if (err) return setError(err.code === '23505' ? 'Ese alumno ya está en tu lista.' : err.message);
    const { data: coach } = await supabase.from('profiles').select('first_name, last_name').eq('id', me).single();
    await notify({
      user_id: p.id, kind: 'coach_add',
      title: `Un profe te agregó como alumno`,
      body: coach ? `${coach.first_name} ${coach.last_name} va a poder registrar tus sesiones.` : null,
      link: '/jugador/entrenamientos'
    });
    setQ(''); setCandidates([]); load();
  }

  async function quitar(pid: string) {
    if (!me) return;
    if (!confirm('¿Quitar este alumno de tu lista? Sus entrenamientos no se borran.')) return;
    await supabase.from('coach_students').delete().eq('coach_id', me).eq('player_id', pid);
    load();
  }

  return (
    <main className="px-5 py-6">
      <h1 className="font-display font-black text-2xl">Alumnos</h1>
      <p className="text-white/50 text-sm">Vinculá jugadores de la app para registrarles sesiones y compartir su dashboard.</p>

      <section className="card mt-4">
        <p className="font-display font-bold text-ball text-sm">Buscar jugador</p>
        <input className="input mt-2" placeholder="Usuario, nombre o apellido" value={q} onChange={e => setQ(e.target.value)} />
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        {candidates.length > 0 && (
          <div className="mt-3 space-y-2">
            {candidates.map(p => (
              <button key={p.id} onClick={() => agregar(p)}
                className="w-full text-left bg-white/5 rounded-xl p-3 flex items-center gap-3">
                {p.avatar_url
                  ? <img src={p.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                  : <span className="w-9 h-9 rounded-full bg-court text-white font-display font-black flex items-center justify-center text-sm">{p.first_name?.[0]}</span>}
                <span className="flex-1 min-w-0">
                  <span className="font-semibold block truncate">{p.first_name} {p.last_name}</span>
                  <span className="text-white/40 text-xs block">@{p.username} · cat. {p.category}</span>
                </span>
                <span className="text-ball font-black">+</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="mt-4">
        <p className="font-display font-bold text-ball text-sm mb-2">Mis alumnos ({rows.length})</p>
        {rows.length === 0 && <p className="text-white/40 text-sm">Todavía no agregaste alumnos.</p>}
        <ul className="space-y-2">
          {rows.map(r => r.player && (
            <li key={r.player.id} className="card flex items-center gap-3">
              <Link href={`/training/alumno/${r.player.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                {r.player.avatar_url
                  ? <img src={r.player.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover" />
                  : <span className="w-11 h-11 rounded-full bg-court text-white font-display font-black flex items-center justify-center">{r.player.first_name?.[0]}</span>}
                <span className="flex-1 min-w-0">
                  <span className="font-display font-bold truncate block">{r.player.first_name} {r.player.last_name}</span>
                  <span className="text-white/50 text-xs truncate block">@{r.player.username} · cat. {r.player.category}</span>
                </span>
              </Link>
              <button onClick={() => quitar(r.player.id)} className="text-white/40 text-xs shrink-0 px-2">Quitar</button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
