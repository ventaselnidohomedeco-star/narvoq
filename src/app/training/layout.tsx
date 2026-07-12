'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Banner from '@/components/Banner';
import Brand from '@/components/Brand';
import Bell from '@/components/Bell';
import InstallButton from '@/components/InstallButton';

const Icon = {
  group: (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="10" r="3.2" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M3 20v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1" />
      <path d="M15 15h2a4 4 0 0 1 4 4v1" />
    </svg>
  ),
  student: (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2" />
    </svg>
  ),
  network: (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  )
};

const chatSvg = (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const items = [
  { href: '/training/dashboard', label: 'Grupo', icon: Icon.group },
  { href: '/training/alumnos', label: 'Alumnos', icon: Icon.student },
  { href: '/smash', label: 'Smashe@', icon: chatSvg },
  { href: '/training/amigos', label: 'Red', icon: Icon.network },
  { href: '/training/perfil', label: 'Perfil', icon: Icon.profile }
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
        <div className="flex items-center gap-2">
          <InstallButton variant="ghost" />
          <Bell />
        </div>
      </header>
      <div className="max-w-md mx-auto">{children}</div>
      <nav className="fixed bottom-0 inset-x-0 bg-[#0D1320]/95 backdrop-blur border-t border-white/10 pb-[env(safe-area-inset-bottom)] z-40">
        <div className="max-w-md mx-auto grid grid-cols-5">
          {items.map(i => {
            const active = path.startsWith(i.href);
            return (
              <Link key={i.href} href={i.href}
                className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-bold ${active ? 'text-ball' : 'text-white/50'}`}>
                <span className="w-6 h-6 flex items-center justify-center">{i.icon}</span>
                <span className="leading-none">{i.label}</span>
                {active && <span className="mt-0.5 h-1 w-6 rounded-full bg-ball" />}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
