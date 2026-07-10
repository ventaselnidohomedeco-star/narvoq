'use client';
import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import Brand from '@/components/Brand';

export default function Recuperar() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/nueva-contrasena`
    });
    setLoading(false);
    if (error) return setError(error.message);
    setSent(true);
  }

  return (
    <main className="min-h-dvh flex flex-col justify-center px-6 max-w-md mx-auto">
      <Brand variant="full" size={40} className="mb-6" />
      <h1 className="font-display font-black text-3xl">¿Olvidaste tu contraseña?</h1>
      <p className="text-white/60 mt-2">Te mandamos un mail para crear una nueva.</p>

      {sent ? (
        <div className="mt-8 card">
          <p className="font-display font-bold text-ball">Revisá tu casilla ✉️</p>
          <p className="text-white/70 text-sm mt-2">
            Si {email} está registrado, en unos minutos te llega el link para poner una contraseña nueva.
            Mirá también la carpeta de spam.
          </p>
          <Link href="/login" className="mt-4 block text-ball font-semibold">← Volver al login</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div><label className="label">Email de tu cuenta</label>
            <input className="input" type="email" value={email}
              onChange={e => setEmail(e.target.value)} required /></div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button className="btn-ball w-full text-lg" disabled={loading}>
            {loading ? 'Enviando…' : 'Enviarme el link'}
          </button>
          <Link href="/login" className="block text-center text-white/50 text-sm mt-2">← Volver</Link>
        </form>
      )}
    </main>
  );
}
