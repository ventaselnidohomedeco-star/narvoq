// Service Worker de NarvoQ — v2 (con sonido controlado por payload).
// - Instalable como PWA (Chrome/Android/Edge)
// - Recibe Web Push y muestra notificaciones nativas (con sonido/vibración)
// - Click en notificación → abre el link asociado
// NOTA: cambiar este comentario o cualquier byte del archivo fuerza a Chrome
// a re-instalar el SW en el cliente (hash cambió).
const SW_VERSION = 'narvoq-v2-2026-09-10';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Fetch passthrough — necesario para que Chrome considere la app PWA instalable.
self.addEventListener('fetch', (event) => {
  // pass-through, sin caché
});

// === WEB PUSH ===
// Payload esperado: { title, body, link, kind, ref_id }
self.addEventListener('push', (event) => {
  let data = { title: 'NarvoQ', body: 'Tenés una notificación nueva', link: '/' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch { /* si no es JSON, dejamos el default */ }

  const options = {
    body: data.body,
    icon: '/brand/icono-app.png',
    badge: '/brand/icono-app.png',
    // Vibración intensa (Android)
    vibrate: [200, 100, 200, 100, 400],
    // Distinto tag por notif → no re-agrupa. Con renotify=true, cada push
    // vibra y suena aunque tenga el mismo tag.
    tag: data.ref_id || `narvoq-${Date.now()}`,
    renotify: true,
    silent: data.silent === true, // el server manda silent=true si el user desactivó el sonido
    requireInteraction: false, // se auto-oculta a los ~20s (mejor UX que "requireInteraction")
    timestamp: Date.now(),
    data: { link: data.link || '/', kind: data.kind || 'generic' }
  };

  event.waitUntil((async () => {
    await self.registration.showNotification(data.title || 'NarvoQ', options);
    // 🔴 Globito rojo en el ícono de la PWA (Badging API)
    // Chrome/Edge en Android/Windows lo muestran como número sobre el ícono
    try {
      if (self.navigator && 'setAppBadge' in self.navigator) {
        // Sumar 1 al badge existente (no tenemos el total real acá)
        const key = 'narvoq-badge-count';
        const stored = Number((await self.caches?.open('narvoq-meta').then(c => c.match(key)).then(r => r?.text()).catch(() => '0')) || '0');
        const next = stored + 1;
        await self.navigator.setAppBadge(next);
        const cache = await self.caches.open('narvoq-meta');
        await cache.put(key, new Response(String(next)));
      }
    } catch { /* Badging API no soportada — ok */ }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si hay una ventana abierta, la enfocamos y navegamos ahí
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({ type: 'push-navigate', link });
          return client.focus();
        }
      }
      // Si no, abrimos una nueva
      if (self.clients.openWindow) return self.clients.openWindow(link);
    })
  );
});
