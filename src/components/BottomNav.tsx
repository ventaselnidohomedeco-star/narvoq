'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Bottom nav accesible: íconos de 28px, texto legible, altura mínima 66px
// pensada para 14-70 años.
const I = {
  home: (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2z" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  ),
  trophy: (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
      <path d="M4 5h4v3a2 2 0 0 1-4 0V5zM20 5h-4v3a2 2 0 0 0 4 0V5z" />
      <path d="M10 14h4v3l2 3H8l2-3z" />
    </svg>
  ),
  dumbbell: (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 10v4M6 6v12M10 10h4M14 10h4M18 6v12M22 10v4" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
    </svg>
  ),
  feed: (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
    <nav className="fixed bottom-0 inset-x-0 bg-[#0D1320] border-t border-white/10 pb-[env(safe-area-inset-bottom)] z-40">
      <div className="max-w-md mx-auto grid grid-cols-6 h-[72px]">
        {items.map(i => {
          const active = path.startsWith(i.href);
          return (
            <Link key={i.href} href={i.href}
              className={`flex flex-col items-center justify-center gap-1 text-[11px] font-black transition
                ${active ? 'text-ball' : 'text-white/60 hover:text-white/80'}`}>
              <span className="w-7 h-7 flex items-center justify-center">{i.icon}</span>
              <span className="leading-none">{i.label}</span>
              {active && <span className="absolute bottom-[env(safe-area-inset-bottom)] h-[3px] w-8 rounded-full bg-ball mb-1" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
