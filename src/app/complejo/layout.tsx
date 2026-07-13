'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Banner from '@/components/Banner';
import Brand from '@/components/Brand';
import Bell from '@/components/Bell';
import InstallButton from '@/components/InstallButton';

const CxIcon = {
  home: (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2z" />
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
  users: (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="4" />
      <path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" />
      <path d="M17 6a4 4 0 1 1 0 6M22 21v-2a4 4 0 0 0-3-3.8" />
    </svg>
  ),
  more: (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
  const isAuth = path === '/complejo/login' || path === '/complejo/registro';
  if (isAuth) return <div className="min-h-dvh bg-[#0B0F16] text-white"><div className="max-w-lg mx-auto">{children}</div></div>;

  return (
    <div className="min-h-dvh bg-[#0B0F16] text-white pb-24">
      <Banner />
      <header className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <Link href="/complejo/dashboard" className="flex items-center gap-2">
          <Brand variant="inline" size={28} />
          <span className="text-white/40 font-bold text-sm">· Complejos</span>
        </Link>
        <div className="flex items-center gap-2">
          <InstallButton variant="ghost" />
          <Bell />
        </div>
      </header>
      <div className="max-w-lg mx-auto">{children}</div>
      <nav className="fixed bottom-0 inset-x-0 bg-[#0D1320] border-t border-white/10 pb-[env(safe-area-inset-bottom)] z-40">
        <div className="max-w-lg mx-auto grid grid-cols-5 h-[72px]">
          {items.map(i => {
            const active = path.startsWith(i.href);
            return (
              <Link key={i.href} href={i.href}
                className={`flex flex-col items-center justify-center gap-1 text-[11px] font-black ${active ? 'text-ball' : 'text-white/60'}`}>
                <span className="w-7 h-7 flex items-center justify-center">{i.icon}</span>
                <span className="leading-none">{i.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
