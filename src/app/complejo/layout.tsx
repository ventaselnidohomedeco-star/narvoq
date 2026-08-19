'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import Banner from '@/components/Banner';
import Bell from '@/components/Bell';
import InstallButton from '@/components/InstallButton';
import VerifiedBadge from '@/components/VerifiedBadge';

// Ícono simple para el sidebar (emoji o texto).
type Item = { href: string; label: string; icon: string };

// Bottom nav mobile: 5 accesos core
const MOBILE_ITEMS: Item[] = [
  { href: '/complejo/dashboard', label: 'Hoy', icon: '🏠' },
  { href: '/complejo/calendario', label: 'Calendario', icon: '📅' },
  { href: '/complejo/torneos', label: 'Torneos', icon: '🏆' },
  { href: '/complejo/jugadores', label: 'Jugadores', icon: '👥' },
  { href: '/complejo/mas', label: 'Más', icon: '⋯' }
];

// Sidebar desktop: agrupado por secciones
type Section = { label: string; items: Item[] };
const DESKTOP_SECTIONS: Section[] = [
  {
    label: 'Operación',
    items: [
      { href: '/complejo/dashboard', label: 'Dashboard hoy', icon: '🏠' },
      { href: '/complejo/calendario', label: 'Calendario', icon: '📅' },
      { href: '/complejo/torneos', label: 'Torneos', icon: '🏆' },
      { href: '/complejo/socios', label: 'Socios · Membresías', icon: '💳' }
    ]
  },
  {
    label: 'Gestión',
    items: [
      { href: '/complejo/canchas', label: 'Canchas', icon: '🎾' },
      { href: '/complejo/empleados', label: 'Empleados', icon: '👥' },
      { href: '/complejo/jugadores', label: 'Jugadores del club', icon: '⭐' },
      { href: '/complejo/clientes', label: 'Base de clientes', icon: '👤' },
      { href: '/complejo/entrenamientos', label: 'Entrenamientos', icon: '🏋️' }
    ]
  },
  {
    label: 'Reportes',
    items: [
      { href: '/complejo/estadisticas', label: 'Estadísticas Premium', icon: '📊' },
      { href: '/complejo/rentabilidad', label: 'Rentabilidad', icon: '💰' }
    ]
  },
  {
    label: 'Comunidad',
    items: [
      { href: '/smash', label: 'Smashe@', icon: '💬' },
      { href: '/complejo/amigos', label: 'Comunidad', icon: '🌐' },
      { href: '/marketplace', label: 'Marketplace', icon: '🛒' }
    ]
  },
  {
    label: 'Configuración',
    items: [
      { href: '/complejo/perfil', label: 'Perfil del complejo', icon: '⚙️' },
      { href: '/complejo/mas', label: 'Ver todo', icon: '⋯' }
    ]
  }
];

