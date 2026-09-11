'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

// Botón "Continuar con Google" usando Google Identity Services (cliente-side).
// El popup muestra "narvoq.com.ar" en vez de "xxx.supabase.co" — más limpio.
// Requiere NEXT_PUBLIC_GOOGLE_CLIENT_ID en Vercel + JS Origins autorizados.

declare global {
  interface Window { google?: any; }
}

let scriptLoaded = false;
function loadGoogleScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (scriptLoaded && window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve) => {
    const existing = document.getElementById('gsi-script');
    if (existing) { existing.addEventListener('load', () => resolve()); return; }
    const s = document.createElement('script');
    s.id = 'gsi-script';
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true;
    s.onload = () => { scriptLoaded = true; resolve(); };
    document.head.appendChild(s);
  });
}

export default function GoogleAuthButton({ role, label }: {
  role: 'player' | 'coach' | 'complex';
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return;
    loadGoogleScript().then(() => {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: onCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
        ux_mode: 'popup'
      });
      setReady(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function onCredential(response: any) {
    if (!response?.credential) return;
    setBusy(true); setError('');
    try {
      const { data, error: err } = await supabase.auth.signInWithIdToken({
        provider: 'google', token: response.credential
      });
      if (err) throw err;
      if (!data.user) throw new Error('sin user');

      // Guardar el rol elegido para que /completar-perfil sepa a dónde mandar
      try { sessionStorage.setItem('narvoq-signup-role', role); } catch {}

      // Rebote via /auth/callback para completar-perfil o dashboard
      window.location.href = `/auth/callback?role=${role}&via=gis`;
    } catch (e: any) {
      setError('No se pudo iniciar con Google: ' + (e?.message ?? 'error'));
      setBusy(false);
    }
  }

  async function loginWithGoogle() {
    setError('');
    if (!clientId) {
      // Fallback al flujo viejo si no hay client_id configurado
      setBusy(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback?role=${role}` }
      });
      if (error) { setError(error.message); setBusy(false); }
      return;
    }
    if (!ready || !window.google?.accounts?.id) {
      setError('Google Identity todavía no cargó, esperá 2 seg y probá de nuevo.');
      return;
    }
    // Dispara el popup nativo de Google
    window.google.accounts.id.prompt((notification: any) => {
      if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
        // Si no se muestra (bloqueado, cerrado antes), fallback a signInWithOAuth
        supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}/auth/callback?role=${role}` }
        });
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        ref={btnRef}
        onClick={loginWithGoogle}
        disabled={busy}
        type="button"
        className="w-full bg-white text-[#0F141D] font-black rounded-2xl py-4 text-base flex items-center justify-center gap-3 disabled:opacity-60 active:scale-[0.98] transition">
        <svg width="20" height="20" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        {busy ? 'Redirigiendo…' : (label ?? 'Continuar con Google')}
      </button>
      {error && <p className="text-red-400 text-xs text-center">{error}</p>}
    </div>
  );
}

export function AuthDivider() {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex-1 h-px bg-white/10" />
      <span className="text-white/40 text-xs font-bold">o</span>
      <div className="flex-1 h-px bg-white/10" />
    </div>
  );
}
