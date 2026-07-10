'use client';
import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Brand from '@/components/Brand';

const CATS = [1, 2, 3, 4, 5, 6, 7, 8];

function RegistroForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/jugador/dashboard';
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [f, setF] = useState({
    first_name: '', last_name: '', phone: '', age: '', sex: 'M',
    city_id: '', zone: '', category: '8', username: '', email: '', password: ''
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
      id: data.user.id, role: 'player', username: f.username.toLowerCase(),
      first_name: f.first_name, last_name: f.last_name, phone: f.phone,
      age: Number(f.age), sex: f.sex, city_id: f.city_id || null,
      zone: f.zone, category: Number(f.category)
    });
    if (pErr) {
      setError(pErr.code === '23505' ? 'Ese nombre de usuario ya está en uso.' : 'Revisá los datos e intentá de nuevo.');
      setLoading(false); return;
    }
    router.push(next);
  }

  return (
    <main className="min-h-dvh px-6 py-10 max-w-md mx-auto">
      <Brand variant="full" size={36} className="mb-6" />
      <h1 className="font-display font-black text-3xl">Crear cuenta</h1>
      <p className="text-white/50 mt-1">En un minuto estás reservando.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Nombre</label><input className="input" value={f.first_name} onChange={set('first_name')} required /></div>
          <div><label className="label">Apellido</label><input className="input" value={f.last_name} onChange={set('last_name')} required /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Celular</label><input className="input" inputMode="tel" value={f.phone} onChange={set('phone')} required /></div>
          <div><label className="label">Edad</label><input className="input" type="number" min={10} max={99} value={f.age} onChange={set('age')} required /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Sexo</label>
            <select className="input" value={f.sex} onChange={set('sex')}>
              <option value="M">Masculino</option><option value="F">Femenino</option><option value="X">Otro</option>
            </select></div>
          <div><label className="label">Categoría</label>
            <select className="input" value={f.category} onChange={set('category')}>
              {CATS.map(c => <option key={c} value={c}>{c} {c === 1 ? '(la mejor)' : c === 8 ? '(principiante)' : ''}</option>)}
            </select></div>
        </div>
        <div><label className="label">Ciudad</label>
          <select className="input" value={f.city_id} onChange={set('city_id')} required>
            <option value="">Elegí tu ciudad</option>
            {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></div>
        <div><label className="label">Zona / localidad</label><input className="input" value={f.zone} onChange={set('zone')} /></div>
        <div className="court-divider my-2" />
        <div><label className="label">Usuario</label><input className="input" value={f.username} onChange={set('username')} required /></div>
        <div><label className="label">Email</label><input className="input" type="email" value={f.email} onChange={set('email')} required /></div>
        <div><label className="label">Contraseña</label><input className="input" type="password" minLength={6} value={f.password} onChange={set('password')} required /></div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button className="btn-ball w-full text-lg" disabled={loading}>{loading ? 'Creando…' : 'Crear cuenta'}</button>
      </form>
    </main>
  );
}

export default function Registro() {
  return (
    <Suspense fallback={<main className="p-8 text-white/70">Cargando...</main>}>
      <RegistroForm />
    </Suspense>
  );
}
