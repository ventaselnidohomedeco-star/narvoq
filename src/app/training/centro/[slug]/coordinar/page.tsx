'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const HORAS = Array.from({ length: 16 }, (_, i) => 7 + i); // 7 a 22

export default function CoordinarTurno() {
  const { slug } = useParams<{ slug: string }>();
  const [centro, setCentro] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [alumnos, setAlumnos] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [availability, setAvailability] = useState<any[]>([]);

  // Selección para coordinar
  const [day, setDay] = useState<number>(new Date().getDay());
  const [hour, setHour] = useState<number>(17);
  const [category, setCategory] = useState<string>('any');

  async function load() {
    const { data: c } = await supabase.from('training_centers').select('*').eq('slug', slug).maybeSingle();
    if (!c) { setLoading(false); return; }
    setCentro(c);
    const { data: members } = await supabase.from('center_members')
      .select('id, role, profile:profiles!profile_id(id, first_name, last_name, username, avatar_url, category, phone)')
      .eq('center_id', c.id).eq('active', true);
    const al = (members ?? []).filter((m: any) => m.role === 'student');
    const st = (members ?? []).filter((m: any) => m.role !== 'student');
    setAlumnos(al);
    setStaff(st);
    const ids = (members ?? []).map((m: any) => m.profile?.id).filter(Boolean);
    if (ids.length > 0) {
      const { data: av } = await supabase.from('weekly_availability')
        .select('*').in('profile_id', ids);
      setAvailability(av ?? []);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, [slug]);

  // Chequear si un profile está disponible en el day/hour
  function isAvailable(profileId: string): boolean {
    return availability.some(a => {
      if (a.profile_id !== profileId || a.day_of_week !== day) return false;
      const [sh] = a.start_time.split(':').map(Number);
      const [eh] = a.end_time.split(':').map(Number);
      return hour >= sh && hour < eh;
    });
  }

  const alumnosDisponibles = useMemo(() => {
    return alumnos.filter((a: any) => {
      if (!a.profile?.id) return false;
      if (!isAvailable(a.profile.id)) return false;
      if (category === 'any') return true;
      return String(a.profile.category) === category;
    });
  }, [alumnos, availability, day, hour, category]);

  const coachesDisponibles = useMemo(() => {
    return staff.filter((s: any) => s.profile?.id && isAvailable(s.profile.id));
  }, [staff, availability, day, hour]);

  if (loading) return <main className="p-8 text-white/60">Cargando…</main>;
  if (!centro) return <main className="p-8"><p className="text-white/60">Centro no encontrado</p></main>;

  const hayDatos = availability.length > 0;

  return (
    <main className="min-h-dvh max-w-2xl mx-auto text-white px-5 py-6">
      <Link href={`/training/centro/${slug}`} className="text-white/50 text-xs font-black">← {centro.name}</Link>
      <h1 className="font-display font-black text-2xl mt-1">✨ Coordinar turno</h1>
      <p className="text-white/60 text-sm">Elegí día, hora y categoría → te muestro alumnos y coaches disponibles</p>

      {!hayDatos && (
        <div className="mt-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/40 p-4 text-yellow-100 text-sm">
          ⚠ Todavía no hay disponibilidades cargadas. <Link href={`/training/centro/${slug}/disponibilidad`} className="underline font-black">Cargar horarios →</Link>
        </div>
      )}

      {/* Selector */}
      <div className="mt-5 rounded-2xl bg-gradient-to-br from-ball/10 to-transparent border-2 border-ball/40 p-5 space-y-4">
        {/* Día */}
        <div>
          <p className="text-ball text-[11px] font-black tracking-widest mb-2">DÍA</p>
          <div className="grid grid-cols-7 gap-1.5">
            {DIAS.map((d, i) => (
              <button key={i} onClick={() => setDay(i)}
                className={`py-2 rounded-lg font-black text-xs ${day === i ? 'bg-ball text-black' : 'bg-white/5 text-white/70'}`}>{d}</button>
            ))}
          </div>
        </div>

        {/* Hora */}
        <div>
          <p className="text-ball text-[11px] font-black tracking-widest mb-2">HORA</p>
          <div className="grid grid-cols-8 gap-1">
            {HORAS.map(h => (
              <button key={h} onClick={() => setHour(h)}
                className={`py-2 rounded-lg font-black text-xs ${hour === h ? 'bg-ball text-black' : 'bg-white/5 text-white/70'}`}>{h}h</button>
            ))}
          </div>
        </div>

        {/* Categoría */}
        <div>
          <p className="text-ball text-[11px] font-black tracking-widest mb-2">CATEGORÍA DEL ALUMNO</p>
          <div className="grid grid-cols-9 gap-1">
            <button onClick={() => setCategory('any')}
              className={`py-2 rounded-lg font-black text-xs ${category === 'any' ? 'bg-ball text-black' : 'bg-white/5 text-white/70'}`}>Todas</button>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(cat => (
              <button key={cat} onClick={() => setCategory(String(cat))}
                className={`py-2 rounded-lg font-black text-xs ${category === String(cat) ? 'bg-ball text-black' : 'bg-white/5 text-white/70'}`}>{cat}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Resultados */}
      <section className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-ball text-[11px] font-black tracking-widest">🎓 ALUMNOS DISPONIBLES ({alumnosDisponibles.length})</p>
          <span className="text-white/50 text-xs">{DIAS[day]} {hour}:00 · cat {category === 'any' ? 'todas' : category}</span>
        </div>
        {alumnosDisponibles.length === 0 ? (
          <p className="text-white/40 text-sm py-6 text-center bg-white/5 rounded-xl">
            {hayDatos ? 'Nadie disponible con esos filtros' : 'Cargá disponibilidades primero'}
          </p>
        ) : (
          <div className="space-y-2">
            {alumnosDisponibles.map((a: any) => (
              <div key={a.id} className="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/10">
                {a.profile.avatar_url
                  ? <img src={a.profile.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
                  : <span className="w-11 h-11 rounded-full bg-grafito text-white font-black flex items-center justify-center shrink-0">{a.profile.first_name?.[0]}</span>}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm">{a.profile.first_name} {a.profile.last_name}</p>
                  <p className="text-white/50 text-xs">@{a.profile.username} · cat {a.profile.category ?? '-'}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Link href={`/u/${a.profile.username}`}
                    className="text-[11px] bg-white/10 text-white px-2.5 py-1.5 rounded font-black">👁</Link>
                  {a.profile.phone && (
                    <a href={`https://wa.me/${a.profile.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${a.profile.first_name}! Te propongo turno el ${DIAS[day]} a las ${hour}:00hs en ${centro.name}. ¿Podés?`)}`}
                      target="_blank" rel="noopener"
                      className="text-[11px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-2.5 py-1.5 rounded font-black">💬</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <p className="text-ball text-[11px] font-black tracking-widest mb-2">🎾 COACHES DISPONIBLES ({coachesDisponibles.length})</p>
        {coachesDisponibles.length === 0 ? (
          <p className="text-white/40 text-sm py-6 text-center bg-white/5 rounded-xl">Nadie del staff disponible en ese slot</p>
        ) : (
          <div className="space-y-2">
            {coachesDisponibles.map((c: any) => (
              <div key={c.id} className="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/10">
                {c.profile.avatar_url
                  ? <img src={c.profile.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
                  : <span className="w-11 h-11 rounded-full bg-grafito text-white font-black flex items-center justify-center shrink-0">{c.profile.first_name?.[0]}</span>}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm">{c.profile.first_name} {c.profile.last_name}</p>
                  <p className="text-white/50 text-xs">{c.role === 'master' ? '⭐ Master' : c.role === 'coach' ? '🎾 Coach' : '📝 Asistente'}</p>
                </div>
                {c.profile.phone && (
                  <a href={`https://wa.me/${c.profile.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${c.profile.first_name}! Tenemos turno ${DIAS[day]} a las ${hour}:00hs. ¿Podés?`)}`}
                    target="_blank" rel="noopener"
                    className="text-[11px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-2.5 py-1.5 rounded font-black shrink-0">💬 WA</a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <Link href={`/training/centro/${slug}/disponibilidad`}
        className="mt-6 block text-center text-ball text-sm font-black underline">
        ⚙ Gestionar disponibilidades →
      </Link>
    </main>
  );
}
