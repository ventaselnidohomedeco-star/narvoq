'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import PhotoPicker from '@/components/PhotoPicker';

const DAYS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const SPECIALTIES = [
  { k: 'competencia', l: 'Competencia' },
  { k: 'iniciacion', l: 'Iniciación' },
  { k: 'infantil', l: 'Infantil' },
  { k: 'femenino', l: 'Femenino' },
  { k: 'padel_adaptado', l: 'Pádel adaptado' },
  { k: 'tecnica', l: 'Foco técnico' },
  { k: 'fisico', l: 'Foco físico' }
];

export default function PerfilProfe() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [f, setF] = useState({
    first_name: '', last_name: '', phone: '', bio: '', zone: '',
    years_experience: '', specialty: '', level_min: '1', level_max: '8',
    price_individual: '', price_group: '',
    coach_complexes: '' // csv en UI
  });
  const [availability, setAvailability] = useState<Record<string, { from: string; to: string }>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setMe(data);
    setF({
      first_name: data?.first_name ?? '',
      last_name: data?.last_name ?? '',
      phone: data?.phone ?? '',
      bio: data?.bio ?? '',
      zone: data?.zone ?? '',
      years_experience: data?.years_experience?.toString() ?? '',
      specialty: data?.specialty ?? '',
      level_min: data?.level_min?.toString() ?? '1',
      level_max: data?.level_max?.toString() ?? '8',
      price_individual: data?.price_individual?.toString() ?? '',
      price_group: data?.price_group?.toString() ?? '',
      coach_complexes: Array.isArray(data?.coach_complexes) ? data.coach_complexes.join(', ') : ''
    });
    const av = Array.isArray(data?.availability) ? data.availability : [];
    const map: any = {};
    av.forEach((a: any) => { map[a.day] = { from: a.from, to: a.to }; });
    setAvailability(map);
  }
  useEffect(() => { load(); }, []);

  async function guardar() {
    if (!me) return;
    setSaving(true); setMsg('');
    const availabilityArr = Object.entries(availability)
      .filter(([_, v]) => v?.from && v?.to)
      .map(([day, v]) => ({ day, from: v.from, to: v.to }));
    const { error } = await supabase.from('profiles').update({
      first_name: f.first_name, last_name: f.last_name, phone: f.phone,
      bio: f.bio || null, zone: f.zone || null,
      years_experience: f.years_experience ? Number(f.years_experience) : null,
      specialty: f.specialty || null,
      level_min: Number(f.level_min), level_max: Number(f.level_max),
      price_individual: f.price_individual ? Number(f.price_individual) : null,
      price_group: f.price_group ? Number(f.price_group) : null,
      coach_complexes: f.coach_complexes.split(',').map(s => s.trim()).filter(Boolean),
      availability: availabilityArr
    }).eq('id', me.id);
    setSaving(false);
    if (error) return setMsg(`${error.message}. ¿Ejecutaste update-12-coach-profile.sql?`);
    setMsg('Guardado ✓');
  }

  async function saveAvatar(url: string) {
    if (!me) return;
    await supabase.from('profiles').update({ avatar_url: url }).eq('id', me.id);
    setMe({ ...me, avatar_url: url });
  }

  async function salir() {
    await supabase.auth.signOut();
    router.push('/');
  }

  function toggleDay(day: string) {
    setAvailability(prev => {
      if (prev[day]) {
        const { [day]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [day]: { from: '16:00', to: '22:00' } };
    });
  }

  if (!me) return <main className="p-8 text-white/60">Cargando…</main>;

  return (
    <main className="px-5 py-6">
      <h1 className="font-display font-black text-2xl">Mi perfil</h1>
      <p className="text-white/50 text-sm">@{me.username}</p>

      <section className="card mt-4 flex items-center gap-4">
        <PhotoPicker folder="avatars" current={me.avatar_url} shape="circle" onUploaded={saveAvatar} />
        <div>
          <p className="font-display font-black text-lg">{me.first_name} {me.last_name}</p>
          <p className="text-white/50 text-xs">Tocá la foto para cambiarla</p>
        </div>
      </section>

      <section className="card mt-4 space-y-3">
        <p className="font-display font-bold text-ball text-sm">Datos personales</p>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Nombre</label>
            <input className="input" value={f.first_name} onChange={e => setF({ ...f, first_name: e.target.value })} /></div>
          <div><label className="label">Apellido</label>
            <input className="input" value={f.last_name} onChange={e => setF({ ...f, last_name: e.target.value })} /></div>
        </div>
        <div><label className="label">Celular</label>
          <input className="input" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></div>
        <div><label className="label">Zona / club donde entrenás</label>
          <input className="input" value={f.zone} onChange={e => setF({ ...f, zone: e.target.value })} /></div>
        <div><label className="label">Bio</label>
          <textarea className="input" rows={3} value={f.bio} onChange={e => setF({ ...f, bio: e.target.value })} /></div>
      </section>

      <section className="card mt-4 space-y-3">
        <p className="font-display font-bold text-ball text-sm">Perfil profesional</p>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Años de experiencia</label>
            <input className="input" type="number" min={0} max={70}
              value={f.years_experience} onChange={e => setF({ ...f, years_experience: e.target.value })} /></div>
          <div><label className="label">Especialidad</label>
            <select className="input" value={f.specialty} onChange={e => setF({ ...f, specialty: e.target.value })}>
              <option value="">Elegí…</option>
              {SPECIALTIES.map(s => <option key={s.k} value={s.k}>{s.l}</option>)}
            </select></div>
        </div>
        <div>
          <label className="label">Nivel de alumnos que entrenás (1 = mejor, 8 = principiante)</label>
          <div className="flex items-center gap-2">
            <select className="input !w-24 text-center" value={f.level_min}
              onChange={e => setF({ ...f, level_min: e.target.value })}>
              {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="text-white/50">a</span>
            <select className="input !w-24 text-center" value={f.level_max}
              onChange={e => setF({ ...f, level_max: e.target.value })}>
              {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <div><label className="label">Complejos donde trabajás (separados por coma)</label>
          <input className="input" value={f.coach_complexes}
            onChange={e => setF({ ...f, coach_complexes: e.target.value })}
            placeholder="Ej: Padel Total, Club Náutico, Sport Center" /></div>
      </section>

      <section className="card mt-4 space-y-3">
        <p className="font-display font-bold text-ball text-sm">Tarifas</p>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Clase individual $</label>
            <input className="input" type="number" inputMode="numeric" placeholder="Ej: 15000"
              value={f.price_individual} onChange={e => setF({ ...f, price_individual: e.target.value })} /></div>
          <div><label className="label">Clase grupal $ (por persona)</label>
            <input className="input" type="number" inputMode="numeric" placeholder="Ej: 8000"
              value={f.price_group} onChange={e => setF({ ...f, price_group: e.target.value })} /></div>
        </div>
      </section>

      <section className="card mt-4 space-y-3">
        <p className="font-display font-bold text-ball text-sm">Disponibilidad semanal</p>
        <p className="text-white/50 text-xs">Marcá los días que atendés y el rango horario.</p>
        <div className="space-y-2">
          {DAYS.map(d => {
            const on = !!availability[d];
            const slot = availability[d] ?? { from: '16:00', to: '22:00' };
            return (
              <div key={d} className="flex items-center gap-2">
                <button onClick={() => toggleDay(d)}
                  className={`w-14 py-2 rounded-lg text-xs font-black uppercase ${on ? 'bg-ball text-courtdark' : 'bg-white/10 text-white/50'}`}>
                  {d}
                </button>
                {on && (
                  <>
                    <input type="time" value={slot.from}
                      onChange={e => setAvailability({ ...availability, [d]: { ...slot, from: e.target.value } })}
                      className="input flex-1 text-center" />
                    <span className="text-white/50">–</span>
                    <input type="time" value={slot.to}
                      onChange={e => setAvailability({ ...availability, [d]: { ...slot, to: e.target.value } })}
                      className="input flex-1 text-center" />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {msg && <p className={`mt-4 text-sm ${msg.startsWith('Guardado') ? 'text-ball' : 'text-red-400'}`}>{msg}</p>}
      <button onClick={guardar} disabled={saving} className="mt-4 btn-ball w-full disabled:opacity-40">
        {saving ? 'Guardando…' : 'Guardar cambios'}
      </button>

      <button onClick={salir}
        className="mt-6 w-full py-3 rounded-xl border border-white/15 font-semibold text-white/70">
        Cerrar sesión
      </button>
    </main>
  );
}
