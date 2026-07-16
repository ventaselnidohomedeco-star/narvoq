'use client';
import { useState } from 'react';

// Generador de posters compartibles del torneo (Canvas puro, sin deps).
// Modos:
//   - 'groups'     → grid de grupos con integrantes
//   - 'standings'  → tablas de posiciones por grupo (post fase de grupos)
//   - 'round'      → una fase eliminatoria concreta (preliminar/octavos/…/final)
// Todos los modos incluyen auspiciantes al pie si se pasan.

export type PairRow = { id: string; n1: string; n2: string };
export type GroupSummary = { label: string; members: PairRow[] };
export type StandingRow = { pair: PairRow; pts: number; pg: number; pj: number; ds: number };
export type StandingSummary = { label: string; rows: StandingRow[] };
export type RoundMatch = {
  pair1?: PairRow | null;
  pair2?: PairRow | null;
  score?: string | null;
  winner_id?: string | null;
};
export type Sponsor = { name?: string; logo_url: string; url?: string };

export type PosterInput =
  | { mode: 'groups'; tournamentName: string; category?: string; groups: GroupSummary[]; sponsors?: Sponsor[] }
  | { mode: 'standings'; tournamentName: string; category?: string; standings: StandingSummary[]; sponsors?: Sponsor[] }
  | {
      mode: 'round';
      tournamentName: string;
      category?: string;
      roundLabel: string;              // "Preliminar", "Octavos", "Cuartos", "Semifinal", "Final"
      matches: RoundMatch[];
      showSubtitle?: boolean;
      champion?: PairRow | null;       // solo en final con ganador
      runnerUp?: PairRow | null;
      sponsors?: Sponsor[];
    };

// Paleta NarvoQ
const BALL = '#D8F646';
const BALL_DARK = '#8FA82C';
const BG = '#0A0F1A';
const CARD = '#141B2A';
const CARD_LIGHT = '#1D2637';
const WHITE = '#FFFFFF';
const W80 = 'rgba(255,255,255,0.8)';
const W60 = 'rgba(255,255,255,0.6)';
const W30 = 'rgba(255,255,255,0.3)';

export default function TournamentPoster({ input, label }: { input: PosterInput; label?: string }) {
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      // 1) Precargar imágenes de auspiciantes (Canvas necesita HTMLImageElement listo)
      const sponsors = ('sponsors' in input && input.sponsors) ? input.sponsors : [];
      const sponsorImgs = await Promise.all(
        sponsors.map(s => loadImage(s.logo_url).catch(() => null))
      );

      // 2) Dibujar
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1600;
      const ctx = canvas.getContext('2d')!;
      drawPoster(ctx, canvas.width, canvas.height, input, sponsorImgs);

      // 3) Descargar
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      const safeName = input.tournamentName.replace(/[^\w\-]+/g, '_');
      const suffix = input.mode === 'groups' ? 'grupos'
        : input.mode === 'standings' ? 'posiciones'
        : input.roundLabel.toLowerCase().replace(/\s+/g, '_');
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

// ==================== Composición general ====================

function drawPoster(
  ctx: CanvasRenderingContext2D, W: number, H: number,
  input: PosterInput, sponsorImgs: (HTMLImageElement | null)[]
) {
  // Fondo con gradiente sutil
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0F1524');
  bg.addColorStop(1, '#050810');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Textura de "grid" muy sutil de cancha
  ctx.strokeStyle = 'rgba(216,246,70,0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }

  // Banda diagonal decorativa en esquina superior derecha
  ctx.save();
  ctx.fillStyle = BALL;
  ctx.beginPath();
  ctx.moveTo(W, 0); ctx.lineTo(W, 80); ctx.lineTo(W - 320, 0);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  // Franja negra para auspiciantes al pie
  const footerH = sponsorImgs.length > 0 ? 180 : 90;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, H - footerH, W, footerH);
  ctx.strokeStyle = BALL;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, H - footerH); ctx.lineTo(W, H - footerH);
  ctx.stroke();

  // Header
  drawHeader(ctx, W, input.tournamentName, input.category);

  // Contenido
  const contentTop = 340;
  const contentBottom = H - footerH - 40;

  if (input.mode === 'groups') drawGroups(ctx, W, contentTop, contentBottom, input.groups);
  else if (input.mode === 'standings') drawStandings(ctx, W, contentTop, contentBottom, input.standings);
  else drawRound(ctx, W, contentTop, contentBottom, input.roundLabel, input.matches, input.champion, input.runnerUp);

  // Auspiciantes al pie
  drawSponsors(ctx, W, H, footerH, input.sponsors ?? [], sponsorImgs);
}

