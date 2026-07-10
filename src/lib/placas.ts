'use client';

/**
 * Placas JPG (1080x1350) estilo marca deportiva: fondo carbón, diagonales lima,
 * tipografía condensada en mayúsculas y pelota realista con degradados.
 * Se generan 100% en el navegador con Canvas, sin servidor.
 */

export type PlacaKind =
  | 'reserva' | 'busco_jugadores' | 'partido_completo' | 'resultado'
  | 'ranking' | 'inscripcion' | 'torneo_abierto' | 'campeones' | 'estadisticas';

export interface PlacaData {
  kind: PlacaKind;
  title: string;
  main: string;
  detail: string;
  footer?: string;
  score?: string;
}

const KIND_LABEL: Record<PlacaKind, string> = {
  reserva: 'RESERVA CONFIRMADA',
  busco_jugadores: 'BUSCAMOS JUGADOR',
  partido_completo: 'PARTIDO COMPLETO',
  resultado: 'RESULTADO FINAL',
  ranking: 'RANKING',
  inscripcion: 'INSCRIPCIÓN CONFIRMADA',
  torneo_abierto: 'TORNEO ABIERTO',
  campeones: 'CAMPEONES',
  estadisticas: 'PLAYER STATS'
};

const LIME = '#D8F646';
const CARBON = '#0C0F14';

export function drawPlaca(data: PlacaData): HTMLCanvasElement {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;

  // ---- Fondo carbón con viñeta ----
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#161B24'); bg.addColorStop(0.55, CARBON); bg.addColorStop(1, '#05070A');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);

  // Textura sutil: líneas diagonales finas
  g.save();
  g.strokeStyle = 'rgba(255,255,255,0.03)'; g.lineWidth = 2;
  for (let i = -H; i < W; i += 42) {
    g.beginPath(); g.moveTo(i, H); g.lineTo(i + H, 0); g.stroke();
  }
  g.restore();

  // ---- Diagonales lima (firma de la marca) ----
  g.save();
  g.translate(W, 0); g.rotate(Math.PI / 7);
  g.fillStyle = LIME; g.fillRect(-140, -80, 70, 900);
  g.fillStyle = 'rgba(216,246,70,0.35)'; g.fillRect(-40, -80, 26, 700);
  g.restore();

  // Gran barra diagonal inferior
  g.save();
  g.translate(0, H); g.rotate(-Math.PI / 14);
  g.fillStyle = 'rgba(216,246,70,0.08)'; g.fillRect(-100, -30, W * 1.4, 240);
  g.fillStyle = LIME; g.fillRect(-100, -14, W * 1.4, 14);
  g.restore();

  // ---- Marca ----
  g.font = '900 44px system-ui, sans-serif';
  g.fillStyle = '#FFFFFF';
  g.textAlign = 'left';
  g.fillText('PADEL', 90, 140);
  g.fillStyle = LIME;
  g.fillText('APP', 90 + g.measureText('PADEL').width, 140);
  g.fillStyle = 'rgba(255,255,255,0.4)';
  g.font = '700 26px system-ui, sans-serif';
  g.fillText('SAN MIGUEL DEL MONTE', 90, 178);

  // ---- Etiqueta del tipo (banda lima inclinada) ----
  const label = KIND_LABEL[data.kind] ?? data.kind.toUpperCase();
  g.save();
  g.translate(90, 300); g.rotate(-0.03);
  g.font = '900 46px system-ui, sans-serif';
  const lw = g.measureText(label).width + 60;
  g.fillStyle = LIME;
  g.beginPath();
  g.moveTo(0, -52); g.lineTo(lw + 24, -52); g.lineTo(lw, 16); g.lineTo(-14, 16);
  g.closePath(); g.fill();
  g.fillStyle = CARBON;
  g.fillText(label, 24, -2);
  g.restore();

  // ---- Título gigante condensado ----
  g.fillStyle = '#FFFFFF';
  const title = (data.title || '').toUpperCase();
  g.font = '900 118px system-ui, sans-serif';
  g.save();
  g.transform(0.82, 0, 0, 1, 0, 0);        // condensado horizontal
  wrapText(g, title, 90 / 0.82, 470, (W - 200) / 0.82, 122);
  g.restore();

  // ---- Score o detalle destacado ----
  if (data.score) {
    g.fillStyle = LIME;
    g.font = 'italic 900 150px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText(data.score, W / 2, 850);
    g.textAlign = 'left';
    // sombra de velocidad
    g.fillStyle = 'rgba(216,246,70,0.15)';
    g.font = 'italic 900 150px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText(data.score, W / 2 - 14, 842);
    g.textAlign = 'left';
  }

  // ---- Bloque de información ----
  const infoY = data.score ? 970 : 800;
  g.fillStyle = LIME; g.fillRect(90, infoY - 58, 10, 120);
  g.fillStyle = '#FFFFFF';
  g.font = '800 52px system-ui, sans-serif';
  wrapText(g, data.main ?? '', 130, infoY, W - 420, 62);
  g.fillStyle = 'rgba(255,255,255,0.65)';
  g.font = '600 40px system-ui, sans-serif';
  wrapText(g, data.detail ?? '', 130, infoY + 130, W - 420, 52);

  // ---- Pelota realista ----
  drawBall(g, W - 200, data.score ? 420 : 950, 130);

  // ---- Pie ----
  g.fillStyle = LIME; g.fillRect(0, H - 96, W, 96);
  g.fillStyle = CARBON;
  g.font = '900 36px system-ui, sans-serif';
  g.fillText((data.footer ?? 'NARVOQ · RESERVÁ · JUGÁ · SUMÁ').toUpperCase(), 90, H - 36);

  return c;
}

