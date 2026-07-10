'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

/**
 * Algunas cuentas pueden haber quedado sin fila en "profiles"
 * (por ejemplo si el registro se cortó a la mitad). Sin perfil no se puede
 * publicar, reservar ni aparecer en rankings. Este guardián lo detecta
 * y muestra un mini formulario para repararlo en 10 segundos.
 */
export default function ProfileGuard({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'checking' | 'ok' | 'missing'>('checking');
  const [f, setF] = useState({ username: '', first_name: '', last_name: '', age: '25', sex: 'M', category: '8' });
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setState('ok'); // el middleware ya maneja no-logueado
      const { data } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
      setState(data ? 'ok' : 'missing');
    })();
  }, []);

  async function reparar() {
    setError('');
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase.from('profiles').insert({
      id: user!.id, role: 'player', username: f.username.toLowerCase().trim(),
      first_name: f.first_name, last_name: f.last_name, phone: '-',
      age: Number(f.age), sex: f.sex, category: Number(f.category)
    });
    if (err) return setError(err.code === '23505' ? 'Ese usuario ya existe, probá otro.' : err.message);
    setState('ok');
    location.reload();
  }

  if (state === 'missing') return (
    <main className="min-h-dvh flex flex-col justify-center px-6 max-w-md mx-auto">
      <h1 className="font-display font-black text-2xl">Completá tu perfil 🎾</h1>
      <p className="text-white/50 mt-1">Tu cuenta quedó sin perfil de jugador. Completalo para poder publicar y reservar.</p>
      <div className="mt-5 space-y-3">
        <input className="input" placeholder="Usuario (ej: juanperez)" value={f.username}
          onChange={e => setF({ ...f, username: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <input className="input" placeholder="Nombre" value={f.first_name}
            onChange={e => setF({ ...f, first_name: e.target.value })} />
          <input className="input" placeholder="Apellido" value={f.last_name}
            onChange={e => setF({ ...f, last_name: e.target.value })} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <input className="input" type="number" placeholder="Edad" value={f.age}
            onChange={e => setF({ ...f, age: e.target.value })} />
          <select className="input" value={f.sex} onChange={e => setF({ ...f, sex: e.target.value })}>
            <option value="M">Masc</option><option value="F">Fem</option><option value="X">Otro</option>
          </select>
          <select className="input" value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>
            {[1,2,3,4,5,6,7,8].map(c => <option key={c} value={c}>Cat {c}</option>)}
          </select>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button onClick={reparar} className="btn-ball w-full">Guardar y continuar</button>
      </div>
    </main>
  );

  return <>{children}</>;
}
