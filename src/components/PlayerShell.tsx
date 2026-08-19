'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import BottomNav from '@/components/BottomNav';

// PlayerShell — Renderiza la BottomNav (mobile) + Sidebar (desktop) de forma
// GLOBAL para todos los jugadores logueados, en cualquier pantalla del ecosistema.
// Así el usuario siempre tiene la barra para volver a Perfil, Feed, Reservas, etc.
//
// Se OCULTA en:
//   - Landing (/)
//   - Auth: /login, /registro, /forgot, /reset
//   - Rutas de complejo (/complejo/*) — tienen su propio sidebar
//   - Rutas de entrenador (/training/*) — tienen su propio layout
//   - Rutas de admin (/admin/*)
//   - Rutas de jugador (/jugador/*) — ya renderizan BottomNav vía su layout
//
// Aplica un padding-bottom / padding-left al body wrapper para que el contenido
// no quede tapado por la barra.

const EXCLUDED_PREFIXES = [
  '/login', '/registro', '/forgot', '/reset', '/auth',
  '/complejo', '/training', '/admin', '/jugador'
];

export default function PlayerShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [isPlayer, setIsPlayer] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (mounted) { setIsPlayer(false); setChecked(true); } return; }
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (mounted) {
        // 'player' o cualquiera que no sea complex_admin / coach / super_admin usa esta barra
        const role = data?.role;
        setIsPlayer(role === 'player' || !role);
        setChecked(true);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, session) => {
      if (!session?.user) { setIsPlayer(false); return; }
      const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
      setIsPlayer(data?.role === 'player' || !data?.role);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  const isLanding = path === '/';
  const isExcluded = isLanding || EXCLUDED_PREFIXES.some(p => path === p || path.startsWith(p + '/'));

  // Mostrar solo si es jugador logueado y NO está en una ruta con su propia nav.
  const showNav = checked && isPlayer && !isExcluded;

  if (!showNav) return <>{children}</>;

  return (
    <div className="min-h-dvh bg-black pb-32 lg:pb-0 lg:pl-60">
      {children}
      <BottomNav />
    </div>
  );
}
