'use client';
import { useState } from 'react';

// Poster generado en Canvas: PNG descargable con branding NarvoQ.
// 3 modos: 'groups' (armado inicial), 'standings' (post fase de grupos), 'bracket' (eliminatoria).
// No usa dependencias externas — Canvas API puro.

type PairRow = { id: string; n1: string; n2: string; };
type GroupSummary = { label: string; members: PairRow[] };
type StandingRow = { pair: PairRow; pts: number; pg: number; pj: number; ds: number };
type StandingSummary = { label: string; rows: StandingRow[] };
type BracketMatch = {
  round: string;       // "Play-in", "Preliminar", "Octavos", "Cuartos", "Semifinal", "Final"
  pair1?: PairRow | null;
  pair2?: PairRow | null;
  score?: string | null;
  winner_id?: string | null;
};

export type PosterInput =
  | { mode: 'groups'; tournamentName: string; category?: string; groups: GroupSummary[] }
  | { mode: 'standings'; tournamentName: string; category?: string; standings: StandingSummary[] }
  | { mode: 'bracket'; tournamentName: string; category?: string; matches: BracketMatch[]; champion?: PairRow | null; runnerUp?: PairRow | null };

const BALL = '#D8F646';
const COURT = '#0A1633';
const GRAFITO = '#2A2E36';
const WHITE = '#FFFFFF';
const WHITE70 = 'rgba(255,255,255,0.7)';
const WHITE40 = 'rgba(255,255,255,0.4)';

export default function TournamentPoster({ input, label }: { input: PosterInput; label?: string }) {
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const canvas = document.createElement('canvas');
      // Resolución alta para calidad de descarga
      canvas.width = 1200;
      canvas.height = 1600;
      const ctx = canvas.getContext('2d')!;
      drawPoster(ctx, canvas.width, canvas.height, input);

      // Descargar como PNG
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      const safeName = input.tournamentName.replace(/[^\w\-]+/g, '_');
      const suffix = input.mode === 'groups' ? 'grupos' : input.mode === 'standings' ? 'posiciones' : 'cuadro';
      a.href = url;
      a.download = `NarvoQ_${safeName}_${suffix}.png`;
      a.click();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Poster error', e);
      alert('No pude generar la imagen. Revisá la consola.');
    }
    setBusy(false);
  }

  return (
    <button
      onClick={generate}
      disabled={busy}
      className="text-xs font-black px-3 py-1.5 rounded-lg bg-ball/15 border border-ball/40 text-ball hover:bg-ball/25 disabled:opacity-50">
      {busy ? 'Generando…' : `📷 ${label ?? 'Compartir imagen'}`}
    </button>
  );
}

// ==================== Dibujar ====================

function drawPoster(ctx: CanvasRenderingContext2D, W: number, H: number, input: PosterInput) {
  // Fondo negro
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // Gradiente sutil de fondo
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(216,246,70,0.06)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(216,246,70,0.04)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Header con logo
  drawHeader(ctx, W, input.tournamentName, input.category);

  // Contenido según modo
  if (input.mode === 'groups') drawGroups(ctx, W, H, input.groups);
  else if (input.mode === 'standings') drawStandings(ctx, W, H, input.standings);
  else drawBracket(ctx, W, H, input.matches, input.champion, input.runnerUp);

  // Footer
  drawFooter(ctx, W, H);
}

function drawHeader(ctx: CanvasRenderingContext2D, W: number, title: string, category?: string) {
  // Wordmark NarvoQ (dibujado a mano — evita cargar imagen async)
  const cx = W / 2;
  const topY = 90;

  // Bloque marca
  ctx.font = 'bold 68px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // "narvo" + "Q" con Q en lima
  const totalText = 'narvoQ';
  const qPos = ctx.measureText('narvo').width;
  ctx.fillStyle = WHITE;
  ctx.fillText('narvo', cx - ctx.measureText('narvoQ').width / 2 + ctx.measureText('narvo').width / 2, topY);

  // Q en lima con círculo
  ctx.fillStyle = BALL;
  ctx.fillText('Q', cx - ctx.measureText('narvoQ').width / 2 + qPos + ctx.measureText('Q').width / 2, topY);

  // Línea divisoria
  ctx.strokeStyle = 'rgba(216,246,70,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 200, topY + 60);
  ctx.lineTo(cx + 200, topY + 60);
  ctx.stroke();

  // Título del torneo
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillStyle = WHITE;
  const titleY = topY + 110;
  wrappedText(ctx, title.toUpperCase(), cx, titleY, W - 100, 50, 2);

  // Categoría
  if (category) {
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillStyle = WHITE70;
    ctx.fillText(category.toUpperCase(), cx, titleY + 60);
  }
}

