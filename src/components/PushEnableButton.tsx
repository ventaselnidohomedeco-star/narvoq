'use client';
import { useEffect, useState } from 'react';

// Helper: convierte la VAPID public key (base64url) a Uint8Array que necesita PushManager.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type Status = 'unknown' | 'unsupported' | 'denied' | 'granted' | 'subscribed';

export default function PushEnableButton({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<Status>('unknown');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (typeof window === 'undefined') return;
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setStatus('unsupported'); return;
      }
      if (Notification.permission === 'denied') { setStatus('denied'); return; }
      // Verificar si ya hay suscripción activa
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setStatus(sub ? 'subscribed' : (Notification.permission === 'granted' ? 'granted' : 'unknown'));
      } catch { setStatus('unknown'); }
    })();
  }, []);

  async function activar() {
    setBusy(true);
    try {
      // 1. Registrar SW si no está ya
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // 2. Pedir permiso
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setStatus('denied'); return; }

      // 3. Traer VAPID public key
      const r = await fetch('/api/push/vapid-public');
      const { key } = await r.json();
      if (!key) throw new Error('VAPID no configurada en el servidor');

      // 4. Suscribirse
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key)
      });

      // 5. Guardar en backend
      const json = sub.toJSON() as any;
      const res = await fetch('/api/push/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys })
      });
      if (!res.ok) throw new Error('No se pudo registrar la suscripción');
      setStatus('subscribed');
    } catch (e: any) {
      alert('Error activando notificaciones: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function desactivar() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint })
        });
        await sub.unsubscribe();
      }
      setStatus('granted');
    } finally { setBusy(false); }
  }

  if (status === 'unsupported') {
    return compact ? null : (
      <p className="text-white/50 text-xs">Tu navegador no soporta notificaciones push.</p>
    );
  }

  if (status === 'denied') {
    return (
      <div className={`rounded-xl bg-yellow-500/10 border border-yellow-500/30 p-3 ${compact ? 'text-xs' : 'text-sm'}`}>
        <p className="text-yellow-300 font-bold">🔕 Notificaciones bloqueadas</p>
        <p className="text-white/60 text-xs mt-1">
          Activálas desde los permisos del navegador (candado 🔒 en la barra) y recargá.
        </p>
      </div>
    );
  }

  if (status === 'subscribed') {
    return (
      <button onClick={desactivar} disabled={busy}
        className={`rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 font-bold ${compact ? 'py-2 px-3 text-xs' : 'py-3 px-4 text-sm w-full'} disabled:opacity-50`}>
        {busy ? 'Desactivando…' : '🔔 Notificaciones activas · Desactivar'}
      </button>
    );
  }

  return (
    <button onClick={activar} disabled={busy}
      className={`rounded-xl bg-ball text-courtdark font-black ${compact ? 'py-2 px-3 text-xs' : 'py-3 px-4 text-sm w-full'} active:scale-95 disabled:opacity-50`}>
      {busy ? 'Activando…' : '🔔 Activar notificaciones al celu'}
    </button>
  );
}
