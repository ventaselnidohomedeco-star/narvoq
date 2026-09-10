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
  const [soundOn, setSoundOn] = useState<boolean>(true);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');
    const [{ data }, { data: prof }] = await Promise.all([
      supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(80),
      supabase.from('profiles').select('push_sound_enabled').eq('id', user.id).maybeSingle()
    ]);
    setItems(data ?? []);
    setSoundOn(prof?.push_sound_enabled !== false);
    setLoading(false);
    // marcar como leídas al abrir
    await supabase.from('notifications').update({ read: true })
      .eq('user_id', user.id).eq('read', false);
    // 🔴 Limpiar el globito del ícono de la PWA
    try {
      if ('clearAppBadge' in navigator) await (navigator as any).clearAppBadge();
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        const cache = await caches.open('narvoq-meta');
        await cache.put('narvoq-badge-count', new Response('0'));
      }
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from('profiles').update({ push_sound_enabled: next }).eq('id', user.id);
  }

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

      {/* Toggle sonido */}
      <button onClick={toggleSound}
        className={`mt-3 w-full flex items-center justify-between rounded-2xl border p-3 active:scale-[0.98] transition
          ${soundOn ? 'bg-ball/10 border-ball/40' : 'bg-white/5 border-white/10'}`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{soundOn ? '🔔' : '🔕'}</span>
          <div className="text-left">
            <p className="font-display font-black text-sm">{soundOn ? 'Sonido activado' : 'Sonido en silencio'}</p>
            <p className="text-white/50 text-[11px]">Tocá para {soundOn ? 'silenciar' : 'activar'} el sonido de las notificaciones.</p>
          </div>
        </div>
        <span className={`inline-block w-11 h-6 rounded-full relative transition ${soundOn ? 'bg-ball' : 'bg-white/20'}`}>
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition ${soundOn ? 'left-5' : 'left-0.5'}`} />
        </span>
      </button>

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