// ==================== Header ====================

function drawHeader(ctx: CanvasRenderingContext2D, W: number, title: string, category?: string) {
  const cx = W / 2;

  // Wordmark "narvoQ"
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 82px system-ui, -apple-system, sans-serif';

  const parte1 = 'narvo';
  const parte2 = 'Q';
  const w1 = ctx.measureText(parte1).width;
  const w2 = ctx.measureText(parte2).width;
  const totalW = w1 + w2;
  const startX = cx - totalW / 2;

  ctx.fillStyle = WHITE;
  ctx.textAlign = 'left';
  ctx.fillText(parte1, startX, 100);

  ctx.fillStyle = BALL;
  ctx.fillText(parte2, startX + w1, 100);

  // Tag "TORNEO" chico
  ctx.textAlign = 'center';
  ctx.font = '900 14px system-ui, sans-serif';
  ctx.fillStyle = BALL;
  ctx.fillText('T O R N E O   O F I C I A L', cx, 160);

  // Divider
  ctx.strokeStyle = 'rgba(216,246,70,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 220, 190); ctx.lineTo(cx + 220, 190); ctx.stroke();

  // Título del torneo
  ctx.font = '900 42px system-ui, sans-serif';
  ctx.fillStyle = WHITE;
  wrappedText(ctx, title.toUpperCase(), cx, 230, W - 120, 48, 2);

  // Categoría
  if (category) {
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillStyle = W60;
    ctx.fillText(category.toUpperCase(), cx, 300);
  }
}

// ==================== Grupos ====================

function drawGroups(ctx: CanvasRenderingContext2D, W: number, top: number, bottom: number, groups: GroupSummary[]) {
  ctx.font = '900 34px system-ui, sans-serif';
  ctx.fillStyle = BALL;
  ctx.textAlign = 'center';
  ctx.fillText('GRUPOS DEFINIDOS', W / 2, top);

  const areaTop = top + 60;
  const areaH = bottom - areaTop;
  const cols = groups.length <= 4 ? 2 : Math.min(4, Math.ceil(Math.sqrt(groups.length)));
  const rows = Math.ceil(groups.length / cols);
  const gap = 24;
  const marginX = 50;
  const cardW = (W - marginX * 2 - gap * (cols - 1)) / cols;
  const cardH = Math.min(420, (areaH - gap * (rows - 1)) / rows);

  groups.forEach((g, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = marginX + col * (cardW + gap);
    const y = areaTop + row * (cardH + gap);
    drawGroupCard(ctx, x, y, cardW, cardH, g);
  });
}

function drawGroupCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, g: GroupSummary) {
  // Card
  ctx.fillStyle = CARD;
  roundRect(ctx, x, y, w, h, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(216,246,70,0.4)';
  ctx.lineWidth = 2; ctx.stroke();

  // Header lima
  ctx.fillStyle = BALL;
  roundRect(ctx, x, y, w, 56, 16, { bottomLeft: 0, bottomRight: 0 });
  ctx.fill();

  // Etiqueta grande "A", "B", …
  ctx.fillStyle = 'rgba(10,15,26,0.15)';
  ctx.font = '900 90px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(g.label, x + 12, y + h / 2 + 20);

  // Texto header
  ctx.fillStyle = '#0A0F1A';
  ctx.font = '900 24px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`GRUPO ${g.label}`, x + w / 2, y + 28);

  // Miembros
  const listTop = y + 76;
  const listH = h - 86;
  const rowH = listH / Math.max(1, g.members.length);

  g.members.forEach((p, i) => {
    const yy = listTop + i * rowH;
    if (i > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 20, yy); ctx.lineTo(x + w - 20, yy); ctx.stroke();
    }
    // Bullet lima
    ctx.fillStyle = BALL;
    ctx.beginPath();
    ctx.arc(x + 28, yy + rowH / 2, 4, 0, Math.PI * 2);
    ctx.fill();

    // Nombres
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillStyle = WHITE;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const label = `${p.n1}   &   ${p.n2}`;
    ctx.fillText(truncateText(ctx, label, w - 60), x + 44, yy + rowH / 2);
  });
}

