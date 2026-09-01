'use client';
import { useEffect, useRef, useState } from 'react';

// Escáner de códigos de barras que usa la API nativa `BarcodeDetector`
// (Android Chrome/Edge la traen). En iOS o browsers sin soporte, informa que
// se puede usar un lector USB (que emula teclado y va directo al input).

type Props = {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;   // dispara cuando lee un código
};

export default function BarcodeScanner({ open, onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [error, setError] = useState<string>('');
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    if (!open) return;
    const anyWin: any = window;
    const supported = 'BarcodeDetector' in anyWin;
    setSupported(supported);
    if (!supported) return;

    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }, audio: false
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const detector = new anyWin.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code']
        });

        const scan = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes && codes.length > 0) {
              const val = String(codes[0].rawValue ?? '').trim();
              if (val) {
                onDetected(val);
                stop();
                return;
              }
            }
          } catch {}
          rafRef.current = requestAnimationFrame(scan);
        };
        scan();
      } catch (e: any) {
        setError('No se pudo acceder a la cámara: ' + (e?.message ?? 'permiso denegado'));
      }
    })();

    function stop() {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    return stop;
  }, [open, onDetected]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="w-full max-w-md bg-[#0F141D] border-2 border-ball rounded-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="p-3 border-b border-white/10 flex items-center justify-between">
          <p className="font-display font-black">📷 Escanear código</p>
          <button onClick={onClose} className="text-white/60 text-xl leading-none">×</button>
        </div>
        <div className="p-3">
          {supported === false ? (
            <div className="text-sm text-white/70 space-y-2">
              <p>⚠️ Tu navegador no soporta escáner por cámara.</p>
              <p>Podés usar un <b>lector USB</b> (los baratos de MercadoLibre andan directo — emulan teclado).</p>
              <p>O escribí el EAN a mano en el buscador de productos.</p>
            </div>
          ) : error ? (
            <p className="text-red-400 text-sm">{error}</p>
          ) : (
            <>
              <div className="relative rounded-xl overflow-hidden bg-black">
                <video ref={videoRef} playsInline muted className="w-full h-64 object-cover" />
                <div className="absolute inset-0 pointer-events-none border-4 border-ball/40 rounded-xl" />
                <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-0.5 bg-ball/70" />
              </div>
              <p className="text-white/50 text-xs mt-2 text-center">Apuntá el código de barras a la cámara. Reconoce EAN-13/8, UPC, Code-128 y QR.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
