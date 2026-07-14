'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Banner from '@/components/Banner';
import Bell from '@/components/Bell';
import InstallButton from '@/components/InstallButton';

const Icon = {
  group: (
    <svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="10" r="3.2" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M3 20v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1" />
      <path d="M15 15h2a4 4 0 0 1 4 4v1" />
    </svg>
  ),
  student: (
    <svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2" />
    </svg>
  ),
  network: (
    <svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
};

const items = [
  { href: '/training/dashboard', label: 'Grupo', icon: Icon.group },
  { href: '/training/alumnos', label: 'Alumnos', icon: Icon.student },
  { href: '/smash', label: 'Smashe@', icon: Icon.chat },
  { href: '/training/amigos', label: 'Red', icon: Icon.network },
  { href: '/training/perfil', label: 'Perfil', icon: Icon.profile }
];

export default function TrainingLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const isAuth = path === '/training/login' || path === '/training/registro';
  if (isAuth) return <div className="min-h-dvh text-white"><div className="max-w-md mx-auto">{children}</div></div>;

  const isSubpage = !items.some(i => i.href === path);
  function back() {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/training/dashboard');
  }

  return (
    <div className="min-h-dvh text-white pb-32 lg:pb-8 lg:pl-60">
      <Banner />

      {/* Sidebar desktop */}
      <nav className="hidden lg:flex fixed left-0 top-0 bottom-0 w-60 bg-[#0D1320] border-r border-white/10 flex-col py-6 z-40">
        <div className="px-5 mb-6">
          <Link href="/training/dashboard" className="block">
            <img src="/brand/logo.png?v=4" alt="NarvoQ" style={{ height: 40, width: 'auto', objectFit: 'contain' }} />
            <p className="text-white/40 text-[10px] font-bold tracking-widest mt-1">PORTAL TRAINING</p>
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
            <Link href="/training/dashboard" className="shrink-0 active:scale-95 transition">
              <img src="/brand/logo.png?v=4" alt="NarvoQ" style={{ height: 44, width: 'auto', objectFit: 'contain' }} />
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
