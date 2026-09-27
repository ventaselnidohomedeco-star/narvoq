'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

const DIAS = [
  { i: 1, l: 'Lunes' }, { i: 2, l: 'Martes' }, { i: 3, l: 'Miércoles' },
  { i: 4, l: 'Jueves' }, { i: 5, l: 'Viernes' }, { i: 6, l: 'Sábado' }, { i: 0, l: 'Domingo' }
];
const HORAS = Array.from({ length: 16 }, (_, i) => 7 + i);

export default function Disponibilidad() {
  const { slug } = useParams<{ slug: string }>();
  const [me, setMe] = useState<any>(null);
  const [centro, setCentro] = useState<any>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [target, setTarget] = useState<string>(''); // profile_id del que editamos disponibilidad
  const [members, setMembers] = useState<any[]>([]);
  const [avail, setAvail] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    setMe(p);
    const { data: c } = await supabase.from('training_centers').select('*').eq('slug', slug).maybeSingle();
    if (!c) { setLoading(false); return; }
    setCentro(c);
    const { data: cm } = await supabase.from('center_members')
      .select('id, role, profile:profiles!profile_id(id, first_name, last_name, avatar_url)')
      .eq('center_id', c.id).eq('active', true);
    setMembers(cm ?? []);
    const my = (cm ?? []).find((m: any) => m.profile?.id === user.id);
    setMyRole(my?.role ?? null);
    // Por defecto, editar mi propia disponibilidad
    setTarget(user.id);
    setLoading(false);
  }
  useEffect(() => { load(); }, [slug]);

  useEffect(() => {
    if (!target || !centro) return;
    (async () => {
      const { data } = await supabase.from('weekly_availability')
        .select('*').eq('profile_id', target);
      setAvail(data ?? []);
    })();
  }, [target, centro]);

  // Set con "dia:hora" para lookup rápido
  const slotsActivos = useMemo(() => {
    const s = new Set<string>();
    avail.forEach(a => {
      const [sh] = a.start_time.split(':').map(Number);
      const [eh] = a.end_time.split(':').map(Number);
      for (let h = sh; h < eh; h++) s.add(`${a.day_of_week}:${h}`);
    });
    return s;
  }, [avail]);

  async function toggleSlot(dia: number, hora: number) {
    if (!target || !centro) return;
    const key = `${dia}:${hora}`;
    if (slotsActivos.has(key)) {
      // Borrar el rango que contiene esta hora
      const rango = avail.find(a => {
        if (a.day_of_week !== dia) return false;
        const [sh] = a.start_time.split(':').map(Number);
        const [eh] = a.end_time.split(':').map(Number);
        return hora >= sh && hora < eh;
      });
      if (rango) {
        await supabase.from('weekly_availability').delete().eq('id', rango.id);
        // Re-crear los slots restantes (si borré una hora del medio, hay que partir)
        const [sh] = rango.start_time.split(':').map(Number);
        const [eh] = rango.end_time.split(':').map(Number);
        const rows: any[] = [];
        if (sh < hora) rows.push({ profile_id: target, center_id: centro.id, day_of_week: dia, start_time: `${sh.toString().padStart(2,'0')}:00`, end_time: `${hora.toString().padStart(2,'0')}:00` });
        if (hora + 1 < eh) rows.push({ profile_id: target, center_id: centro.id, day_of_week: dia, start_time: `${(hora+1).toString().padStart(2,'0')}:00`, end_time: `${eh.toString().padStart(2,'0')}:00` });
        if (rows.length) await supabase.from('weekly_availability').insert(rows);
      }
    } else {
      // Crear 1 hora
      await supabase.from('weekly_availability').insert({
        profile_id: target, center_id: centro.id, day_of_week: dia,
        start_time: `${hora.toString().padStart(2,'0')}:00`,
        end_time: `${(hora+1).toString().padStart(2,'0')}:00`
      });
    }
    // Refrescar
    const { data } = await supabase.from('weekly_availability').select('*').eq('profile_id', target);
    setAvail(data ?? []);
  }

  async function borrarTodo() {
    if (!target || !confirm('¿Borrar toda la disponibilidad de este usuario?')) return;
    setSaving(true);
    await supabase.from('weekly_availability').delete().eq('profile_id', target);
    const { data } = await supabase.from('weekly_availability').select('*').eq('profile_id', target);
    setAvail(data ?? []);
    setSaving(false);
  }

  if (loading) return <main className="p-8 text-white/60">Cargando…</main>;
  if (!centro) return <main className="p-8"><p className="text-white/60">Centro no encontrado</p></main>;

  const isMaster = myRole === 'master';
  const targetMember = members.find(m => m.profile?.id === target);

  return (
    <main className="min-h-dvh max-w-3xl mx-auto text-white px-5 py-6">
      <Link href={`/training/centro/${slug}`} className="text-white/50 text-xs font-black">← {centro.name}</Link>
      <h1 className="font-display font-black text-2xl mt-1">⏰ Disponibilidad semanal</h1>
      <p className="text-white/60 text-sm">Marcá los horarios en que estás disponible. Tocá una hora para prender o apagar.</p>

      {/* Selector de quién editar (solo master) */}
      {isMaster && (
        <div className="mt-4">
          <p className="text-white/70 text-xs font-black uppercase mb-1.5">Ver/editar disponibilidad de</p>
          <select value={target} onChange={e => setTarget(e.target.value)} className="input w-full">
            <option value={me?.id}>{me?.first_name} {me?.last_name} (yo · master)</option>
            {members.filter(m => m.profile?.id !== me?.id).map((m: any) => (
              <option key={m.id} value={m.profile.id}>
                {m.role === 'coach' ? '🎾' : m.role === 'assistant' ? '📝' : '🎓'} {m.profile.first_name} {m.profile.last_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {targetMember && target !== me?.id && (
        <p className="mt-2 text-xs text-yellow-300">✏ Editando la disponibilidad de {targetMember.profile.first_name}</p>
      )}

      {/* Grilla semanal */}
      <div className="mt-5 rounded-2xl bg-white/5 border border-white/10 p-3 overflow-x-auto">
        <div className="grid gap-1 min-w-[600px]" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
          <div />
          {DIAS.map(d => (
            <div key={d.i} className="text-center text-[11px] font-black text-white/60 pb-1">{d.l.slice(0,3)}</div>
          ))}
          {HORAS.map(h => (
            <>
              <div key={`h${h}`} className="text-right text-[11px] text-white/50 font-bold pr-2 self-center">{h}h</div>
              {DIAS.map(d => {
                const on = slotsActivos.has(`${d.i}:${h}`);
                return (
                  <button key={`${d.i}-${h}`} onClick={() => toggleSlot(d.i, h)}
                    className={`h-10 rounded transition ${on ? 'bg-ball text-black font-black' : 'bg-white/5 hover:bg-white/10'}`}>
                    {on ? '✓' : ''}
                  </button>
                );
              })}
            </>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-white/50 text-xs">{slotsActivos.size} horas marcadas</p>
        <button onClick={borrarTodo} disabled={saving || slotsActivos.size === 0}
          className="text-red-300 text-xs font-black disabled:opacity-40">🗑 Borrar todo</button>
      </div>

      <p className="mt-6 text-white/40 text-xs text-center">
        Estos horarios se cruzan con los del staff en <b className="text-ball">Coordinar turno</b> para sugerir combinaciones automáticas.
      </p>
    </main>
  );
}
