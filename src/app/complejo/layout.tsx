'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Banner from '@/components/Banner';
import Brand from '@/components/Brand';
import Bell from '@/components/Bell';
import InstallButton from '@/components/InstallButton';

const items = [
  { href: '/complejo/dashboard', label: 'Hoy', icon: '📊' },
  { href: '/complejo/calendario', label: 'Calendario', icon: '📅' },
  { href: '/complejo/torneos', label: 'Torneos', icon: '🏆' },
  { href: '/complejo/jugadores', label: 'Jugadores', icon: '📈' },
  { href: '/complejo/mas', label: 'Más', icon: '☰' }
];

export default function ComplejoLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const isAuth = path === '/complejo/login' || path === '/complejo/registro';
  if (isAuth) return <div className="min-h-dvh bg-courtdark text-white"><div className="max-w-lg mx-auto">{children}</div></div>;

  return (
    <div className="min-h-dvh bg-courtdark text-white pb-24">
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
      <nav className="fixed bottom-0 inset-x-0 bg-[#060D1F] border-t border-white/10 pb-[env(safe-area-inset-bottom)] z-40">
        <div className="max-w-lg mx-auto grid grid-cols-5">
          {items.map(i => {
            const active = path.startsWith(i.href);
            return (
              <Link key={i.href} href={i.href}
                className={`flex flex-col items-center py-2 text-[11px] font-semibold ${active ? 'text-ball' : 'text-white/50'}`}>
                <span className="text-xl">{i.icon}</span>{i.label}
                {active && <span className="mt-1 h-1 w-6 rounded-full bg-ball" />}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
