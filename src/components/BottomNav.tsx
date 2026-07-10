'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/jugador/dashboard', label: 'Inicio', icon: 'IN' },
  { href: '/jugador/reservas', label: 'Reservas', icon: 'RS' },
  { href: '/jugador/torneos', label: 'Torneos', icon: 'TRN' },
  { href: '/jugador/entrenamientos', label: 'Training', icon: 'TR' },
  { href: '/jugador/ranking', label: 'Ranking', icon: 'RK' },
  { href: '/jugador/feed', label: 'Feed', icon: 'FD' }
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-[#0D1320]/95 backdrop-blur border-t border-white/10 pb-[env(safe-area-inset-bottom)] z-40">
      <div className="max-w-md mx-auto grid grid-cols-6">
        {items.map(i => {
          const active = path.startsWith(i.href);
          return (
            <Link key={i.href} href={i.href}
              className={`flex flex-col items-center py-2 text-[10px] font-semibold ${active ? 'text-ball' : 'text-white/40'}`}>
              <span className="text-[11px] font-display font-black">{i.icon}</span>{i.label}
              {active && <span className="mt-1 h-1 w-5 rounded-full bg-ball" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
