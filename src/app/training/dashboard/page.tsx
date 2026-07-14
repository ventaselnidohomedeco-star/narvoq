'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { BarChart } from '@/components/Charts';

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

export default function TrainingDashboard() {
  const [me, setMe] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setMe(profile);
    const { data: cs } = await supabase.from('coach_students')
      .select('nickname, player:profiles!player_id(id, username, first_name, last_name, avatar_url, category)')
      .eq('coach_id', user.id);
    setStudents(cs ?? []);
    const playerIds = (cs ?? []).map((r: any) => r.player?.id).filter(Boolean);
    if (playerIds.length) {
      const { data } = await supabase.from('trainings')
        .select('*, player:profiles!player_id(id, username, first_name, last_name, avatar_url)')
        .in('player_id', playerIds)
        .order('date', { ascending: false })
        .limit(120);
      setItems(data ?? []);
    } else {
      setItems([]);
    }
  }
  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const last30 = items.filter(i => Date.now() - new Date(i.date).getTime() <= 30 * 86400000);
    return {
      sesiones: last30.length,
      alumnos: students.length,
      minutos: last30.reduce((a, b) => a + Number(b.duration_min ?? 0), 0),
      tecnica: avg(last30, 'technical_score'),
      tactica: avg(last30, 'tactical_score'),
      fisico: avg(last30, 'physical_score'),
      intensidad: avg(last30, 'intensity')
    };
  }, [items, students]);

  const perAlumno = useMemo(() => {
    const map: Record<string, { p: any; sesiones: number; minutos: number; ultima: string | null }> = {};
    students.forEach((s: any) => {
      if (s.player) map[s.player.id] = { p: s.player, sesiones: 0, minutos: 0, ultima: null };
    });
    items.forEach(t => {
      const bucket = map[t.player_id]; if (!bucket) return;
      bucket.sesiones += 1;
      bucket.minutos += Number(t.duration_min ?? 0);
      if (!bucket.ultima || t.date > bucket.ultima) bucket.ultima = t.date;
    });
    return Object.values(map).sort((a, b) => b.sesiones - a.sesiones);
  }, [items, students]);

  return (
    <main className="px-5 py-6">
      <h1 className="font-display font-black text-2xl">Grupo</h1>
      {me && <p className="text-white/50 text-sm">Hola profe {me.first_name}. Últimos 30 días.</p>}

      <section className="grid grid-cols-4 gap-2 mt-4">
        <div className="card !p-3 text-center"><p className="text-ball font-display font-black text-xl">{stats.alumnos}</p><p className="text-white/40 text-[10px] font-bold">alumnos</p></div>
        <div className="card !p-3 text-center"><p className="text-ball font-display font-black text-xl">{stats.sesiones}</p><p className="text-white/40 text-[10px] font-bold">sesiones</p></div>
        <div className="card !p-3 text-center"><p className="text-ball font-display font-black text-xl">{stats.minutos}</p><p className="text-white/40 text-[10px] font-bold">min</p></div>
        <div className="card !p-3 text-center"><p className="text-ball font-display font-black text-xl">{stats.intensidad}/10</p><p className="text-white/40 text-[10px] font-bold">int.</p></div>
      </section>

      <section className="card mt-3">
        <p className="font-display font-black text-ball text-xs tracking-widest">BALANCE DEL GRUPO</p>
        <div className="mt-4">
          <BarChart bars={[
            { label: 'Técnica', value: stats.tecnica, color: '#D8F646' },
            { label: 'Táctica', value: stats.tactica, color: '#A8C22E' },
            { label: 'Físico', value: stats.fisico, color: '#5F7414' }
          ]} max={10} height={140} />
        </div>
        <p className="text-white/40 text-xs mt-2 text-center">Promedio 0-10 sobre las sesiones cargadas</p>
      </section>

      <section className="mt-5">
        <div className="flex justify-between items-center">
          <p className="font-display font-bold text-ball text-sm">Alumnos</p>
          <Link href="/training/alumnos" className="text-ball text-xs font-bold">Administrar →</Link>
        </div>
        {perAlumno.length === 0 && (
          <div className="card mt-2 text-center py-8">
            <p className="text-3xl">🎾</p>
            <p className="text-white/50 mt-2 text-sm">Todavía no sumaste alumnos.</p>
            <Link href="/training/alumnos" className="btn-ball inline-block mt-3">Agregar mi primer alumno</Link>
          </div>
        )}
        <ul className="mt-2 space-y-2">
          {perAlumno.map(row => (
            <li key={row.p.id}>
              <Link href={`/training/alumno/${row.p.id}`} className="card flex items-center gap-3">
                {row.p.avatar_url
                  ? <img src={row.p.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover" />
                  : <span className="w-11 h-11 rounded-full bg-court text-white font-display font-black flex items-center justify-center">{row.p.first_name?.[0]}</span>}
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold truncate">{row.p.first_name} {row.p.last_name}</p>
                  <p className="text-white/50 text-xs truncate">@{row.p.username} · cat. {row.p.category}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-ball font-display font-black">{row.sesiones}</p>
                  <p className="text-white/40 text-[10px] font-bold uppercase">sesiones</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
