'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

// ComplexShell — Renderiza el sidebar (desktop) + bottom nav (mobile) del complejo
// en TODAS las páginas fuera de /complejo/*, si el usuario es complex_admin.
// Así el menú siempre está visible aunque el complejo esté en /notificaciones,
// /planes, /mi-suscripcion, /u/[username], etc.
//
// Se OCULTA en: landing, auth, /complejo/*, /training/*, /admin/*, /jugador/*.
// Reproduce visualmente el chrome de complejo/layout.tsx para consistencia.

const MOBILE_ITEMS = [
  { href: '/complejo/dashboard', label: 'Hoy', icon: '🏠' },
  { href: '/complejo/calendario', label: 'Calendario', icon: '📅' },
  { href: '/complejo/torneos', label: 'Torneos', icon: '🏆' },
  { href: '/complejo/jugadores', label: 'Jugadores', icon: '👥' },
  { href: '/complejo/mas', label: 'Más', icon: '⋯' }
];

const DESKTOP_SECTIONS = [
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
      { href: '/complejo/clientes', label: 'Base de clientes', icon: '👤' }
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

const EXCLUDED_PREFIXES = [
  '/login', '/registro', '/forgot', '/reset', '/auth',
  '/complejo', '/training', '/admin', '/jugador'
];

export default function ComplexShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [role, setRole] = useState<string | null>(null);
  const [cx, setCx] = useState<any>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (mounted) { setRole(null); setChecked(true); } return; }
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (!mounted) return;
      setRole(prof?.role ?? null);
      if (prof?.role === 'complex_admin') {
        const { data } = await supabase.from('complexes')
          .select('id, name, logo_url, is_premium')
          .eq('owner_id', user.id).maybeSingle();
        if (mounted) setCx(data);
      }
      setChecked(true);
    }
    loadUser();
    const { data: sub } = supabase.auth.onAuthStateChange(() => loadUser());
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  const isLanding = path === '/';
  const isExcluded = isLanding || EXCLUDED_PREFIXES.some(p => path === p || path.startsWith(p + '/'));
  const show = checked && role === 'complex_admin' && !isExcluded;

  if (!show) return <>{children}</>;

  return (
    <div className="min-h-dvh bg-black text-white pb-32 lg:pb-0 lg:pl-72">
      {/* Sidebar desktop */}
      <nav className="hidden lg:flex fixed left-0 top-0 bottom-0 w-72 bg-black border-r border-white/10 flex-col z-40 overflow-y-auto">
        <div className="px-5 pt-6 pb-4 border-b border-white/10">
          <Link href="/complejo/dashboard" className="block">
            <img src="/brand/logo.png?v=5" alt="NarvoQ"
              style={{ height: 56, width: 'auto', objectFit: 'contain', mixBlendMode: 'screen' }} />
            <p className="text-white/40 text-[10px] font-bold tracking-widest mt-1">PORTAL COMPLEJOS</p>
          </Link>
        </div>
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
                <p className="font-display font-black text-sm truncate">{cx.name}</p>
                <p className="text-white/40 text-[10px] font-bold uppercase">
                  {cx.is_premium ? 'Premium' : 'Free'}
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="flex-1 py-3 space-y-4 overflow-y-auto">
          {DESKTOP_SECTIONS.map(section => (
            <div key={section.label}>
              <p className="text-white/40 text-[10px] font-black uppercase tracking-widest px-5 mb-1">
                {section.label}
              </p>
              <ul className="space-y-0.5 px-2">
                {section.items.map(i => (
                  <li key={i.href}>
                    <Link href={i.href}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold text-white/70 hover:bg-white/5 hover:text-white">
                      <span className="w-6 text-center">{i.icon}</span>
                      <span className="flex-1 truncate">{i.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      {/* Botón "Volver al complejo" al principio del contenido */}
      <div className="max-w-3xl xl:max-w-7xl mx-auto lg:mx-0 lg:max-w-none">
        <div className="lg:px-8 lg:py-4 px-5 py-3 border-b border-white/5">
          <Link href="/complejo/dashboard"
            className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 rounded-xl px-4 py-2 font-black text-sm text-white/80">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Volver al complejo
          </Link>
        </div>
        <div className="lg:px-8 lg:py-6">
          {children}
        </div>
      </div>

      {/* Bottom nav mobile */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-black border-t border-white/10 pb-[env(safe-area-inset-bottom)] z-40">
        <div className="max-w-3xl mx-auto grid grid-cols-5 h-[80px]">
          {MOBILE_ITEMS.map(i => (
            <Link key={i.href} href={i.href}
              className="flex flex-col items-center justify-center gap-1 text-[12px] font-black text-white/60">
              <span className="text-2xl">{i.icon}</span>
              <span className="leading-none">{i.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