export default function ComplejoLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const isAuth = path === '/complejo/login' || path === '/complejo/registro';
  const [cx, setCx] = useState<any>(null);

  useEffect(() => {
    if (isAuth) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('complexes')
        .select('id, name, logo_url, is_premium, status, rejection_reason')
        .eq('owner_id', user.id).maybeSingle();
      setCx(data);
    })();
  }, [isAuth, path]);

  if (isAuth) return <div className="min-h-dvh bg-black text-white"><div className="max-w-lg mx-auto">{children}</div></div>;

  const isSubpage = !MOBILE_ITEMS.some(i => i.href === path);

  function back() {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/complejo/dashboard');
  }

  async function signOut() {
    if (!confirm('¿Cerrar sesión?')) return;
    await supabase.auth.signOut();
    router.push('/');
  }

  // Banner de estado del complejo: pending_review, suspended o rejected.
  // Solo se muestra al dueño (aparece en TODAS sus páginas).
  const statusBanner = cx && cx.status !== 'active' ? (
    <div className={`w-full px-5 py-3 text-sm font-bold text-center
      ${cx.status === 'pending_review' ? 'bg-yellow-500/20 border-b-2 border-yellow-500/50 text-yellow-100'
        : cx.status === 'suspended' ? 'bg-orange-500/20 border-b-2 border-orange-500/50 text-orange-100'
        : 'bg-red-500/20 border-b-2 border-red-500/50 text-red-100'}`}>
      {cx.status === 'pending_review' && (
        <>⏳ <b>Tu complejo está en revisión</b>. Podés completar tu perfil y canchas, pero todavía no aparece a los jugadores.</>
      )}
      {cx.status === 'suspended' && (
        <>⚠️ <b>Tu complejo está suspendido</b>. Escribinos para reactivarlo.</>
      )}
      {cx.status === 'rejected' && (
        <>❌ <b>Tu complejo fue rechazado</b>. {cx.rejection_reason ? `Motivo: ${cx.rejection_reason}` : 'Contactá al soporte para más info.'}</>
      )}
    </div>
  ) : null;

  return (
    <div className="min-h-dvh bg-black text-white pb-32 lg:pb-0 lg:pl-72">
      <Banner />
      {statusBanner}

      {/* ==================== SIDEBAR DESKTOP ==================== */}
      <nav className="hidden lg:flex fixed left-0 top-0 bottom-0 w-72 bg-black border-r border-white/10 flex-col z-40 overflow-y-auto">
        {/* Header sidebar: logo NarvoQ */}
        <div className="px-5 pt-6 pb-4 border-b border-white/10">
          <Link href="/complejo/dashboard" className="block">
            <img src="/brand/logo.png?v=5" alt="NarvoQ"
              style={{ height: 56, width: 'auto', objectFit: 'contain', mixBlendMode: 'screen' }} />
            <p className="text-white/40 text-[10px] font-bold tracking-widest mt-1">PORTAL COMPLEJOS</p>
          </Link>
        </div>

        {/* Info del complejo */}
        {cx && (
          <div className="px-5 py-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              {cx.logo_url ? (
                <img src={cx.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-grafito text-ball font-black flex items-center justify-center text-lg">
                  {cx.name?.[0]?.toUpperCase() ?? '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-display font-black text-sm truncate flex items-center gap-1">
                  {cx.name}
                  <VerifiedBadge show={cx.is_premium} size="sm" />
                </p>
                <p className="text-white/40 text-[10px] font-bold uppercase">
                  {cx.is_premium ? 'Premium' : 'Free'}
                </p>
              </div>
            </div>
            {!cx.is_premium && (
              <Link href="/planes"
                className="mt-3 block text-center bg-ball text-courtdark font-black text-xs py-2 rounded-lg">
                Upgrade a Premium
              </Link>
            )}
          </div>
        )}

        {/* Navegación agrupada */}
        <div className="flex-1 py-3 space-y-4 overflow-y-auto">
          {DESKTOP_SECTIONS.map(section => (
            <div key={section.label}>
              <p className="text-white/40 text-[10px] font-black uppercase tracking-widest px-5 mb-1">
                {section.label}
              </p>
              <ul className="space-y-0.5 px-2">
                {section.items.map(i => {
                  const active = path === i.href || (i.href !== '/complejo/mas' && path.startsWith(i.href + '/'));
                  return (
                    <li key={i.href}>
                      <Link href={i.href}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold transition
                          ${active ? 'bg-ball/15 text-ball' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}>
                        <span className="w-6 text-center">{i.icon}</span>
                        <span className="flex-1 truncate">{i.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer sidebar: cerrar sesión */}
        <div className="p-3 border-t border-white/10 flex items-center gap-2">
          <InstallButton variant="ghost" />
          <Bell />
          <button onClick={signOut}
            className="flex-1 text-left text-white/60 text-xs font-bold hover:text-red-300 py-2 px-2 hover:bg-white/5 rounded">
            🚪 Salir
          </button>
        </div>
      </nav>

      {/* ==================== CONTENT AREA ==================== */}
      <div className="max-w-3xl xl:max-w-7xl mx-auto lg:mx-0 lg:max-w-none">
        {/* Header mobile */}
        <header className="px-5 py-3 border-b border-white/10 flex items-center justify-between lg:hidden">
          <div className="flex items-center gap-3">
            {isSubpage && (
              <button onClick={back} aria-label="Volver"
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center active:scale-90 transition">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            )}
            <Link href="/complejo/dashboard" className="shrink-0 active:scale-95 transition">
              <img src="/brand/logo.png?v=5" alt="NarvoQ" style={{ height: 60, width: 'auto', objectFit: 'contain', mixBlendMode: 'screen' }} />
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <InstallButton variant="ghost" />
            <Bell />
          </div>
        </header>

        {/* Header desktop */}
        <header className="hidden lg:flex px-8 pt-6 pb-4 items-center justify-between gap-3 border-b border-white/5">
          <div className="flex items-center gap-4">
            {isSubpage && (
              <button onClick={back}
                className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 rounded-xl px-4 py-2 font-black text-sm">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                Volver
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {cx && (
              <span className="font-bold text-white/50 text-xs">
                {cx.name} · {cx.is_premium ? '⭐ Premium' : 'Free'}
              </span>
            )}
            <Bell />
          </div>
        </header>

        {/* Contenido */}
        <div className="lg:px-8 lg:py-6">
          {children}
        </div>
      </div>

      {/* ==================== BOTTOM NAV MOBILE ==================== */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-black border-t border-white/10 pb-[env(safe-area-inset-bottom)] z-40">
        <div className="max-w-3xl mx-auto grid grid-cols-5 h-[80px]">
          {MOBILE_ITEMS.map(i => {
            const active = path.startsWith(i.href);
            return (
              <Link key={i.href} href={i.href}
                className={`flex flex-col items-center justify-center gap-1 text-[12px] font-black ${active ? 'text-ball' : 'text-white/60'}`}>
                <span className="text-2xl">{i.icon}</span>
                <span className="leading-none">{i.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