function drawGroups(ctx: CanvasRenderingContext2D, W: number, H: number, groups: GroupSummary[]) {
  // Sub-título
  const subY = 340;
  ctx.font = 'bold 32px system-ui, sans-serif';
  ctx.fillStyle = BALL;
  ctx.textAlign = 'center';
  ctx.fillText('GRUPOS DEFINIDOS', W / 2, subY);

  // Grid de grupos: 2 columnas (para hasta 8 grupos)
  const cols = groups.length <= 4 ? 2 : Math.ceil(Math.sqrt(groups.length));
  const rows = Math.ceil(groups.length / cols);
  const gap = 30;
  const marginX = 60;
  const startY = subY + 60;
  const availableH = H - startY - 100;
  const cardW = (W - marginX * 2 - gap * (cols - 1)) / cols;
  const cardH = Math.min(400, (availableH - gap * (rows - 1)) / rows);

  groups.forEach((g, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = marginX + col * (cardW + gap);
    const y = startY + row * (cardH + gap);
    drawGroupCard(ctx, x, y, cardW, cardH, g);
  });
}

function drawGroupCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, g: GroupSummary) {
  // Fondo con borde lima
  ctx.fillStyle = 'rgba(216,246,70,0.08)';
  roundRect(ctx, x, y, w, h, 20);
  ctx.fill();
  ctx.strokeStyle = 'rgba(216,246,70,0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Header del grupo
  ctx.fillStyle = BALL;
  roundRect(ctx, x, y, w, 50, 20, { bottomLeft: 0, bottomRight: 0 });
  ctx.fill();

  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillStyle = COURT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`GRUPO ${g.label}`, x + w / 2, y + 25);

  // Lista de parejas
  const rowH = (h - 60) / Math.max(1, g.members.length);
  g.members.forEach((p, i) => {
    const yy = y + 60 + i * rowH;
    // Separador
    if (i > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 20, yy);
      ctx.lineTo(x + w - 20, yy);
      ctx.stroke();
    }
    // Número
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillStyle = BALL;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${i + 1}`, x + 20, yy + rowH / 2);

    // Nombres
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillStyle = WHITE;
    const label = `${p.n1} & ${p.n2}`;
    const truncated = truncateText(ctx, label, w - 60);
    ctx.fillText(truncated, x + 50, yy + rowH / 2);
  });
}

function drawStandings(ctx: CanvasRenderingContext2D, W: number, H: number, standings: StandingSummary[]) {
  const subY = 340;
  ctx.font = 'bold 32px system-ui, sans-serif';
  ctx.fillStyle = BALL;
  ctx.textAlign = 'center';
  ctx.fillText('POSICIONES FINALES', W / 2, subY);

  const cols = standings.length <= 4 ? 2 : Math.ceil(Math.sqrt(standings.length));
  const rows = Math.ceil(standings.length / cols);
  const gap = 30;
  const marginX = 60;
  const startY = subY + 60;
  const availableH = H - startY - 100;
  const cardW = (W - marginX * 2 - gap * (cols - 1)) / cols;
  const cardH = Math.min(440, (availableH - gap * (rows - 1)) / rows);

  standings.forEach((s, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = marginX + col * (cardW + gap);
    const y = startY + row * (cardH + gap);
    drawStandingCard(ctx, x, y, cardW, cardH, s);
  });
}

function drawStandingCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, s: StandingSummary) {
  ctx.fillStyle = 'rgba(216,246,70,0.08)';
  roundRect(ctx, x, y, w, h, 20);
  ctx.fill();
  ctx.strokeStyle = 'rgba(216,246,70,0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Header
  ctx.fillStyle = BALL;
  roundRect(ctx, x, y, w, 50, 20, { bottomLeft: 0, bottomRight: 0 });
  ctx.fill();
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillStyle = COURT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`ZONA ${s.label}`, x + w / 2, y + 25);

  // Columnas de header interno
  const headerY = y + 70;
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillStyle = WHITE40;
  ctx.textAlign = 'left';
  ctx.fillText('#', x + 20, headerY);
  ctx.fillText('PAREJA', x + 50, headerY);
  ctx.textAlign = 'right';
  ctx.fillText('PJ', x + w - 130, headerY);
  ctx.fillText('DS', x + w - 80, headerY);
  ctx.fillText('PTS', x + w - 20, headerY);

  const rowH = (h - 90) / Math.max(1, s.rows.length);
  s.rows.forEach((r, i) => {
    const yy = headerY + 20 + i * rowH;
    // Row bg (primeros dos con lima leve)
    if (i < 2) {
      ctx.fillStyle = 'rgba(216,246,70,0.1)';
      roundRect(ctx, x + 10, yy, w - 20, rowH - 4, 8);
      ctx.fill();
    }

    // Posición
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillStyle = i < 2 ? BALL : WHITE70;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${i + 1}`, x + 20, yy + rowH / 2);

    // Nombres
    ctx.font = i < 2 ? 'bold 18px system-ui, sans-serif' : '18px system-ui, sans-serif';
    ctx.fillStyle = i < 2 ? WHITE : WHITE70;
    const label = `${r.pair.n1} & ${r.pair.n2}`;
    const truncated = truncateText(ctx, label, w - 200);
    ctx.fillText(truncated, x + 50, yy + rowH / 2);

    // Stats
    ctx.textAlign = 'right';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillStyle = WHITE70;
    ctx.fillText(`${r.pj}`, x + w - 130, yy + rowH / 2);
    ctx.fillText(`${r.ds >= 0 ? '+' : ''}${r.ds}`, x + w - 80, yy + rowH / 2);
    ctx.fillStyle = i < 2 ? BALL : WHITE;
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(`${r.pts}`, x + w - 20, yy + rowH / 2);
  });
}

