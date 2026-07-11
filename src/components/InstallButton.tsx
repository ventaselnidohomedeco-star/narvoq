'use client';
import { useEffect, useState } from 'react';

// Botón "Descargar Narvoq" que instala la PWA en el celular.
// - Android / Chrome / Edge / Samsung Internet: usa beforeinstallprompt (instalación en 1 tap).
// - iOS Safari / iPad: muestra un modal con instrucciones (Apple no permite la API programática).
// - Si el usuario YA la tiene instalada, el botón no aparece.

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isIos() {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
}

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true;
}

export default function InstallButton({
  variant = 'primary',
  className = ''
}: { variant?: 'primary' | 'ghost'; className?: string }) {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [hidden, setHidden] = useState(true); // arranca oculto hasta chequear
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isStandalone()) return; // ya está instalada
    setIos(isIos());
    setHidden(false);
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setHidden(true));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function descargar() {
    if (prompt) {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') setHidden(true);
      setPrompt(null);
      return;
    }
    // Fallback: iOS o navegador que no soporta prompt programático
    setShowIosHelp(true);
  }

  if (hidden) return null;

  const btnClass = variant === 'primary'
    ? 'bg-ball text-courtdark font-display font-black rounded-xl px-5 py-3 text-lg active:scale-95 transition inline-flex items-center gap-2'
    : 'bg-white/10 text-white font-display font-bold rounded-xl px-4 py-2 text-sm active:scale-95 transition inline-flex items-center gap-2';

  return (
    <>
      <button onClick={descargar} className={`${btnClass} ${className}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Descargar app
      </button>

      {showIosHelp && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-end sm:items-center justify-center" onClick={() => setShowIosHelp(false)}>
          <div className="bg-[#141A24] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <img src="/brand/icono-app.png" alt="Narvoq" className="w-14 h-14 rounded-2xl" />
              <div>
                <p className="font-display font-black text-lg">Instalar Narvoq</p>
                <p className="text-white/50 text-xs">{ios ? 'Instrucciones para iPhone' : 'Instrucciones'}</p>
              </div>
            </div>

            {ios ? (
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="w-7 h-7 rounded-full bg-ball text-courtdark font-black flex items-center justify-center shrink-0">1</span>
                  <span>Tocá el botón de <b>Compartir</b> abajo (□↑) en Safari.</span>
                </li>
                <li className="flex gap-3">
                  <span className="w-7 h-7 rounded-full bg-ball text-courtdark font-black flex items-center justify-center shrink-0">2</span>
                  <span>Deslizá y elegí <b>“Agregar a pantalla de inicio”</b>.</span>
                </li>
                <li className="flex gap-3">
                  <span className="w-7 h-7 rounded-full bg-ball text-courtdark font-black flex items-center justify-center shrink-0">3</span>
                  <span>Tocá <b>Agregar</b>. Listo: aparece el ícono en tu home 🎾.</span>
                </li>
                <p className="text-white/40 text-xs pt-1">
                  Chrome en iPhone no permite instalar. Si estás en Chrome, cambiá a Safari.
                </p>
              </ol>
            ) : (
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="w-7 h-7 rounded-full bg-ball text-courtdark font-black flex items-center justify-center shrink-0">1</span>
                  <span>Abrí el menú del navegador (⋮ arriba a la derecha).</span>
                </li>
                <li className="flex gap-3">
                  <span className="w-7 h-7 rounded-full bg-ball text-courtdark font-black flex items-center justify-center shrink-0">2</span>
                  <span>Tocá <b>“Instalar app”</b> o <b>“Agregar a pantalla de inicio”</b>.</span>
                </li>
              </ol>
            )}

            <button onClick={() => setShowIosHelp(false)}
              className="w-full py-3 rounded-xl bg-white/10 font-semibold">Entendido</button>
          </div>
        </div>
      )}
    </>
  );
}
