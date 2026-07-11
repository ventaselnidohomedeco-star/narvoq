'use client';
import { useEffect } from 'react';

// Registra el service worker de /sw.js apenas se carga la app.
// Necesario para que Chrome/Android muestre el prompt de instalar la PWA.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    // Registro silencioso; no bloqueamos la app si falla.
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  }, []);
  return null;
}
