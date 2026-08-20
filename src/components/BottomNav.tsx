'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Bottom nav grande y legible.
// Nuevo orden: Perfil · Feed · Reservas · Smashe@ (❤️) · Torneos · Ranking
// Foco en comunidad: Feed y Smashe@ (chat con corazón) protagonistas.

const I = {
  home: (
    <svg viewBox="0 0 24 24" width="58" height="58" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V11z" />
    </svg>
  ),
  feed: (
    <svg viewBox="0 0 24 24" width="58" height="58" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="5" r="2" fill="currentColor" />
      <path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" width="58" height="58" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  ),
  // Corazón para Smashe@ — la app quiere ser "el tinder del padel"
  heart: (
    <svg viewBox="0 0 24 24" width="58" height="58" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M12 21s-7-4.5-7-11a4.5 4.5 0 0 1 8-3 4.5 4.5 0 0 1 8 3c0 6.5-7 11-7 11z" />
    </svg>
  ),
  trophy: (
    <svg viewBox="0 0 24 24" width="58" height="58" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
      <path d="M4 5h4v3a2 2 0 0 1-4 0V5zM20 5h-4v3a2 2 0 0 0 4 0V5z" />
      <path d="M10 14h4v3l2 3H8l2-3z" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" width="58" height="58" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
    </svg>
  )
};

const items = [
  { href: '/jugador/dashboard', label: 'Inicio', icon: I.home },
  { href: '/jugador/feed', label: 'Feed', icon: I.feed },
  { href: '/jugador/reservas', label: 'Reservas', icon: I.calendar },
  { href: '/smash', label: 'Smashe@', icon: I.heart, accent: true },
  { href: '/jugador/torneos', label: 'Torneos', icon: I.trophy },
  { href: '/jugador/ranking', label: 'Ranking', icon: I.chart }
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <>
      {/* Bottom nav (cel + tablet) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-black border-t border-white/10 pb-[env(safe-area-inset-bottom)] z-40">
        <div className="max-w-3xl mx-auto grid grid-cols-6 h-[100px]">
          {items.map(i => {
            const active = path.startsWith(i.href);
            const heartActive = i.accent && active;
            return (
              <Link key={i.href} href={i.href}
                className={`flex flex-col items-center justify-center gap-1.5 text-[14px] font-black transition-transform active:scale-90
                  ${active ? (i.accent ? 'text-red-400' : 'text-ball') : 'text-white/60'}`}>
                <span className={`w-14 h-14 flex items-center justify-center ${heartActive ? 'animate-pulse' : ''}`}>
                  {i.icon}
                </span>
                <span className="leading-none">{i.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Sidebar (desktop) */}
      <nav className="hidden lg:flex fixed left-0 top-0 bottom-0 w-60 bg-black border-r border-white/10 flex-col py-6 z-40">
        <div className="px-5 mb-6 bg-black">
          <Link href="/jugador/dashboard" className="block">
            <img src="/brand/logo.png?v=9" alt="NarvoQ"
              style={{ height: 64, width: 'auto', objectFit: 'contain', mixBlendMode: 'screen' }} />
          </Link>
        </div>
        <ul className="flex-1 space-y-1 px-3">
          {items.map(i => {
            const active = path.startsWith(i.href);
            return (
              <li key={i.href}>
                <Link href={i.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3.5 font-black text-[16px] transition
                    ${active
                      ? (i.accent ? 'bg-red-500/10 text-red-400' : 'bg-ball/10 text-ball')
                      : 'text-white/70 hover:bg-white/5 hover:text-white'}`}>
                  <span className="w-7 h-7 flex items-center justify-center">{i.icon}</span>
                  {i.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
