'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

// Landing minimalista. Arriba del pliegue: SOLO logo + frase + 3 CTAs por rol.
// Al clickear un rol se abre un drawer con las funciones + Google + email.

type Role = 'player' | 'coach' | 'complex';

const ROLE_INFO: Record<Role, {
  title: string;
  emoji: string;
  color: string;
  loginHref: string;
  registerHref: string;
  features: { emoji: string; title: string; text: string }[];
}> = {
  player: {
    title: 'Soy jugador',
    emoji: '🎾',
    color: 'from-ball/40 via-ball/10 to-transparent',
    loginHref: '/login',
    registerHref: '/registro',
    features: [
      { emoji: '🎾', title: 'Reservá canchas en 3 toques', text: 'Buscás por ciudad, ves horarios libres y reservás sin llamar.' },
      { emoji: '🤝', title: 'Armá partido con amigos', text: 'Compartís un link y tus amigos se suman al turno.' },
      { emoji: '🥇', title: 'Torneos con fixture automático', text: 'La app arma zonas, cruces y bracket sola.' },
      { emoji: '📊', title: 'Ranking real de tu zona', text: 'Ganás torneos, subís puntos. Filtrás por categoría y ciudad.' },
      { emoji: '🎓', title: 'Clases con tu profe', text: 'Tu profe te carga la sesión y vos seguís tu progreso.' },
    ],
  },
  coach: {
    title: 'Soy entrenador',
    emoji: '🎓',
    color: 'from-ball/40 via-ball/10 to-transparent',
    loginHref: '/training/login',
    registerHref: '/training/registro',
    features: [
      { emoji: '👨‍🏫', title: 'Un dashboard por alumno', text: 'Registrás cada sesión: foco, tarea y evaluación 0–10.' },
      { emoji: '📈', title: 'Progreso del grupo', text: 'Métricas de los últimos 30 días: sesiones, minutos, intensidad.' },
      { emoji: '📤', title: 'Compartís por WhatsApp', text: 'Un botón y el alumno ve su progreso en su propia cuenta.' },
      { emoji: '🏆', title: 'Creás tus propios torneos', text: 'Fixture, standings y bracket totalmente automático.' },
    ],
  },
  complex: {
    title: 'Tengo un complejo',
    emoji: '🏟️',
    color: 'from-ball/40 via-ball/10 to-transparent',
    loginHref: '/complejo/login',
    registerHref: '/complejo/registro',
    features: [
      { emoji: '📅', title: 'Calendario 7 días × canchas', text: 'Todos los turnos en una sola grilla, cargás bloqueos manuales.' },
      { emoji: '✅', title: 'Aprobás transferencias con un tap', text: 'El jugador sube el comprobante, vos lo aprobás en 1 segundo.' },
      { emoji: '🏆', title: 'Torneos con plantillas', text: 'Suma 13, Cat. 4ta, mixto… elegís y ya. Se abre inscripción.' },
      { emoji: '👥', title: 'Membresías y socios', text: 'Planes de socio, cobrás por transferencia, controlás vencimientos.' },
      { emoji: '📢', title: 'Publicás promos al feed', text: 'Happy hour, evento o torneo abierto: tus clientes lo ven en el feed.' },
    ],
  },
};