function drawBracket(ctx: CanvasRenderingContext2D, W: number, H: number, matches: BracketMatch[], champion?: PairRow | null, runnerUp?: PairRow | null) {
  const subY = 340;
  ctx.font = 'bold 32px system-ui, sans-serif';
  ctx.fillStyle = BALL;
  ctx.textAlign = 'center';
  ctx.fillText('CUADRO ELIMINATORIO', W / 2, subY);

  // Agrupar por ronda
  const byRound: Record<string, BracketMatch[]> = {};
  matches.forEach(m => { (byRound[m.round] ||= []).push(m); });
  const roundNames = ['Play-in', 'Preliminar', 'Octavos', 'Cuartos', 'Semifinal', 'Final']
    .filter(r => byRound[r]?.length);

  // Copa al centro
  const centerX = W / 2;
  const centerY = 950;
  drawTrophy(ctx, centerX, centerY, 200);

  // Campeón debajo de la copa
  if (champion) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillStyle = BALL;
    ctx.fillText('CAMPEONES', centerX, centerY + 130);
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillStyle = WHITE;
    ctx.fillText(`${champion.n1} & ${champion.n2}`, centerX, centerY + 165);
  }

  if (runnerUp) {
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = WHITE40;
    ctx.fillText(`Sub-campeones: ${runnerUp.n1} & ${runnerUp.n2}`, centerX, centerY + 200);
  }

  // Dibujar rondas en columnas: izquierda las primeras, derecha las últimas
  // Para simplificar, mostramos la ronda MÁS COMPLETA (la primera) del cuadro
  // Y solo listamos las rondas con matches
  const listY = subY + 60;
  const listH = 500;
  const colW = 260;
  const cols = roundNames.length;
  const marginX = Math.max(40, (W - cols * colW) / 2);

  roundNames.forEach((r, idx) => {
    const x = marginX + idx * colW;
    // Header ronda
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillStyle = BALL;
    ctx.textAlign = 'center';
    ctx.fillText(r.toUpperCase(), x + colW / 2 - 20, listY);

    // Lista de matches
    const ms = byRound[r];
    const matchH = Math.min(60, (listH - 40) / Math.max(1, ms.length));
    ms.forEach((m, i) => {
      const yy = listY + 30 + i * (matchH + 4);
      drawMatchRow(ctx, x, yy, colW - 30, matchH, m);
    });
  });
}

