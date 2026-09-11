'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

// Botón "Continuar con Google" usando Google Identity Services (renderButton).
// El popup muestra tu dominio (narvoq.com.ar) — no aparece el supabase.co.
// Requiere NEXT_PUBLIC_GOOGLE_CLIENT_ID + JS Origins autorizados en Google Console.

declare global { interface Window { google?: any; } }

let scriptLoaded = false;
function loadGoogleScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (scriptLoaded && window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve) => {
    const existing = document.getElementById('gsi-script');
    if (existing) { existing.addEventListener('load', () => { scriptLoaded = true; resolve(); }); return; }
    const s = document.createElement('script');
    s.id = 'gsi-script';
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true;
    s.onload = () => { scriptLoaded = true; resolve(); };
    document.head.appendChild(s);
  });
}

// Nonce aleatorio + hash SHA-256 (requerido por signInWithIdToken)
async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => ('0' + b.toString(16)).slice(-2)).join('');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(buf))
    .map(b => ('0' + b.toString(16)).slice(-2)).join('');
  return { raw, hashed };
}

export default function GoogleAuthButton({ role, label }: {
  role: 'player' | 'coach' | 'complex';
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [nonce, setNonce] = useState<{ raw: string; hashed: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => { makeNonce().then(setNonce); }, []);

  useEffect(() => {
    if (!clientId || !nonce || !containerRef.current) return;
    let cancelled = false;
    loadGoogleScript().then(() => {
      if (cancelled) return;
      if (!window.google?.accounts?.id || !containerRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: onCredential,
        nonce: nonce.hashed,
        auto_select: false,
        ux_mode: 'popup',
        use_fedcm_for_prompt: true
      });
      // Botón oficial de Google renderizado (más confiable que prompt())
      window.google.accounts.id.renderButton(containerRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: (label ?? 'continue_with').includes('Registrarme')
          ? 'signup_with'
          : 'continue_with',
        shape: 'pill',
        logo_alignment: 'left',
        width: containerRef.current.offsetWidth || 320
      });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, nonce]);

  async function onCredential(response: any) {
    if (!response?.credential || !nonce) return;
    setBusy(true); setError('');
    try {
      const { error: err } = await supabase.auth.signInWithIdToken({
        provider: 'google', token: response.credential, nonce: nonce.raw
      });
      if (err) throw err;
      try { sessionStorage.setItem('narvoq-signup-role', role); } catch {}
      window.location.href = `/auth/callback?role=${role}&via=gis`;
    } catch (e: any) {
      setError('No se pudo iniciar con Google: ' + (e?.message ?? 'error'));
      setBusy(false);
    }
  }

  // Fallback si el client_id no está configurado
  if (!clientId) {
    return (
      <button
        onClick={async () => {
          setBusy(true); setError('');
          const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${window.location.origin}/auth/callback?role=${role}` }
          });
          if (error) { setError(error.message); setBusy(false); }
        }}
        disabled={busy} type="button"
        className="w-full bg-white text-[#0F141D] font-black rounded-2xl py-4 text-base flex items-center justify-center gap-3 disabled:opacity-60 active:scale-[0.98] transition">
        {busy ? 'Redirigiendo…' : (label ?? 'Continuar con Google')}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      {/* Google renderiza su propio botón oficial acá */}
      <div ref={containerRef} className="flex justify-center min-h-[44px]" />
      {busy && <p className="text-white/70 text-xs text-center">Ingresando…</p>}
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
