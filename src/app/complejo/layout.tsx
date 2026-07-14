'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Banner from '@/components/Banner';
import Bell from '@/components/Bell';
import InstallButton from '@/components/InstallButton';

const CxIcon = {
  home: (
    <svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2z" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  ),
  trophy: (
    <svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
      <path d="M4 5h4v3a2 2 0 0 1-4 0V5zM20 5h-4v3a2 2 0 0 0 4 0V5z" />
      <path d="M10 14h4v3l2 3H8l2-3z" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="4" />
      <path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" />
      <path d="M17 6a4 4 0 1 1 0 6M22 21v-2a4 4 0 0 0-3-3.8" />
    </svg>
  ),
  more: (
    <svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
};

const items = [
  { href: '/complejo/dashboard', label: 'Hoy', icon: CxIcon.home },
  { href: '/complejo/calendario', label: 'Calendario', icon: CxIcon.calendar },
  { href: '/complejo/torneos', label: 'Torneos', icon: CxIcon.trophy },
  { href: '/complejo/jugadores', label: 'Jugadores', icon: CxIcon.users },
  { href: '/complejo/mas', label: 'Más', icon: CxIcon.more }
];

export default function ComplejoLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const isAuth = path === '/complejo/login' || path === '/complejo/registro';
  if (isAuth) return <div className="min-h-dvh bg-black text-white"><div className="max-w-lg mx-auto">{children}</div></div>;

  // ¿Estamos en una subpágina donde debería aparecer el botón "volver"?
  const isSubpage = !items.some(i => i.href === path);

  function back() {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/complejo/dashboard');
  }

  return (
    <div className="min-h-dvh bg-black text-white pb-32 lg:pb-8 lg:pl-60">
      <Banner />

      {/* Sidebar desktop */}
      <nav className="hidden lg:flex fixed left-0 top-0 bottom-0 w-60 bg-[#0D1320] border-r border-white/10 flex-col py-6 z-40">
        <div className="px-5 mb-6">
          <Link href="/complejo/dashboard" className="block">
            <img src="/brand/logo.png?v=5" alt="NarvoQ" style={{ height: 64, width: 'auto', objectFit: 'contain', mixBlendMode: 'screen' }} />
            <p className="text-white/40 text-[10px] font-bold tracking-widest mt-1">PORTAL COMPLEJOS</p>
          </Link>
        </div>
        <ul className="flex-1 space-y-1 px-3">
          {items.map(i => {
            const active = path.startsWith(i.href);
            return (
              <li key={i.href}>
                <Link href={i.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3.5 font-black text-[15px] transition
                    ${active ? 'bg-ball/10 text-ball' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}>
                  <span className="w-7 h-7 flex items-center justify-center">{i.icon}</span>
                  {i.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="max-w-3xl xl:max-w-5xl mx-auto">
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
              <img src="/brand/logo.png?v=5" alt="NarvoQ" style={{ height: 70, width: 'auto', objectFit: 'contain', mixBlendMode: 'screen' }} />
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <InstallButton variant="ghost" />
            <Bell />
          </div>
        </header>
        <header className="hidden lg:flex px-8 pt-6 pb-4 items-center justify-between gap-3">
          <div>
            {isSubpage && (
              <button onClick={back}
                className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 rounded-xl px-4 py-2.5 font-black text-sm">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                Volver
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <InstallButton variant="ghost" />
            <Bell />
          </div>
        </header>
        {children}
      </div>

      {/* Bottom nav cel/tablet */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-[#0D1320] border-t border-white/10 pb-[env(safe-area-inset-bottom)] z-40">
        <div className="max-w-3xl mx-auto grid grid-cols-5 h-[92px]">
          {items.map(i => {
            const active = path.startsWith(i.href);
            return (
              <Link key={i.href} href={i.href}
                className={`flex flex-col items-center justify-center gap-1.5 text-[13px] font-black ${active ? 'text-ball' : 'text-white/60'}`}>
                <span className="w-11 h-11 flex items-center justify-center">{i.icon}</span>
                <span className="leading-none">{i.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