export default function Landing() {
  const [role, setRole] = useState<Role | null>(null);

  return (
    <main className="min-h-dvh bg-[#0B0F16] text-white flex flex-col">
      {/* HERO minimalista — TODO arriba del pliegue */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 relative overflow-hidden">
        {/* Decoración lima muy sutil */}
        <div className="absolute -right-14 -top-16 w-14 h-[380px] bg-ball rotate-[24deg] opacity-80 pointer-events-none" />
        <div className="absolute right-8 -top-16 w-4 h-[240px] bg-ball/30 rotate-[24deg] pointer-events-none" />
        <div className="absolute -left-24 -bottom-24 w-72 h-72 rounded-full opacity-30 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 32% 30%, #F4FF9E 0%, #DCEF52 35%, #A8C22E 72%, transparent 100%)' }} />

        {/* Logo grande */}
        <img
          src="/brand/logo.png?v=5"
          alt="NarvoQ"
          className="relative z-10"
          style={{ height: 140, width: 'auto', objectFit: 'contain', mixBlendMode: 'screen' }}
        />

        {/* Frase corta */}
        <h1 className="relative z-10 font-display font-black text-3xl mt-6 text-center leading-tight">
          Elevá tu juego.
        </h1>
        <p className="relative z-10 text-white/60 text-base mt-2 text-center max-w-xs">
          Reservá, jugá, subí en el ranking.
        </p>

        {/* 3 CTAs por rol */}
        <div className="relative z-10 w-full max-w-sm mt-10 space-y-3">
          <button
            onClick={() => setRole('player')}
            className="w-full bg-ball text-courtdark font-display font-black rounded-2xl py-5 text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition">
            <span className="text-2xl">🎾</span>
            Soy jugador
          </button>
          <button
            onClick={() => setRole('coach')}
            className="w-full bg-white/10 border border-white/15 text-white font-display font-black rounded-2xl py-5 text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition">
            <span className="text-2xl">🎓</span>
            Soy entrenador
          </button>
          <button
            onClick={() => setRole('complex')}
            className="w-full bg-white/10 border border-white/15 text-white font-display font-black rounded-2xl py-5 text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition">
            <span className="text-2xl">🏟️</span>
            Tengo un complejo
          </button>
        </div>

        {/* Ya tengo cuenta */}
        <p className="relative z-10 text-white/50 text-sm mt-8">
          ¿Ya tenés cuenta?{' '}
          <Link href="/login" className="text-ball font-bold underline">Entrar</Link>
        </p>
      </div>

      {/* Drawer al elegir rol */}
      {role && <RoleDrawer role={role} onClose={() => setRole(null)} />}
    </main>
  );
}

// ==================== Drawer del rol ====================

function RoleDrawer({ role, onClose }: { role: Role; onClose: () => void }) {
  const info = ROLE_INFO[role];
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState('');

  // ESC + bloquear scroll de body mientras el drawer está abierto
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  async function loginWithGoogle() {
    setGoogleBusy(true); setError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?role=${role}`
      }
    });
    if (error) {
      setError(`No se pudo iniciar con Google: ${error.message}. Puede ser que Google Auth no esté configurado en Supabase todavía.`);
      setGoogleBusy(false);
    }
    // Si arrancó bien, Supabase te redirige a Google y después vuelve al callback
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md bg-[#0F141D] border-t-2 sm:border-2 border-ball rounded-t-3xl sm:rounded-3xl max-h-[90dvh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
        {/* Handle drawer */}
        <div className="pt-3 pb-1 flex justify-center sm:hidden">
          <div className="w-10 h-1 bg-white/30 rounded-full" />
        </div>

        <div className={`p-6 bg-gradient-to-b ${info.color}`}>
          <div className="flex items-start justify-between">
            <div>
              <span className="text-5xl">{info.emoji}</span>
              <h2 className="font-display font-black text-3xl mt-2 leading-tight">{info.title}</h2>
            </div>
            <button onClick={onClose} className="text-white/60 text-2xl font-bold w-10 h-10 flex items-center justify-center">✕</button>
          </div>
          <p className="text-white/70 text-sm mt-2">Con NarvoQ vas a poder:</p>
        </div>

        {/* Features */}
        <div className="px-6 space-y-4 pb-6">
          {info.features.map((f, i) => (
            <div key={i} className="flex gap-3">
              <span className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center text-2xl shrink-0">{f.emoji}</span>
              <div className="flex-1">
                <p className="font-display font-black text-base leading-tight">{f.title}</p>
                <p className="text-white/60 text-sm mt-0.5">{f.text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="px-6 pb-8 space-y-3 border-t border-white/10 pt-5">
          {/* Continuar con Google */}
          <button
            onClick={loginWithGoogle}
            disabled={googleBusy}
            className="w-full bg-white text-[#0F141D] font-black rounded-2xl py-4 text-base flex items-center justify-center gap-3 disabled:opacity-60 active:scale-[0.98] transition">
            <GoogleIcon />
            {googleBusy ? 'Redirigiendo…' : 'Continuar con Google'}
          </button>

          {/* Crear cuenta con email */}
          <Link
            href={info.registerHref}
            className="w-full block text-center bg-ball text-courtdark font-display font-black rounded-2xl py-4 text-base active:scale-[0.98] transition">
            Crear cuenta con email
          </Link>

          {/* Ya tengo cuenta */}
          <Link
            href={info.loginHref}
            className="w-full block text-center text-white/70 font-bold py-3 underline">
            Ya tengo cuenta · Entrar
          </Link>

          {error && (
            <p className="text-red-400 text-xs text-center pt-2">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Ícono de Google (SVG oficial, colores originales)
function GoogleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