/** Pelota de pádel con volumen: degradé radial, sombra y costura curva. */
function drawBall(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.save();
  // sombra proyectada
  g.fillStyle = 'rgba(0,0,0,0.5)';
  g.beginPath(); g.ellipse(x + 14, y + r * 0.92, r * 0.85, r * 0.24, 0, 0, Math.PI * 2); g.fill();

  // esfera con luz arriba-izquierda
  const grad = g.createRadialGradient(x - r * 0.45, y - r * 0.5, r * 0.1, x, y, r * 1.15);
  grad.addColorStop(0, '#F4FF9E');
  grad.addColorStop(0.35, '#DCEF52');
  grad.addColorStop(0.75, '#A8C22E');
  grad.addColorStop(1, '#5F7414');
  g.fillStyle = grad;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();

  // costuras (dos curvas blancas típicas)
  g.strokeStyle = 'rgba(255,255,255,0.92)';
  g.lineWidth = r * 0.075;
  g.lineCap = 'round';
  g.beginPath(); g.arc(x - r * 1.15, y, r * 1.55, -0.55, 0.55); g.stroke();
  g.beginPath(); g.arc(x + r * 1.15, y, r * 1.55, Math.PI - 0.55, Math.PI + 0.55); g.stroke();
  // sombra de costura
  g.strokeStyle = 'rgba(0,0,0,0.12)';
  g.lineWidth = r * 0.03;
  g.beginPath(); g.arc(x - r * 1.15, y + r * 0.04, r * 1.55, -0.5, 0.5); g.stroke();

  // brillo especular
  const shine = g.createRadialGradient(x - r * 0.5, y - r * 0.55, 0, x - r * 0.5, y - r * 0.55, r * 0.5);
  shine.addColorStop(0, 'rgba(255,255,255,0.55)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = shine;
  g.beginPath(); g.arc(x - r * 0.45, y - r * 0.5, r * 0.5, 0, Math.PI * 2); g.fill();
  g.restore();
}

function wrapText(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  const words = (text ?? '').split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, y); y += lh; line = w;
    } else line = test;
  }
  if (line) g.fillText(line, x, y);
}

/** Comparte o descarga la placa como JPG. */
export async function sharePlaca(data: PlacaData, fileName = 'placa.jpg') {
  const canvas = drawPlaca(data);
  const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), 'image/jpeg', 0.92));
  const file = new File([blob], fileName, { type: 'image/jpeg' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: data.title }); return; } catch {}
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName; a.click();
  URL.revokeObjectURL(url);
}
