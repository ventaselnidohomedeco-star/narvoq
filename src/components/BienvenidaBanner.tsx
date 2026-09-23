'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Banner de bienvenida para el jugador recién registrado.
 * Se muestra solo si:
 * - Registrado en los últimos 3 días
 * - No lo cerró antes (localStorage)
 */
export default function BienvenidaBanner({ profile }: { profile: any }) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!profile?.created_at) return;
    const days = (Date.now() - new Date(profile.created_at).getTime()) / (24 * 3600 * 1000);
    if (days > 3) return;
    const key = `narvoq_welcome_dismissed_${profile.id}`;
    if (typeof window !== 'undefined' && localStorage.getItem(key)) return;
    setDismissed(false);
  }, [profile]);

  function cerrar() {
    setDismissed(true);
    try { localStorage.setItem(`narvoq_welcome_dismissed_${profile.id}`, '1'); } catch {}
  }

  if (dismissed) return null;

  const nombre = profile?.first_name ?? '';

  return (
    <div className="mt-5 relative rounded-2xl bg-gradient-to-br from-ball/25 via-ball/10 to-transparent border-2 border-ball/50 p-5 overflow-hidden">
      <button onClick={cerrar} aria-label="Cerrar"
        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 text-white/70 font-bold text-sm">✕</button>
      <div className="flex items-start gap-3">
        <span className="text-4xl">🎾</span>
        <div className="flex-1 min-w-0 pr-6">
          <p className="text-ball text-[11px] font-black tracking-widest">BIENVENIDO A LA COMUNIDAD</p>
          <p className="font-display font-black text-xl mt-1 leading-tight">
            ¡{nombre ? `Hola ${nombre}!` : 'Bienvenido!'} Ya sos parte de NarvoQ 🚀
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <Link href="/jugador/buscar" className="flex items-center justify-between bg-white/5 hover:bg-white/10 rounded-xl px-4 py-3 transition">
          <span className="flex items-center gap-3">
            <span className="text-xl">👥</span>
            <span className="font-black text-sm">Buscá jugadores de tu zona</span>
          </span>
          <span className="text-ball font-black">→</span>
        </Link>
        <Link href="/jugador/reservar" className="flex items-center justify-between bg-white/5 hover:bg-white/10 rounded-xl px-4 py-3 transition">
          <span className="flex items-center gap-3">
            <span className="text-xl">📅</span>
            <span className="font-black text-sm">Reservá tu primer turno</span>
          </span>
          <span className="text-ball font-black">→</span>
        </Link>
        <Link href="/jugador/perfil" className="flex items-center justify-between bg-white/5 hover:bg-white/10 rounded-xl px-4 py-3 transition">
          <span className="flex items-center gap-3">
            <span className="text-xl">✨</span>
            <span className="font-black text-sm">Completá tu perfil y foto</span>
          </span>
          <span className="text-ball font-black">→</span>
        </Link>
      </div>
    </div>
  );
}
