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
    <Link href={href}
      aria-label="Notificaciones"
      title="Notificaciones"
      className="relative inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/5 border border-white/15 hover:bg-white/10 hover:border-ball/50 transition">
      {/* Campana de notificaciones */}
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none"
        stroke="#D8F646" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center px-1 border-2 border-[#0D1320]">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
