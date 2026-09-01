'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

// Envuelve una página del complejo con un modal de PIN de 4 dígitos.
// Solo el dueño (que configuró el PIN en Perfil) puede entrar.
// Se recuerda por sesión — mientras no cierres el navegador, no vuelve a pedir.
// Si el complejo NO configuró PIN, pasa directo (con aviso para configurarlo).

const SESSION_KEY = 'narvoq-admin-pin-ok';

export default function AdminPinGate({ children, label = 'esta sección' }: { children: React.ReactNode; label?: string }) {
  const [state, setState] = useState<'loading' | 'no-pin' | 'locked' | 'ok'>('loading');
  const [pinInput, setPinInput] = useState('');
  const [complexPin, setComplexPin] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setState('locked');
      const { data } = await supabase.from('complexes').select('admin_pin').eq('owner_id', user.id).maybeSingle();
      const pin = data?.admin_pin ?? null;
      setComplexPin(pin);
      if (!pin) { setState('no-pin'); return; }
      // ¿Ya está desbloqueado en esta sesión?
      try {
        if (sessionStorage.getItem(SESSION_KEY) === pin) return setState('ok');
      } catch {}
      setState('locked');
    })();
  }, []);

  function tryUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (pinInput === complexPin) {
      try { sessionStorage.setItem(SESSION_KEY, pinInput); } catch {}
      setState('ok');
    } else {
      setError('PIN incorrecto');
      setPinInput('');
      setTimeout(() => setError(''), 2000);
    }
  }

  if (state === 'loading') return <main className="p-8 text-white/60">Verificando acceso…</main>;

  if (state === 'no-pin') {
    return (
      <main className="min-h-dvh max-w-md mx-auto px-6 py-16">
        <div className="card !p-6 text-center">
          <p className="text-4xl mb-2">🔒</p>
          <h2 className="font-display font-black text-xl">Protegé {label}</h2>
          <p className="text-white/60 text-sm mt-3">
            Configurá un <b>PIN de 4 dígitos</b> en el Perfil del complejo para que solo vos puedas acceder a esta información sensible.
            Sin PIN, cualquier empleado con acceso al portal la puede ver.
          </p>
          <Link href="/complejo/perfil" className="btn-ball mt-5 inline-block">
            Configurar PIN ahora
          </Link>
          <p className="mt-4">
            <button onClick={() => setState('ok')} className="text-white/40 text-xs underline">
              Continuar sin PIN por ahora
            </button>
          </p>
        </div>
      </main>
    );
  }

  if (state === 'locked') {
    return (
      <main className="min-h-dvh max-w-md mx-auto px-6 py-16">
        <form onSubmit={tryUnlock} className="card !p-6 text-center">
          <p className="text-4xl mb-2">🔒</p>
          <h2 className="font-display font-black text-xl">Ingresá el PIN</h2>
          <p className="text-white/50 text-xs mt-2">Solo el dueño del complejo puede ver {label}</p>
          <input type="password" inputMode="numeric" maxLength={4} autoFocus
            value={pinInput} onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
            className="input mt-4 text-center text-2xl font-black tracking-widest"
            placeholder="••••" />
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          <button type="submit" disabled={pinInput.length !== 4} className="btn-ball w-full mt-4 disabled:opacity-40">
            Desbloquear
          </button>
          <Link href="/complejo/dashboard" className="text-white/40 text-xs mt-4 inline-block">
            ← Volver
          </Link>
        </form>
      </main>
    );
  }

  return <>{children}</>;
}
