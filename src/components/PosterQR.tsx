'use client';
import { useState } from 'react';
import QRCode from 'qrcode';

/**
 * Genera un poster A4 en HD (2480x3508 px @ 300dpi) con:
 * - Logo NarvoQ arriba
 * - Nombre del complejo
 * - QR gigante centrado
 * - URL en texto
 * - CTA "Escaneá para reservar"
 * - "Sin descargas, en 30 segundos"
 *
 * Descarga como PNG listo para imprimir.
 */
export default function PosterQR({ url, complexName }: { url: string; complexName: string }) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  async function generar(opts: { size: 'a4' | 'square'; download: boolean }) {
    setBusy(true);
    try {
      const isA4 = opts.size === 'a4';
      // Tamaños para impresión de calidad (300 dpi)
      const W = isA4 ? 2480 : 2000;   // A4 vertical 8.27"
      const H = isA4 ? 3508 : 2000;   // A4 vertical 11.7"

      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d')!;

      // Fondo negro grafito con degradado sutil
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0F1319');
      bg.addColorStop(1, '#000000');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Marco verde lima (borde)
      ctx.strokeStyle = '#B4FF39';
      ctx.lineWidth = 20;
      ctx.strokeRect(60, 60, W - 120, H - 120);

      // Texto "RESERVÁ TU TURNO" arriba
      ctx.fillStyle = '#B4FF39';
      ctx.font = `900 ${isA4 ? 140 : 110}px system-ui, -apple-system, Arial`;
      ctx.textAlign = 'center';
      ctx.fillText('RESERVÁ TU TURNO', W / 2, isA4 ? 320 : 280);

      // Nombre del complejo
      ctx.fillStyle = '#ffffff';
      ctx.font = `900 ${isA4 ? 180 : 140}px system-ui, -apple-system, Arial`;
      const complexTruncated = complexName.length > 24 ? complexName.slice(0, 22) + '…' : complexName;
      ctx.fillText(complexTruncated.toUpperCase(), W / 2, isA4 ? 540 : 460);

      // Sub CTA
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${isA4 ? 80 : 70}px system-ui, -apple-system, Arial`;
      ctx.fillText('📱 Escaneá con la cámara del celular', W / 2, isA4 ? 720 : 620);

      // QR GIGANTE centrado
      const qrSize = isA4 ? 1700 : 1400;
      const qrX = (W - qrSize) / 2;
      const qrY = isA4 ? 850 : 720;

      // Fondo blanco para el QR (obligatorio para lectura óptima)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(qrX - 40, qrY - 40, qrSize + 80, qrSize + 80);

      // Generar el QR como dataURL alta densidad
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: qrSize,
        margin: 1,
        errorCorrectionLevel: 'H', // alto — resiste manchas / logo tapando parte
        color: { dark: '#000000', light: '#ffffff' }
      });
      const qrImg = await loadImage(qrDataUrl);
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

      // Logo NarvoQ chico en el CENTRO del QR (con error correction H aguanta)
      try {
        const logoImg = await loadImage('/brand/logo.png?v=9');
        const logoSize = qrSize * 0.18;
        const logoX = qrX + (qrSize - logoSize) / 2;
        const logoY = qrY + (qrSize - logoSize) / 2;
        // Fondo blanco redondeado para el logo
        ctx.fillStyle = '#ffffff';
        roundedRect(ctx, logoX - 20, logoY - 20, logoSize + 40, logoSize + 40, 24);
        ctx.fill();
        // Dibujar logo respetando aspect ratio
        const ratio = logoImg.width / logoImg.height;
        const lw = logoSize;
        const lh = logoSize / ratio;
        ctx.drawImage(logoImg, logoX, logoY + (logoSize - lh) / 2, lw, lh);
      } catch {}

      // URL debajo del QR
      const yUrl = qrY + qrSize + (isA4 ? 180 : 160);
      ctx.fillStyle = '#B4FF39';
      ctx.font = `900 ${isA4 ? 90 : 80}px system-ui, -apple-system, Arial`;
      ctx.fillText(url.replace(/^https?:\/\//, ''), W / 2, yUrl);

      // Sub: "Sin descargar apps"
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${isA4 ? 70 : 60}px system-ui, -apple-system, Arial`;
      ctx.fillText('Sin descargar apps · En 30 segundos', W / 2, yUrl + (isA4 ? 120 : 100));

      // Footer NarvoQ
      const yFoot = H - (isA4 ? 200 : 180);
      ctx.fillStyle = '#666';
      ctx.font = `600 ${isA4 ? 50 : 45}px system-ui, -apple-system, Arial`;
      ctx.fillText('gestionado con', W / 2, yFoot);
      ctx.fillStyle = '#B4FF39';
      ctx.font = `900 ${isA4 ? 110 : 100}px system-ui, -apple-system, Arial`;
      ctx.fillText('NARVOQ', W / 2, yFoot + (isA4 ? 100 : 90));

      // Descargar o preview
      if (opts.download) {
        const link = document.createElement('a');
        link.download = `narvoq-poster-${complexName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${opts.size}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } else {
        setPreview(canvas.toDataURL('image/png'));
      }
    } catch (e: any) {
      alert('Error generando el poster: ' + (e?.message ?? 'desconocido'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={busy}
          onClick={() => generar({ size: 'a4', download: true })}
          className="py-3 rounded-xl bg-ball text-black font-black text-sm active:scale-95 transition disabled:opacity-50">
          {busy ? '⏳ Generando…' : '🖨 Descargar A4 (imprimir)'}
        </button>
        <button type="button" disabled={busy}
          onClick={() => generar({ size: 'square', download: true })}
          className="py-3 rounded-xl bg-white/10 border border-white/20 text-white font-black text-sm active:scale-95 transition disabled:opacity-50">
          {busy ? '⏳' : '📸 Descargar cuadrado (Instagram)'}
        </button>
      </div>
      <button type="button" disabled={busy}
        onClick={() => generar({ size: 'a4', download: false })}
        className="w-full py-2 rounded-xl bg-transparent border border-white/20 text-white/70 text-xs font-bold active:scale-95 transition disabled:opacity-50">
        👁 Ver preview antes de imprimir
      </button>
      {preview && (
        <div className="mt-3 relative">
          <img src={preview} alt="Preview poster" className="w-full rounded-xl border border-white/10" />
          <button onClick={() => setPreview(null)}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 text-white font-bold">✕</button>
        </div>
      )}
    </div>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
