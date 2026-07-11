// Service Worker mínimo para que la PWA sea instalable en Chrome/Android/Edge.
// Sin caché offline por ahora (para no romper actualizaciones); solo permite el
// evento beforeinstallprompt.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Fetch handler passthrough. Chrome requiere que exista un fetch listener
// para clasificar la app como PWA instalable.
self.addEventListener('fetch', (event) => {
  // pass-through, no caching
});
