'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

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
    const t = setInterval(load, 30000); // refresco pasivo cada 30s
    return () => clearInterval(t);
  }, []);

  return (
    <Link href={href} className="relative inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/5">
      <span className="text-lg">🔔</span>
      {count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-ball text-courtdark text-[10px] font-black flex items-center justify-center px-1">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
