'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

const EMOJI: Record<string, string> = {
  like: '❤️',
  comment: '💬',
  reserva_ok: '✅',
  membresia_ok: '🏆',
  coach_add: '👥',
  training_new: '🎾',
  torneo_nuevo: '🥇',
  mencion: '📣'
};

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'recién';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

export default function Notificaciones() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');
    const { data } = await supabase.from('notifications')
      .select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(80);
    setItems(data ?? []);
    setLoading(false);
    // marcar como leídas al abrir
    await supabase.from('notifications').update({ read: true })
      .eq('user_id', user.id).eq('read', false);
  }
  useEffect(() => { load(); }, []);

  async function borrarTodas() {
    if (!confirm('¿Borrar todas las notificaciones?')) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('notifications').delete().eq('user_id', user!.id);
    setItems([]);
  }

  return (
    <main className="min-h-dvh max-w-md mx-auto px-5 py-6 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-black text-2xl">Notificaciones</h1>
        {items.length > 0 && (
          <button onClick={borrarTodas} className="text-white/50 text-xs underline">Borrar todas</button>
        )}
      </div>

      {loading && <p className="text-white/50 mt-4">Cargando…</p>}

      {!loading && items.length === 0 && (
        <div className="card mt-6 text-center py-10">
          <p className="text-4xl">🔔</p>
          <p className="text-white/60 mt-3">No tenés notificaciones todavía.</p>
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {items.map(n => {
          const content = (
            <div className={`card flex items-start gap-3 ${!n.read ? 'ring-1 ring-ball/30' : ''}`}>
              <span className="text-2xl shrink-0">{EMOJI[n.kind] ?? '🔔'}</span>
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-sm">{n.title}</p>
                {n.body && <p className="text-white/60 text-sm mt-1">{n.body}</p>}
                <p className="text-white/40 text-xs mt-1">{timeAgo(n.created_at)}</p>
              </div>
            </div>
          );
          return (
            <li key={n.id}>
              {n.link ? <Link href={n.link}>{content}</Link> : content}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
