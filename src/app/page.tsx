'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import InstallButton from '@/components/InstallButton';

// Landing minimalista. Arriba del pliegue: SOLO logo + frase + 3 CTAs por rol.
// Al clickear un rol se abre un drawer con las funciones + Google + email.
// Si el usuario YA está logueado, redirigimos automáticamente al dashboard
// (así al abrir la PWA no ve la landing como si estuviera deslogueado).

type Role = 'player' | 'coach' | 'complex';

const ROLE_INFO: Record<Role, {
  title: string;
  emoji: string;
  loginHref: string;
  registerHref: string;
  features: { emoji: string; title: string; text: string }[];
}> = {
  player: {
    title: 'Soy jugador',
    emoji: '🎾',
    loginHref: '/login',
    registerHref: '/registro',
    features: [
      { emoji: '🎾', title: 'Reservá canchas', text: 'Buscás por ciudad, ves horarios libres y reservás sin llamar.' },
      { emoji: '🔍', title: 'Buscador inteligente', text: 'Encontrá canchas libres por zona y horario en un click. Premium.' },
      { emoji: '🤝', title: 'Armá partido con amigos', text: 'Compartís un link y tus amigos se suman al turno.' },
      { emoji: '🥇', title: 'Torneos automáticos', text: 'Fixture, zonas y bracket armados por la app.' },
      { emoji: '📊', title: 'Ranking de tu zona', text: 'Ganás torneos, subís puntos. Filtrás por categoría.' },
      { emoji: '💬', title: 'Chateá con jugadores', text: 'Smashe@: conocé y armá partidos con nuevos rivales.' },
      { emoji: '📰', title: 'Feed de la comunidad', text: 'Compartí tus partidos, victorias y momentos con la comunidad.' },
      { emoji: '🎓', title: 'Clases con tu profe', text: 'Tu profe carga la sesión y seguís tu progreso.' },
    ],
  },
  coach: {
    title: 'Soy entrenador',
    emoji: '🎓',
    loginHref: '/training/login',
    registerHref: '/training/registro',
    features: [
      { emoji: '👨‍🏫', title: 'Dashboard por alumno', text: 'Registrás cada sesión: foco, tarea y evaluación 0–10.' },
      { emoji: '📈', title: 'Progreso del grupo', text: 'Métricas de los últimos 30 días: sesiones, minutos, intensidad.' },
      { emoji: '🎓', title: 'Perfil público', text: 'Los jugadores te encuentran con tu disponibilidad y tarifas.' },
      { emoji: '📤', title: 'Compartís por WhatsApp', text: 'Un botón y el alumno ve su progreso en su cuenta.' },
      { emoji: '🏆', title: 'Creás torneos propios', text: 'Fixture, standings y bracket totalmente automático.' },
      { emoji: '💎', title: 'Academia Premium', text: 'Vendé clases individuales y packs a jugadores nuevos.' },
    ],
  },
  complex: {
    title: 'Tengo un complejo',
    emoji: '🏟️',
    loginHref: '/complejo/login',
    registerHref: '/complejo/registro',
    features: [
      { emoji: '🎾', title: 'Más canchas ocupadas', text: 'Los jugadores encuentran tus horarios y reservan online, incluso cuando no estás atendiendo.' },
      { emoji: '📅', title: 'Turnos sin perder el control', text: 'Calendario por cancha, reservas online o cargadas desde WhatsApp, bloqueos y turnos fijos.' },
      { emoji: '💰', title: 'Señas, cobros y saldos', text: 'Efectivo, transferencia o Mercado Pago. Pagos parciales, saldos y montos por cobrar.' },
      { emoji: '🔄', title: 'Recuperá cancelaciones', text: 'Liberá el horario, revisá la lista de espera y ofrecelo rápidamente a otro jugador.' },
      { emoji: '👥', title: 'Tu propia base de clientes', text: 'Historial de reservas, pagos, frecuencia, cancelaciones y situación de cada jugador.' },
      { emoji: '🧾', title: 'Cantina, POS y stock', text: 'Registrá ventas, controlá productos, costos, existencias y medios de pago.' },
      { emoji: '📊', title: 'Rentabilidad real', text: 'Conocé la ocupación, ingresos, gastos y rentabilidad de cada cancha.' },
      { emoji: '🏆', title: 'Torneos y comunidad', text: 'Inscripciones, cobros, zonas, resultados y cuadros. Promos para fidelizar jugadores.' },
    ],
  },
};

