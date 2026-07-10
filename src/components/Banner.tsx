'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

// Banner superior administrado por el CEO desde /admin, por sección.
function sectionFromPath(path: string) {
  if (path.startsWith('/jugador/feed')) return 'feed';
  if (path.startsWith('/jugador/torneos')) return 'torneos';
  if (path.startsWith('/jugador/ranking')) return 'ranking';
  if (path.startsWith('/jugador/reserv')) return 'reservas';
  if (path.startsWith('/jugador/entrenamientos')) return 'entrenamientos';
  if (path.startsWith('/training')) return 'training';
  if (path.startsWith('/club')) return 'clubes';
  if (path.startsWith('/complejo/socios')) return 'membresias';
  if (path.startsWith('/jugador')) return 'inicio';
  if (path.startsWith('/complejo')) return 'complejo';
  return 'global';
}

export default function Banner() {
  const path = usePathname();
  const [banner, setBanner] = useState<any>(null);
  const [hidden, setHidden] = useState<string[]>([]);

  useEffect(() => {
    const sec = sectionFromPath(path);
    supabase.from('banners').select('*')
      .eq('active', true).in('section', [sec, 'global'])
      .order('priority', { ascending: false }).limit(3)
      .then(({ data }) => setBanner((data ?? []).find(b => !hidden.includes(b.id)) ?? null));
  }, [path, hidden]);

  if (!banner) return null;
  const inner = (
    <div className="flex items-center gap-3 px-4 py-2.5 max-w-md mx-auto">
      <span className="w-9 h-9 rounded-full bg-ball/20 flex items-center justify-center text-lg shrink-0">
        {banner.emoji ?? '🎾'}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-display font-black text-sm text-white leading-tight truncate">{banner.title}</p>
        {banner.subtitle && <p className="text-white/60 text-xs truncate">{banner.subtitle}</p>}
        {banner.link_label && <p className="text-ball text-xs font-bold">{banner.link_label} →</p>}
      </div>
      <button onClick={e => { e.preventDefault(); e.stopPropagation(); setHidden([...hidden, banner.id]); }}
        className="text-white/40 text-lg font-bold px-1 shrink-0">✕</button>
    </div>
  );
  return (
    <div className="bg-[#0A1020] border-b border-ball/20 sticky top-0 z-50">
      {banner.link_url ? <a href={banner.link_url} target="_blank">{inner}</a> : inner}
    </div>
  );
}
