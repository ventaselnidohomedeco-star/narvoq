'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

// Menú hamburguesa (☰) para jugador/profe/complejo.
// Muestra: Editar perfil, Notificaciones, Mi suscripción, Cerrar sesión.
export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      setRole(data?.role ?? null);
    })();
  }, []);

  useEffect(() => {
    function handler(e: Event) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    // Uso 'click' + un pequeño delay para no interceptar el mismo tap que abrió el menú
    if (open) {
      const t = setTimeout(() => document.addEventListener('click', handler), 50);
      return () => { clearTimeout(t); document.removeEventListener('click', handler); };
    }
  }, [open]);

  async function logout() {
    if (!confirm('¿Cerrar sesión?')) return;
    await supabase.auth.signOut();
    router.push('/');
  }

  // Ruta de "Editar perfil" según el rol.
  const perfilHref =
    role === 'coach' ? '/training/perfil' :
    role === 'complex_admin' ? '/complejo/perfil' :
    '/jugador/perfil';

  const item = 'flex items-center gap-3 px-4 py-3 text-sm font-bold hover:bg-white/10 w-full text-left';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Menú"
        title="Menú"
        className="w-12 h-12 rounded-full bg-white/5 border border-white/15 hover:bg-white/10 hover:border-ball/50 transition flex items-center justify-center">
        {/* Ícono hamburguesa */}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.6" strokeLinecap="round" className="text-white">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-14 w-64 bg-[#12161C] border border-white/15 rounded-xl shadow-2xl overflow-hidden z-50">
          <Link href={perfilHref} onClick={() => setOpen(false)} className={item}>
            <span className="text-lg">👤</span>
            <span>Editar perfil</span>
          </Link>
          <Link href="/notificaciones" onClick={() => setOpen(false)} className={item}>
            <span className="text-lg">🔔</span>
            <span>Notificaciones</span>
          </Link>
          <Link href="/mi-suscripcion" onClick={() => setOpen(false)} className={item}>
            <span className="text-lg">💎</span>
            <span>Mi suscripción</span>
          </Link>
          <Link href="/planes" onClick={() => setOpen(false)}
            className={`${item} bg-ball/10 text-ball border-t border-white/10`}>
            <span className="text-lg">⭐</span>
            <span>Ver planes y suscribirme</span>
          </Link>
          <button onClick={() => { setOpen(false); logout(); }}
            className={`${item} text-red-300 border-t border-white/10`}>
            <span className="text-lg">🚪</span>
            <span>Cerrar sesión</span>
          </button>
        </div>
      )}
    </div>
  );
}
