'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Bottom nav responsive:
// - Cel/Tablet: barra inferior fija con íconos grandes (accesibilidad 14-70 años)
// - PC/Desktop (>= lg): sidebar vertical izquierda con íconos + labels
const I = {
  home: (
    <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2z" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  ),
  trophy: (
    <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
      <path d="M4 5h4v3a2 2 0 0 1-4 0V5zM20 5h-4v3a2 2 0 0 0 4 0V5z" />
      <path d="M10 14h4v3l2 3H8l2-3z" />
    </svg>
  ),
  dumbbell: (
    <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 10v4M6 6v12M10 10h4M14 10h4M18 6v12M22 10v4" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
    </svg>
  ),
  feed: (
    <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="5" r="2" fill="currentColor" />
      <path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" />
    </svg>
  )
};

const items = [
  { href: '/jugador/dashboard', label: 'Inicio', icon: I.home },
  { href: '/jugador/reservas', label: 'Reservas', icon: I.calendar },
  { href: '/jugador/torneos', label: 'Torneos', icon: I.trophy },
  { href: '/jugador/entrenamientos', label: 'Training', icon: I.dumbbell },
  { href: '/jugador/ranking', label: 'Ranking', icon: I.chart },
  { href: '/jugador/feed', label: 'Feed', icon: I.feed }
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <>
      {/* Bottom nav (mobile + tablet) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-[#0D1320] border-t border-white/10 pb-[env(safe-area-inset-bottom)] z-40">
        <div className="max-w-3xl mx-auto grid grid-cols-6 h-[80px]">
          {items.map(i => {
            const active = path.startsWith(i.href);
            return (
              <Link key={i.href} href={i.href}
                className={`flex flex-col items-center justify-center gap-1.5 text-[12px] font-black
                  ${active ? 'text-ball' : 'text-white/60'}`}>
                <span className="w-9 h-9 flex items-center justify-center">{i.icon}</span>
                <span className="leading-none">{i.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Sidebar (desktop) */}
      <nav className="hidden lg:flex fixed left-0 top-0 bottom-0 w-56 bg-[#0D1320] border-r border-white/10 flex-col py-6 z-40">
        <div className="px-5 mb-6">
          <p className="font-display font-black text-xl">Narvo<span className="text-ball">Q</span></p>
          <p className="text-white/40 text-[10px] font-bold tracking-widest">ELEVÁ TU JUEGO</p>
        </div>
        <ul className="flex-1 space-y-1 px-3">
          {items.map(i => {
            const active = path.startsWith(i.href);
            return (
              <li key={i.href}>
                <Link href={i.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 font-black text-sm transition
                    ${active ? 'bg-ball/10 text-ball' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
                  <span className="w-6 h-6 flex items-center justify-center">{i.icon}</span>
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
