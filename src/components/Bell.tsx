'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

// Bola de pádel en lima con badge de contador cuando hay notif no leídas.
export default function Bell({ href = '/notificaciones' }: { href?: string }) {
  const [count, setCount] = useState(0);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { count } = await supabase.from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('read', false);
    setCount(count ?? 0);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <Link href={href} className="relative inline-flex items-center justify-center w-10 h-10">
      {/* Pelota de pádel */}
      <svg viewBox="0 0 40 40" width="34" height="34" aria-label="Notificaciones">
        <defs>
          <radialGradient id="ball-grad" cx="35%" cy="30%">
            <stop offset="0%" stopColor="#F4FF9E" />
            <stop offset="35%" stopColor="#D8F646" />
            <stop offset="80%" stopColor="#A8C22E" />
            <stop offset="100%" stopColor="#5F7414" />
          </radialGradient>
        </defs>
        <circle cx="20" cy="20" r="18" fill="url(#ball-grad)" />
        {/* Costura curva de la pelota */}
        <path d="M6 16 Q 20 6, 34 16" fill="none" stroke="#f9ffe0" strokeWidth="1.2" strokeLinecap="round" opacity="0.85" />
        <path d="M6 24 Q 20 34, 34 24" fill="none" stroke="#f9ffe0" strokeWidth="1.2" strokeLinecap="round" opacity="0.85" />
      </svg>
      {count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center px-1 border-2 border-[#0D1320]">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
