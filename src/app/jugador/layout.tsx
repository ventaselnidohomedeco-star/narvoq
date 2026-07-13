import Link from 'next/link';
import BottomNav from '@/components/BottomNav';
import ProfileGuard from '@/components/ProfileGuard';
import Banner from '@/components/Banner';
import Brand from '@/components/Brand';
import Bell from '@/components/Bell';
import InstallButton from '@/components/InstallButton';

export default function JugadorLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProfileGuard>
      <Banner />
      <div className="min-h-dvh pb-28 lg:pb-8 lg:pl-56">
        <div className="max-w-3xl xl:max-w-5xl mx-auto">
          <header className="px-5 pt-4 pb-2 flex items-center justify-between gap-2 lg:hidden">
            <Link href="/jugador/dashboard"><Brand variant="inline" size={26} /></Link>
            <div className="flex items-center gap-2">
              <InstallButton variant="ghost" />
              <Bell />
            </div>
          </header>
          <header className="hidden lg:flex px-8 pt-6 pb-4 items-center justify-end gap-3">
            <InstallButton variant="ghost" />
            <Bell />
          </header>
          {children}
        </div>
        <BottomNav />
      </div>
    </ProfileGuard>
  );
}
