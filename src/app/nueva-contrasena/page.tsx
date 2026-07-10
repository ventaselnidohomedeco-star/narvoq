'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import Brand from '@/components/Brand';

export default function NuevaContrasena() {
  const router = useRouter();
  const [ready, setReady] = useState<'checking' | 'ready' | 'noSession'>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setReady(session ? 'ready' : 'noSession');
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.');
    if (password !== confirm) return setError('Las contraseñas no coinciden.');
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return setError(error.message);
    setOk(true);
    setTimeout(() => router.push('/login'), 1800);
  }

  return (
    <main className="min-h-dvh flex flex-col justify-center px-6 max-w-md mx-auto">
      <Brand variant="full" size={40} className="mb-6" />
      <h1 className="font-display font-black text-3xl">Nueva contraseña</h1>

      {ready === 'checking' && <p className="text-white/60 mt-4">Verificando…</p>}

      {ready === 'noSession' && (
        <div className="mt-6 card">
          <p className="font-display font-bold text-yellow-300">El link expiró o no es válido.</p>
          <p className="text-white/70 text-sm mt-2">
            Pedí un nuevo link desde la página de recuperación.
          </p>
          <Link href="/recuperar" className="btn-ball mt-4 inline-block">Pedir un link nuevo</Link>
        </div>
      )}

      {ready === 'ready' && !ok && (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div><label className="label">Nueva contraseña</label>
            <input className="input" type="password" minLength={6} value={password}
              onChange={e => setPassword(e.target.value)} required autoFocus /></div>
          <div><label className="label">Repetila</label>
            <input className="input" type="password" minLength={6} value={confirm}
              onChange={e => setConfirm(e.target.value)} required /></div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button className="btn-ball w-full text-lg" disabled={loading}>
            {loading ? 'Guardando…' : 'Guardar y entrar'}
          </button>
        </form>
      )}

      {ok && (
        <div className="mt-6 card">
          <p className="font-display font-bold text-ball">Listo ✅</p>
          <p className="text-white/70 text-sm mt-2">Contraseña actualizada. Te llevamos al login.</p>
        </div>
      )}
    </main>
  );
}
