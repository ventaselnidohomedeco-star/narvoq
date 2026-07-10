'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import Brand from '@/components/Brand';

export default function TrainingLogin() {
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
    if (profile?.role !== 'coach' && profile?.role !== 'super_admin') {
      setError('Esta cuenta no es de profe. Registrate como profe para entrar acá.');
      setLoading(false); return;
    }
    router.push('/training/dashboard');
  }

  return (
    <main className="min-h-dvh flex flex-col justify-center px-6 max-w-md mx-auto">
      <Brand variant="full" size={36} className="mb-4" />
      <p className="font-display font-black text-ball text-sm tracking-widest">TRAINING</p>
      <h1 className="font-display font-black text-3xl mt-1">Portal profes</h1>
      <p className="text-white/50 mt-1">Dashboards por alumno y del grupo entero.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div><label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
        <div><label className="label">Contraseña</label>
          <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button className="btn-ball w-full text-lg" disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar como profe'}
        </button>
      </form>
      <p className="mt-3 text-center">
        <Link href="/recuperar" className="text-white/60 text-sm underline">Olvidé mi contraseña</Link>
      </p>
      <p className="mt-6 text-white/50">
        ¿Todavía no tenés cuenta de profe? <Link href="/training/registro" className="text-ball font-semibold">Registrate</Link>
      </p>
    </main>
  );
}