// ==================== Standings ====================

function drawStandings(ctx: CanvasRenderingContext2D, W: number, top: number, bottom: number, standings: StandingSummary[]) {
  ctx.font = '900 34px system-ui, sans-serif';
  ctx.fillStyle = BALL;
  ctx.textAlign = 'center';
  ctx.fillText('POSICIONES FINALES', W / 2, top);

  const areaTop = top + 60;
  const areaH = bottom - areaTop;
  const cols = standings.length <= 4 ? 2 : Math.min(4, Math.ceil(Math.sqrt(standings.length)));
  const rows = Math.ceil(standings.length / cols);
  const gap = 24;
  const marginX = 50;
  const cardW = (W - marginX * 2 - gap * (cols - 1)) / cols;
  const cardH = Math.min(440, (areaH - gap * (rows - 1)) / rows);

  standings.forEach((s, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = marginX + col * (cardW + gap);
    const y = areaTop + row * (cardH + gap);
    drawStandingCard(ctx, x, y, cardW, cardH, s);
  });
}

function drawStandingCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, s: StandingSummary) {
  ctx.fillStyle = CARD;
  roundRect(ctx, x, y, w, h, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(216,246,70,0.4)';
  ctx.lineWidth = 2; ctx.stroke();

  // Header lima
  ctx.fillStyle = BALL;
  roundRect(ctx, x, y, w, 50, 16, { bottomLeft: 0, bottomRight: 0 });
  ctx.fill();
  ctx.font = '900 22px system-ui, sans-serif';
  ctx.fillStyle = '#0A0F1A';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`GRUPO ${s.label}`, x + w / 2, y + 25);

  // Columnas headers
  const headerY = y + 74;
  ctx.font = '800 12px system-ui, sans-serif';
  ctx.fillStyle = W30;
  ctx.textAlign = 'left';
  ctx.fillText('#', x + 16, headerY);
  ctx.fillText('PAREJA', x + 44, headerY);
  ctx.textAlign = 'right';
  ctx.fillText('PJ', x + w - 130, headerY);
  ctx.fillText('DS', x + w - 80, headerY);
  ctx.fillText('PTS', x + w - 20, headerY);

  const rowsTop = headerY + 18;
  const rowH = (h - 96) / Math.max(1, s.rows.length);
  s.rows.forEach((r, i) => {
    const yy = rowsTop + i * rowH;
    const clasifica = i < 2;

    // Fondo clasificado
    if (clasifica) {
      ctx.fillStyle = 'rgba(216,246,70,0.12)';
      roundRect(ctx, x + 8, yy + 2, w - 16, rowH - 4, 8);
      ctx.fill();
    }

    // # posición
    ctx.font = '900 20px system-ui, sans-serif';
    ctx.fillStyle = clasifica ? BALL : W60;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${i + 1}`, x + 16, yy + rowH / 2);

    // Nombres
    ctx.font = clasifica ? '800 17px system-ui, sans-serif' : '700 16px system-ui, sans-serif';
    ctx.fillStyle = clasifica ? WHITE : W80;
    ctx.fillText(truncateText(ctx, `${r.pair.n1} & ${r.pair.n2}`, w - 190), x + 44, yy + rowH / 2);

    // Stats
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.fillStyle = W60;
    ctx.textAlign = 'right';
    ctx.fillText(`${r.pj}`, x + w - 130, yy + rowH / 2);
    ctx.fillText(`${r.ds >= 0 ? '+' : ''}${r.ds}`, x + w - 80, yy + rowH / 2);
    ctx.font = '900 20px system-ui, sans-serif';
    ctx.fillStyle = clasifica ? BALL : WHITE;
    ctx.fillText(`${r.pts}`, x + w - 20, yy + rowH / 2);
  });
}

// ==================== Ronda eliminatoria (individual) ====================

function drawRound(
  ctx: CanvasRenderingContext2D, W: number, top: number, bottom: number,
  roundLabel: string, matches: RoundMatch[],
  champion?: PairRow | null, runnerUp?: PairRow | null
) {
  // Título grande de la ronda
  ctx.font = '900 52px system-ui, sans-serif';
  ctx.fillStyle = BALL;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(roundLabel.toUpperCase(), W / 2, top + 20);

  // Sub-badge según estado
  const played = matches.filter(m => m.winner_id).length;
  const total = matches.length;
  const status = played === 0 ? 'CRUCES DEFINIDOS'
    : played === total ? 'RESULTADOS FINALES'
    : `${played}/${total} PARTIDOS DISPUTADOS`;
  ctx.font = '900 15px system-ui, sans-serif';
  ctx.fillStyle = W60;
  ctx.fillText(status, W / 2, top + 60);

  // Caso especial: FINAL con campeón — mostrar copa + campeón grande
  const isFinal = /final/i.test(roundLabel) && matches.length === 1;
  if (isFinal && champion) {
    drawFinalWithChampion(ctx, W, top + 100, bottom, matches[0], champion, runnerUp);
    return;
  }

  // Grid de partidos
  const areaTop = top + 100;
  const areaH = bottom - areaTop;
  const cols = matches.length === 1 ? 1 : matches.length <= 2 ? 1 : matches.length <= 4 ? 2 : 2;
  const rows = Math.ceil(matches.length / cols);
  const gap = 24;
  const marginX = matches.length === 1 ? 120 : 60;
  const cardW = (W - marginX * 2 - gap * (cols - 1)) / cols;
  const cardH = Math.min(180, (areaH - gap * (rows - 1)) / rows);

  matches.forEach((m, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = marginX + col * (cardW + gap);
    const y = areaTop + row * (cardH + gap);
    drawMatchCard(ctx, x, y, cardW, cardH, m, i + 1);
  });
}

function drawMatchCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, m: RoundMatch, num: number) {
  // Fondo
  ctx.fillStyle = CARD;
  roundRect(ctx, x, y, w, h, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(216,246,70,0.35)';
  ctx.lineWidth = 2; ctx.stroke();

  // Badge de número
  ctx.fillStyle = BALL;
  ctx.beginPath();
  ctx.arc(x + 26, y + 26, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = '900 20px system-ui, sans-serif';
  ctx.fillStyle = '#0A0F1A';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${num}`, x + 26, y + 26);

  // Score al centro (si hay)
  const hasScore = !!m.score;
  const scoreW = 140;
  const scoreX = x + w - scoreW - 16;

  if (hasScore) {
    ctx.fillStyle = BALL;
    roundRect(ctx, scoreX, y + h / 2 - 24, scoreW, 48, 8);
    ctx.fill();
    ctx.fillStyle = '#0A0F1A';
    ctx.font = '900 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(truncateText(ctx, m.score!, scoreW - 20), scoreX + scoreW / 2, y + h / 2);
  }

  // Nombres pareja 1 y 2
  const nameX = x + 56;
  const nameMaxW = (hasScore ? scoreX - nameX - 20 : w - nameX - 20);
  drawTeamLine(ctx, nameX, y + h * 0.30, nameMaxW, m.pair1, m.winner_id === m.pair1?.id, m.winner_id != null && !!m.pair1);
  drawSeparator(ctx, x + 56, y + h * 0.5, w - 76);
  drawTeamLine(ctx, nameX, y + h * 0.70, nameMaxW, m.pair2, m.winner_id === m.pair2?.id, m.winner_id != null && !!m.pair2);

  // VS al centro si NO hay resultado
  if (!hasScore) {
    ctx.font = '900 24px system-ui, sans-serif';
    ctx.fillStyle = W30;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VS', x + w - 30, y + h / 2);
  }
}

function drawTeamLine(ctx: CanvasRenderingContext2D, x: number, y: number, maxW: number, pair: PairRow | null | undefined, isWinner: boolean, decided: boolean) {
  const isLoser = decided && !isWinner;
  ctx.font = isWinner ? '900 22px system-ui, sans-serif' : '700 20px system-ui, sans-serif';
  ctx.fillStyle = isWinner ? BALL : isLoser ? W30 : WHITE;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const label = pair ? `${pair.n1} & ${pair.n2}` : '— A definir —';
  ctx.fillText(truncateText(ctx, label, maxW), x, y);

  // Check ganador
  if (isWinner) {
    ctx.font = '900 22px system-ui, sans-serif';
    ctx.fillStyle = BALL;
    ctx.textAlign = 'right';
    // (dibujado a la derecha si hay espacio)
  }
}

function drawSeparator(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke();
}

function drawFinalWithChampion(
  ctx: CanvasRenderingContext2D, W: number, top: number, bottom: number,
  finalMatch: RoundMatch, champion: PairRow, runnerUp?: PairRow | null
) {
  const cx = W / 2;
  // Copa
  drawTrophy(ctx, cx, top + 200, 240);

  // Label CAMPEONES
  ctx.font = '900 20px system-ui, sans-serif';
  ctx.fillStyle = BALL;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★ CAMPEONES ★', cx, top + 380);

  // Nombres campeón
  ctx.font = '900 38px system-ui, sans-serif';
  ctx.fillStyle = WHITE;
  wrappedText(ctx, `${champion.n1} & ${champion.n2}`, cx, top + 425, W - 120, 44, 2);

  // Score final
  if (finalMatch.score) {
    ctx.fillStyle = BALL;
    const scoreLabel = finalMatch.score;
    ctx.font = '900 24px system-ui, sans-serif';
    const w = ctx.measureText(scoreLabel).width + 40;
    roundRect(ctx, cx - w / 2, top + 490, w, 46, 10);
    ctx.fill();
    ctx.fillStyle = '#0A0F1A';
    ctx.fillText(scoreLabel, cx, top + 513);
  }

  // Sub-campeón
  if (runnerUp) {
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillStyle = W60;
    ctx.textAlign = 'center';
    ctx.fillText(`Sub-campeones: ${runnerUp.n1} & ${runnerUp.n2}`, cx, top + 560);
  }
}

// ==================== Auspiciantes ====================

function drawSponsors(
  ctx: CanvasRenderingContext2D, W: number, H: number, footerH: number,
  sponsors: Sponsor[], imgs: (HTMLImageElement | null)[]
) {
  const baseY = H - footerH;

  // Título AUSPICIAN
  if (sponsors.length > 0) {
    ctx.font = '900 14px system-ui, sans-serif';
    ctx.fillStyle = BALL;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('A U S P I C I A N', W / 2, baseY + 22);

    // Grid de logos
    const validImgs = imgs.map((im, i) => ({ im, sponsor: sponsors[i] })).filter(x => x.im);
    if (validImgs.length > 0) {
      const logoAreaTop = baseY + 48;
      const logoAreaBottom = H - 30;
      const logoH = 80;
      const maxLogos = 6;
      const shown = validImgs.slice(0, maxLogos);
      const gap = 24;
      const totalMaxW = W - 80;
      const logoW = Math.min(160, (totalMaxW - gap * (shown.length - 1)) / shown.length);
      const totalW = shown.length * logoW + (shown.length - 1) * gap;
      let cx = (W - totalW) / 2;
      const cy = (logoAreaTop + logoAreaBottom) / 2 - logoH / 2;

      shown.forEach(({ im }) => {
        if (!im) return;
        // Fit dentro de logoW x logoH manteniendo ratio
        const ratio = im.width / im.height;
        let dw = logoW, dh = logoW / ratio;
        if (dh > logoH) { dh = logoH; dw = logoH * ratio; }
        const dx = cx + (logoW - dw) / 2;
        const dy = cy + (logoH - dh) / 2;
        // Fondo blanco redondeado para logos que sean transparentes o oscuros
        ctx.fillStyle = '#FFFFFF';
        roundRect(ctx, cx - 4, cy - 4, logoW + 8, logoH + 8, 8);
        ctx.fill();
        ctx.drawImage(im, dx, dy, dw, dh);
        cx += logoW + gap;
      });
    }
  }

  // Footer legal
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.fillStyle = W60;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Generado con narvoQ · narvoq.vercel.app', W / 2, H - 15);
}

// ==================== Copa ====================

function drawTrophy(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const scale = size / 200;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Base
  ctx.fillStyle = '#8B6914';
  roundRect(ctx, -60, 70, 120, 22, 4); ctx.fill();
  ctx.fillStyle = '#5A4409';
  roundRect(ctx, -50, 58, 100, 18, 4); ctx.fill();

  // Copa (gradiente plata)
  const grad = ctx.createLinearGradient(-50, -80, 50, 60);
  grad.addColorStop(0, '#F8F8F8');
  grad.addColorStop(0.5, '#C8C8C8');
  grad.addColorStop(1, '#8A8A8A');
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.moveTo(-52, -70);
  ctx.bezierCurveTo(-52, -20, -40, 32, 0, 32);
  ctx.bezierCurveTo(40, 32, 52, -20, 52, -70);
  ctx.lineTo(52, -85);
  ctx.lineTo(-52, -85);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Boca de la copa
  ctx.fillStyle = '#D8D8D8';
  ctx.beginPath();
  ctx.ellipse(0, -85, 52, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Tapa/perilla
  ctx.beginPath();
  ctx.arc(0, -110, 12, 0, Math.PI * 2);
  ctx.fillStyle = '#D8D8D8';
  ctx.fill();
  ctx.stroke();

  // Asas
  ctx.strokeStyle = '#A0A0A0';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(-62, -40, 22, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(62, -40, 22, Math.PI / 2, -Math.PI / 2, true);
  ctx.stroke();

  // Cintas celeste/blanco Argentina
  const drawCinta = (side: -1 | 1) => {
    const s = side;
    ctx.strokeStyle = '#75AADB';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(30 * s, 32);
    ctx.bezierCurveTo(40 * s, 70, 30 * s, 115, 55 * s, 140);
    ctx.stroke();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(30 * s + 4 * s, 40);
    ctx.bezierCurveTo(38 * s, 75, 26 * s, 118, 50 * s, 145);
    ctx.stroke();

    ctx.strokeStyle = '#75AADB';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(30 * s + 8 * s, 48);
    ctx.bezierCurveTo(36 * s, 80, 22 * s, 122, 44 * s, 150);
    ctx.stroke();
  };
  drawCinta(-1); drawCinta(1);

  // Pelotitas de pádel
  ctx.fillStyle = BALL;
  ctx.beginPath(); ctx.arc(-85, 95, 10, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = BALL_DARK; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-95, 95); ctx.quadraticCurveTo(-85, 90, -75, 95); ctx.stroke();

  ctx.beginPath(); ctx.arc(85, 95, 10, 0, Math.PI * 2); ctx.fillStyle = BALL; ctx.fill();
  ctx.beginPath(); ctx.moveTo(75, 95); ctx.quadraticCurveTo(85, 90, 95, 95); ctx.stroke();

  ctx.restore();
}

// ==================== Utilidades ====================

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('load'));
    img.src = url;
  });
}

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
      lines.push(cur); cur = w;
    } else cur = test;
  });
  if (cur) lines.push(cur);
  const shown = lines.slice(0, maxLines);
  const startY = y + lineH / 2;
  shown.forEach((ln, i) => { ctx.fillText(ln, x, startY + i * lineH); });
}
