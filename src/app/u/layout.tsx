'use client';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';
import Banner from '@/components/Banner';
import Bell from '@/components/Bell';
import InstallButton from '@/components/InstallButton';
import UserMenu from '@/components/UserMenu';

// Layout de perfiles públicos (/u/<username>). Cualquier tipo de usuario
// puede ver un perfil público — le renderizamos la chrome del jugador
// (Bell, UserMenu, BottomNav) para que no pierda la navegación.
export default function PublicProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Banner />
      <div className="min-h-dvh bg-black pb-32 lg:pb-8">
        <div className="max-w-3xl xl:max-w-5xl mx-auto">
          <header className="px-5 pt-4 pb-3 flex items-center justify-between gap-2 lg:hidden border-b border-white/5 bg-black">
            <Link href="/jugador/dashboard" className="shrink-0 active:scale-95 transition">
              <img src="/brand/logo.png?v=9" alt="NarvoQ"
                style={{ height: 70, width: 'auto', objectFit: 'contain', mixBlendMode: 'screen' }} />
            </Link>
            <div className="flex items-center gap-2">
              <InstallButton variant="ghost" />
              <Bell />
              <UserMenu />
            </div>
          </header>
          <header className="hidden lg:flex px-8 pt-6 pb-4 items-center justify-end gap-3">
            <InstallButton variant="ghost" />
            <Bell />
            <UserMenu />
          </header>
          {children}
        </div>
        <BottomNav />
      </div>
    </>
  );
}
