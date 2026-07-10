import Link from 'next/link';
import BottomNav from '@/components/BottomNav';
import ProfileGuard from '@/components/ProfileGuard';
import Banner from '@/components/Banner';
import Brand from '@/components/Brand';
import Bell from '@/components/Bell';

export default function JugadorLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProfileGuard>
      <Banner />
      <div className="min-h-dvh pb-24 max-w-md mx-auto">
        <header className="px-5 pt-4 pb-2 flex items-center justify-between">
          <Link href="/jugador/dashboard"><Brand variant="inline" size={24} /></Link>
          <Bell />
        </header>
        {children}
        <BottomNav />
      </div>
    </ProfileGuard>
  );
}