function drawMatchRow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, m: BracketMatch) {
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();

  const drawTeam = (pair: PairRow | null | undefined, isWinner: boolean, offsetY: number) => {
    ctx.font = isWinner ? 'bold 13px system-ui, sans-serif' : '12px system-ui, sans-serif';
    ctx.fillStyle = isWinner ? BALL : pair ? WHITE70 : WHITE40;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const label = pair ? `${pair.n1} & ${pair.n2}` : '— pendiente —';
    const truncated = truncateText(ctx, label, w - 20);
    ctx.fillText(truncated, x + 10, y + offsetY);
  };

  drawTeam(m.pair1, m.winner_id === m.pair1?.id, h * 0.3);
  drawTeam(m.pair2, m.winner_id === m.pair2?.id, h * 0.7);
}

// Copa de pádel (dibujada a mano — similar a la de Padeleros Argentina)
function drawTrophy(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const scale = size / 200;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Base
  ctx.fillStyle = '#8B6914';
  roundRect(ctx, -60, 70, 120, 20, 4);
  ctx.fill();

  // Peana
  ctx.fillStyle = '#5A4409';
  roundRect(ctx, -50, 60, 100, 20, 4);
  ctx.fill();

  // Cuerpo copa (silueta)
  const grad = ctx.createLinearGradient(-50, -80, 50, 60);
  grad.addColorStop(0, '#F5F5F5');
  grad.addColorStop(0.5, '#C0C0C0');
  grad.addColorStop(1, '#909090');
  ctx.fillStyle = grad;

  ctx.beginPath();
  // Tazón invertido
  ctx.moveTo(-50, -60);
  ctx.bezierCurveTo(-50, -20, -40, 30, 0, 30);
  ctx.bezierCurveTo(40, 30, 50, -20, 50, -60);
  ctx.lineTo(50, -80);
  ctx.lineTo(-50, -80);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Tapa con perilla
  ctx.fillStyle = '#D0D0D0';
  ctx.beginPath();
  ctx.ellipse(0, -85, 40, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, -105, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Asas
  ctx.strokeStyle = '#909090';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(-60, -40, 20, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(60, -40, 20, Math.PI / 2, -Math.PI / 2, true);
  ctx.stroke();

  // Cintas argentinas (celeste + blanco)
  ctx.strokeStyle = '#75AADB';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-30, 30);
  ctx.bezierCurveTo(-40, 70, -35, 110, -50, 130);
  ctx.stroke();
  ctx.strokeStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(-30, 35);
  ctx.bezierCurveTo(-35, 75, -30, 115, -45, 135);
  ctx.stroke();

  ctx.strokeStyle = '#75AADB';
  ctx.beginPath();
  ctx.moveTo(30, 30);
  ctx.bezierCurveTo(40, 70, 35, 110, 50, 130);
  ctx.stroke();
  ctx.strokeStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(30, 35);
  ctx.bezierCurveTo(35, 75, 30, 115, 45, 135);
  ctx.stroke();

  // Pelotitas de pádel (decoración)
  ctx.fillStyle = BALL;
  ctx.beginPath();
  ctx.arc(-80, 90, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(80, 90, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawFooter(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = WHITE40;
  ctx.textAlign = 'center';
  ctx.fillText('Generado con narvoQ · narvoq.vercel.app', W / 2, H - 40);
}

// ---- Utilidades de dibujo ----

function roundRect(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number,
  corners?: { topLeft?: number; topRight?: number; bottomLeft?: number; bottomRight?: number }
) {
  const tl = corners?.topLeft ?? r;
  const tr = corners?.topRight ?? r;
  const bl = corners?.bottomLeft ?? r;
  const br = corners?.bottomRight ?? r;
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx.lineTo(x + bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 3 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

function wrappedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number, maxLines: number) {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  words.forEach(w => {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  });
  if (cur) lines.push(cur);
  const shown = lines.slice(0, maxLines);
  const startY = y - ((shown.length - 1) * lineH) / 2;
  shown.forEach((ln, i) => {
    ctx.fillText(ln, x, startY + i * lineH);
  });
}
