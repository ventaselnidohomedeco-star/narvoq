'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

type NewUser = {
  id: string;
  username: string;
  first_name: string;
  last_name?: string | null;
  avatar_url?: string | null;
  category?: number | null;
  locality?: string | null;
  created_at: string;
};

/**
 * Carrusel horizontal de últimos jugadores registrados.
 * Se muestra arriba del feed: primero los de la misma localidad, después el resto.
 * Solo aparece si hay al menos 1 nuevo en los últimos 14 días.
 */
export default function NuevosEnNarvoQ({ myLocality, myId }: { myLocality?: string | null; myId?: string | null }) {
  const [users, setUsers] = useState<NewUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const desde = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();

      // Traer últimos jugadores con perfil completo (con first_name para excluir registros incompletos)
      const { data } = await supabase.from('profiles')
        .select('id, username, first_name, last_name, avatar_url, category, locality, created_at')
        .eq('role', 'player')
        .not('first_name', 'is', null)
        .gte('created_at', desde)
        .order('created_at', { ascending: false })
        .limit(30);

      let list = (data ?? []) as NewUser[];
      if (myId) list = list.filter(u => u.id !== myId);

      // Priorizar los de la misma localidad
      if (myLocality) {
        list.sort((a, b) => {
          const aLoc = (a.locality ?? '').toLowerCase() === myLocality.toLowerCase() ? 1 : 0;
          const bLoc = (b.locality ?? '').toLowerCase() === myLocality.toLowerCase() ? 1 : 0;
          return bLoc - aLoc;
        });
      }

      setUsers(list.slice(0, 12));
      setLoading(false);
    })();
  }, [myLocality, myId]);

  if (loading || users.length === 0) return null;

  return (
    <div className="mt-3 mb-4 rounded-2xl bg-gradient-to-br from-ball/10 via-ball/5 to-transparent border border-ball/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-ball text-[11px] font-black tracking-widest">👋 NUEVOS EN NARVOQ</p>
        <Link href="/jugador/buscar" className="text-white/60 text-xs font-black">Ver todos →</Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
        {users.map(u => {
          const displayName = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.username;
          const isSameLoc = myLocality && u.locality && u.locality.toLowerCase() === myLocality.toLowerCase();
          return (
            <Link key={u.id} href={`/u/${u.username}`}
              className="shrink-0 w-20 flex flex-col items-center gap-1.5 active:scale-95 transition">
              <div className="relative">
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover ring-2 ring-ball/50" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-grafito text-white text-xl font-display font-black flex items-center justify-center ring-2 ring-ball/50">
                    {u.first_name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                )}
                {/* Badge NEW */}
                <span className="absolute -top-1 -right-1 bg-ball text-black text-[8px] font-black px-1.5 py-0.5 rounded-full">NEW</span>
                {isSameLoc && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full whitespace-nowrap">📍 Zona</span>
                )}
              </div>
              <p className="text-white text-xs font-black text-center leading-tight line-clamp-2 mt-1">
                {u.first_name} {u.last_name ? u.last_name[0] + '.' : ''}
              </p>
              {u.category != null && (
                <p className="text-white/50 text-[10px] font-bold">Cat. {u.category}</p>
              )}
            </Link>
          );
        })}
      </div>
      <p className="text-white/50 text-[11px] text-center mt-3">
        Dales la bienvenida 👋 — seguilos y armá partido con ellos
      </p>
    </div>
  );
}
