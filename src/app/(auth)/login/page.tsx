'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import Brand from '@/components/Brand';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError('Email o contraseña incorrectos.'); setLoading(false); return; }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
    const dest = profile?.role === 'complex_admin' ? '/complejo/dashboard'
      : profile?.role === 'coach' ? '/training/dashboard'
      : '/jugador/dashboard';
    router.push(dest);
  }

  return (
    <main className="min-h-dvh flex flex-col justify-center px-6 max-w-md mx-auto">
      <Brand variant="full" size={40} className="mb-6" />
      <h1 className="font-display font-black text-3xl">Entrar</h1>
      <p className="text-white/50 mt-1">Bienvenido de vuelta a la cancha.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div><label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
        <div><label className="label">Contraseña</label>
          <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button className="btn-court w-full text-lg" disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <p className="mt-4 text-center">
        <Link href="/recuperar" className="text-white/60 text-sm underline">Olvidé mi contraseña</Link>
      </p>
      <p className="mt-6 text-white/50">
        ¿No tenés cuenta? <Link href="/registro" className="text-ball font-semibold">Registrate</Link>
      </p>
    </main>
  );
}