const COMPLEX_HERO = {
  headline: 'GESTIONÁ Y HACÉ CRECER TU COMPLEJO',
  sub: 'Más turnos ocupados. Menos trabajo por WhatsApp. Todo el negocio bajo control.',
  badge: '60 DÍAS PREMIUM SIN COSTO',
  badgeSub: 'Configuración inicial acompañada · Sin tarjeta',
  softLanding: 'Podés seguir tomando turnos por WhatsApp y centralizarlos en NarvoQ mientras hacés la transición.',
  demoWhatsapp: '5491128565353'   // tu número — el botón "Quiero una demo" abre WhatsApp
};

export default function Landing() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [checking, setChecking] = useState(true);

  // Auto-login: si el usuario ya tiene sesión activa, mandarlo directo al
  // dashboard de su rol. Sin esto, al abrir la PWA ve la landing como si
  // se hubiera deslogueado (aunque la sesión estaba OK).
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setChecking(false); return; }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      const dest = profile?.role === 'coach' ? '/training/dashboard'
        : profile?.role === 'complex_admin' ? '/complejo/dashboard'
        : '/jugador/dashboard';
      router.replace(dest);
    })();
  }, [router]);

  if (checking) return (
    <main className="min-h-dvh bg-[#0B0F16] flex items-center justify-center">
      <img src="/brand/logo.png?v=9" alt="NarvoQ"
        style={{ height: 80, width: 'auto', opacity: 0.6, mixBlendMode: 'screen' }} />
    </main>
  );

  return (
    <main className="min-h-dvh bg-[#0B0F16] text-white flex flex-col">
      {/* HERO minimalista */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 relative overflow-hidden">
        {/* Decoración lima */}
        <div className="absolute -right-14 -top-16 w-14 h-[380px] bg-ball rotate-[24deg] opacity-80 pointer-events-none" />
        <div className="absolute right-8 -top-16 w-4 h-[240px] bg-ball/30 rotate-[24deg] pointer-events-none" />
        <div className="absolute -left-24 -bottom-24 w-72 h-72 rounded-full opacity-30 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 32% 30%, #F4FF9E 0%, #DCEF52 35%, #A8C22E 72%, transparent 100%)' }} />

        {/* Logo grande — desktop más grande aún */}
        <img
          src="/brand/logo.png?v=9"
          alt="NarvoQ"
          className="relative z-10"
          style={{ height: 'clamp(120px, 20vw, 180px)', width: 'auto', objectFit: 'contain', mixBlendMode: 'screen' }}
        />

        {/* Frase corta */}
        <h1 className="relative z-10 font-display font-black text-3xl md:text-5xl mt-6 text-center leading-tight">
          Elevá tu juego.
        </h1>
        <p className="relative z-10 text-white/60 text-base md:text-lg mt-2 text-center max-w-xs md:max-w-md">
          Reservá, jugá, subí en el ranking.
        </p>

        {/* 3 CTAs por rol — más anchos en desktop */}
        <div className="relative z-10 w-full max-w-sm md:max-w-md mt-10 space-y-3">
          <button
            onClick={() => setRole('player')}
            className="w-full bg-ball text-courtdark font-display font-black rounded-2xl py-5 text-lg md:text-xl flex items-center justify-center gap-2 active:scale-[0.98] transition">
            <span className="text-2xl">🎾</span>
            Soy jugador
          </button>
          <button
            onClick={() => setRole('coach')}
            className="w-full bg-white/10 border border-white/15 text-white font-display font-black rounded-2xl py-5 text-lg md:text-xl flex items-center justify-center gap-2 active:scale-[0.98] transition">
            <span className="text-2xl">🎓</span>
            Soy entrenador
          </button>
          <button
            onClick={() => setRole('complex')}
            className="w-full bg-white/10 border border-white/15 text-white font-display font-black rounded-2xl py-5 text-lg md:text-xl flex items-center justify-center gap-2 active:scale-[0.98] transition">
            <span className="text-2xl">🏟️</span>
            Tengo un complejo
          </button>
        </div>

        {/* Ya tengo cuenta */}
        <p className="relative z-10 text-white/50 text-sm mt-8">
          ¿Ya tenés cuenta?{' '}
          <Link href="/login" className="text-ball font-bold underline">Entrar</Link>
        </p>

        {/* Instalar app — solo si NO está instalada ya */}
        <div className="relative z-10 mt-4">
          <InstallButton variant="subtle" />
        </div>
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
      setError(`No se pudo iniciar con Google: ${error.message}. Puede ser que Google Auth no esté configurado.`);
      setGoogleBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg md:max-w-3xl bg-[#0F141D] border-t-2 sm:border-2 border-ball rounded-t-3xl sm:rounded-3xl max-h-[95dvh] animate-in slide-in-from-bottom duration-300 flex flex-col">
        {/* Handle */}
        <div className="pt-3 pb-1 flex justify-center sm:hidden">
          <div className="w-12 h-1.5 bg-white/30 rounded-full" />
        </div>

        {/* Header compacto */}
        <div className="px-6 pt-4 pb-3 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-4xl leading-none shrink-0">{info.emoji}</span>
              <div className="min-w-0">
                {role === 'complex' ? (
                  <>
                    <h2 className="font-display font-black text-xl md:text-2xl leading-tight">{COMPLEX_HERO.headline}</h2>
                    <p className="text-white/70 text-xs md:text-sm mt-1">{COMPLEX_HERO.sub}</p>
                  </>
                ) : (
                  <>
                    <h2 className="font-display font-black text-2xl md:text-3xl leading-tight">{info.title}</h2>
                    <p className="text-white/60 text-xs md:text-sm">Con NarvoQ vas a poder:</p>
                  </>
                )}
              </div>
            </div>
            <button onClick={onClose}
              className="text-white/60 text-xl font-bold w-10 h-10 flex items-center justify-center bg-white/5 rounded-full hover:bg-white/10 shrink-0">✕</button>
          </div>

          {/* Badge trial 60 días — solo complex */}
          {role === 'complex' && (
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-ball/15 border border-ball/40 px-4 py-3">
              <span className="text-2xl leading-none">🎁</span>
              <div className="min-w-0">
                <p className="font-display font-black text-ball text-sm leading-tight">{COMPLEX_HERO.badge}</p>
                <p className="text-white/60 text-[11px]">{COMPLEX_HERO.badgeSub}</p>
              </div>
            </div>
          )}
        </div>

        {/* Features — grilla compacta 2 columnas siempre, sin scroll interno */}
        <div className="px-4 md:px-6 pb-4 grid grid-cols-2 gap-2 md:gap-3 overflow-y-auto flex-1">
          {info.features.map((f, i) => (
            <div key={i} className="bg-white/[0.04] border border-white/10 rounded-xl p-3">
              <span className="text-2xl md:text-3xl block leading-none mb-1.5">{f.emoji}</span>
              <p className="font-display font-black text-sm md:text-base leading-tight">{f.title}</p>
              <p className="text-white/60 text-[11px] md:text-xs mt-1 leading-snug">{f.text}</p>
            </div>
          ))}
          {/* Soft-landing para complex */}
          {role === 'complex' && (
            <div className="col-span-2 rounded-xl bg-white/[0.04] border border-white/10 p-3 flex items-start gap-2">
              <span className="text-xl leading-none">💬</span>
              <p className="text-white/70 text-xs md:text-sm">
                <span className="font-display font-black text-ball">Empezá sin cambiar todo de golpe. </span>
                {COMPLEX_HERO.softLanding}
              </p>
            </div>
          )}
        </div>

        {/* CTAs — pegados abajo, siempre visibles */}
        <div className="px-6 md:px-8 py-4 space-y-2 border-t border-white/10 shrink-0 bg-[#0F141D]">
          {role === 'complex' ? (
            <>
              <a
                href={`https://wa.me/${COMPLEX_HERO.demoWhatsapp}?text=${encodeURIComponent('Hola! Quiero ver una demo de NarvoQ para mi complejo.')}`}
                target="_blank" rel="noopener"
                className="w-full block text-center bg-ball text-courtdark font-display font-black rounded-2xl py-4 text-base active:scale-[0.98] transition">
                💬 Quiero una demo
              </a>
              <Link
                href={info.registerHref}
                className="w-full block text-center bg-white/10 border border-white/20 text-white font-display font-black rounded-2xl py-3.5 text-base active:scale-[0.98] transition">
                Crear mi complejo gratis
              </Link>
              <Link
                href={info.loginHref}
                className="w-full block text-center text-white/70 font-bold py-1 underline text-sm">
                Ya tengo cuenta
              </Link>
            </>
          ) : (
            <>
              <button
                onClick={loginWithGoogle}
                disabled={googleBusy}
                className="w-full bg-white text-[#0F141D] font-black rounded-2xl py-3.5 text-base flex items-center justify-center gap-3 disabled:opacity-60 active:scale-[0.98] transition">
                <GoogleIcon />
                {googleBusy ? 'Redirigiendo…' : 'Continuar con Google'}
              </button>
              <Link
                href={info.registerHref}
                className="w-full block text-center bg-ball text-courtdark font-display font-black rounded-2xl py-3.5 text-base active:scale-[0.98] transition">
                Crear cuenta con email
              </Link>
              <Link
                href={info.loginHref}
                className="w-full block text-center text-white/70 font-bold py-1 underline text-sm">
                Ya tengo cuenta · Entrar
              </Link>
            </>
          )}

          {error && (
            <p className="text-red-400 text-xs text-center pt-2">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

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
