'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import Brand from '@/components/Brand';

export default function LoginComplejo() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError('');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setError('Email o contraseña incorrectos.');
    const { data: p } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
    if (p?.role !== 'complex_admin' && p?.role !== 'super_admin') {
      await supabase.auth.signOut();
      return setError('Esta cuenta es de jugador. Entrá por el acceso de jugadores.');
    }
    router.push('/complejo/dashboard');
  }

  return (
    <main className="px-6 py-16">
      <Brand variant="full" size={36} className="mb-6" />
      <h1 className="font-display font-black text-3xl">Portal de complejos</h1>
      <p className="text-white/70 mt-1">Administrá canchas, reservas y torneos.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <input className="input" type="email" placeholder="Email"
          value={email} onChange={e => setEmail(e.target.value)} required />
        <input className="input" type="password" placeholder="Contraseña"
          value={password} onChange={e => setPassword(e.target.value)} required />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button className="btn-ball w-full text-lg">Entrar</button>
      </form>
      <p className="mt-3 text-center">
        <Link href="/recuperar" className="text-white/60 text-sm underline">Olvidé mi contraseña</Link>
      </p>
      <p className="mt-6 text-white/70">
        ¿Todavía no cargaste tu complejo?{' '}
        <Link href="/complejo/registro" className="text-ball font-semibold">Registralo acá</Link>
      </p>
    </main>
  );
}
