'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import Brand from '@/components/Brand';

export default function TrainingRegistro() {
  const router = useRouter();
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [f, setF] = useState({
    first_name: '', last_name: '', phone: '', age: '30', sex: 'M',
    city_id: '', zone: '', username: '', email: '', password: '', bio: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { supabase.from('cities').select('id,name').then(({ data }) => setCities(data ?? [])); }, []);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    const { data, error } = await supabase.auth.signUp({ email: f.email, password: f.password });
    if (error || !data.user) { setError(error?.message ?? 'No pudimos crear la cuenta.'); setLoading(false); return; }
    const { error: pErr } = await supabase.from('profiles').insert({
      id: data.user.id, role: 'coach', username: f.username.toLowerCase(),
      first_name: f.first_name, last_name: f.last_name, phone: f.phone,
      age: Number(f.age), sex: f.sex, city_id: f.city_id || null,
      zone: f.zone, category: 4, bio: f.bio || null
    });
    if (pErr) {
      setError(pErr.code === '23505' ? 'Ese usuario ya está en uso.' : pErr.message);
      setLoading(false); return;
    }
    router.push('/training/dashboard');
  }

  return (
    <main className="min-h-dvh px-6 py-10 max-w-md mx-auto">
      <Brand variant="full" size={36} className="mb-4" />
      <p className="font-display font-black text-ball text-sm tracking-widest">TRAINING</p>
      <h1 className="font-display font-black text-3xl mt-1">Crear cuenta de profe</h1>
      <p className="text-white/50 mt-1">Registrá alumnos, cargá sesiones y compartí sus dashboards.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Nombre</label><input className="input" value={f.first_name} onChange={set('first_name')} required /></div>
          <div><label className="label">Apellido</label><input className="input" value={f.last_name} onChange={set('last_name')} required /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Celular</label><input className="input" inputMode="tel" value={f.phone} onChange={set('phone')} required /></div>
          <div><label className="label">Edad</label><input className="input" type="number" min={16} max={99} value={f.age} onChange={set('age')} required /></div>
        </div>
        <div><label className="label">Ciudad</label>
          <select className="input" value={f.city_id} onChange={set('city_id')}>
            <option value="">Elegí tu ciudad</option>
            {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></div>
        <div><label className="label">Zona / club donde entrenás</label>
          <input className="input" value={f.zone} onChange={set('zone')} placeholder="Ej: Club Náutico, Sport Club, etc." /></div>
        <div><label className="label">Bio corta</label>
          <input className="input" value={f.bio} onChange={set('bio')} placeholder="Especialidad, categoría, años de experiencia…" /></div>
        <div className="court-divider my-2" />
        <div><label className="label">Usuario</label><input className="input" value={f.username} onChange={set('username')} required /></div>
        <div><label className="label">Email</label><input className="input" type="email" value={f.email} onChange={set('email')} required /></div>
        <div><label className="label">Contraseña</label><input className="input" type="password" minLength={6} value={f.password} onChange={set('password')} required /></div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button className="btn-ball w-full text-lg" disabled={loading}>{loading ? 'Creando…' : 'Crear cuenta de profe'}</button>
      </form>
      <p className="mt-6 text-white/50">
        ¿Ya sos profe? <Link href="/training/login" className="text-ball font-semibold">Entrá acá</Link>
      </p>
    </main>
  );
}
