'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Banner from '@/components/Banner';
import Brand from '@/components/Brand';
import Bell from '@/components/Bell';

const items = [
  { href: '/training/dashboard', label: 'Grupo', icon: 'GR' },
  { href: '/training/alumnos', label: 'Alumnos', icon: 'AL' },
  { href: '/training/amigos', label: 'Red', icon: 'RD' },
  { href: '/training/perfil', label: 'Perfil', icon: 'PF' }
];

export default function TrainingLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const isAuth = path === '/training/login' || path === '/training/registro';
  if (isAuth) return <div className="min-h-dvh text-white"><div className="max-w-md mx-auto">{children}</div></div>;

  return (
    <div className="min-h-dvh text-white pb-24">
      <Banner />
      <header className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <Link href="/training/dashboard" className="flex items-center gap-2">
          <Brand variant="inline" size={28} />
          <span className="text-white/40 font-bold text-sm">· Training</span>
        </Link>
        <Bell />
      </header>
      <div className="max-w-md mx-auto">{children}</div>
      <nav className="fixed bottom-0 inset-x-0 bg-[#0D1320]/95 backdrop-blur border-t border-white/10 pb-[env(safe-area-inset-bottom)] z-40">
        <div className="max-w-md mx-auto grid grid-cols-4">
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
    </div>
  );
}
