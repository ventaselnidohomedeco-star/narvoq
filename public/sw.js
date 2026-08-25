// Service Worker de NarvoQ.
// - Instalable como PWA (Chrome/Android/Edge)
// - Recibe Web Push y muestra notificaciones nativas (con sonido/vibración)
// - Click en notificación → abre el link asociado

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
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    tag: data.ref_id || 'narvoq',
    renotify: true,
    data: { link: data.link || '/', kind: data.kind || 'generic' }
  };

  event.waitUntil(self.registration.showNotification(data.title || 'NarvoQ', options));
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
