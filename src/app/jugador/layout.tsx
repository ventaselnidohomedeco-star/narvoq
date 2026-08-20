'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import BottomNav from '@/components/BottomNav';
import ProfileGuard from '@/components/ProfileGuard';
import Banner from '@/components/Banner';
import Bell from '@/components/Bell';
import InstallButton from '@/components/InstallButton';
import UserMenu from '@/components/UserMenu';
import { supabase } from '@/lib/supabase/client';

export default function JugadorLayout({ children }: { children: React.ReactNode }) {
  // Si el usuario es complex_admin o coach visitando /jugador/feed (por ej.
  // desde el sidebar del complejo), no le pintamos la nav de jugador — que
  // ya tienen su propia chrome vía ComplexShell / training layout.
  const [showChrome, setShowChrome] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setReady(true); return; }
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      setShowChrome(data?.role === 'player' || !data?.role);
      setReady(true);
    })();
  }, []);

  return (
    <ProfileGuard>
      <Banner />
      {ready && !showChrome ? (
        // Otros roles: dejar que su propio shell (ComplexShell/training) maneje la nav
        <>{children}</>
      ) : (
        <div className="min-h-dvh bg-black pb-32 lg:pb-8 lg:pl-60">
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
      )}
    </ProfileGuard>
  );
}
