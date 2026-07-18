'use client';
import { useState } from 'react';

// Generador de posters compartibles del torneo (Canvas puro, sin deps).
// v3 — logo NarvoQ real, isotipo por instancia, avatares por jugador,
// formato de par en 2 filas con número unificador.

export type Player = { name: string; avatar_url?: string | null };
export type PairRow = { id: string; p1: Player; p2: Player };
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
      roundLabel: string;
      matches: RoundMatch[];
      champion?: PairRow | null;
      runnerUp?: PairRow | null;
      sponsors?: Sponsor[];
      podiumChampionPhoto?: string | null;    // foto real del podio de los campeones
      podiumRunnerupPhoto?: string | null;    // foto real del podio de los sub-campeones
    };

// Paleta NarvoQ
const BALL = '#D8F646';
const BALL_DARK = '#8FA82C';
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
      // Recopilar todas las URLs a precargar
      const sponsors = ('sponsors' in input && input.sponsors) ? input.sponsors : [];
      const avatarUrls = collectAvatarUrls(input);

      // URLs opcionales de fotos del podio (si el modo es 'round' final)
      const podium = ('mode' in input && input.mode === 'round') ? {
        champion: (input as any).podiumChampionPhoto ?? null,
        runnerup: (input as any).podiumRunnerupPhoto ?? null
      } : { champion: null, runnerup: null };

      // Precargar todo en paralelo
      const [logoImg, isotipoImg, copaImg, sponsorImgs, avatarMap, podiumChamp, podiumRunner] = await Promise.all([
        loadImageSafe('/brand/logo.png'),
        loadImageSafe('/brand/isotipo.png'),
        loadImageSafe('/brand/copa.png'),               // opcional — si no existe, usa la copa dibujada
        Promise.all(sponsors.map(s => loadImageSafe(s.logo_url))),
        loadAvatars(avatarUrls),
        podium.champion ? loadImageSafe(podium.champion) : Promise.resolve(null),
        podium.runnerup ? loadImageSafe(podium.runnerup) : Promise.resolve(null)
      ]);

      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1600;
      const ctx = canvas.getContext('2d')!;
      drawPoster(ctx, canvas.width, canvas.height, input, {
        logo: logoImg, isotipo: isotipoImg, copa: copaImg,
        sponsors: sponsorImgs, avatars: avatarMap,
        podiumChampion: podiumChamp, podiumRunnerup: podiumRunner
      });

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

// ==================== Precarga ====================

function collectAvatarUrls(input: PosterInput): string[] {
  const urls: string[] = [];
  const pushPair = (pair?: PairRow | null) => {
    if (!pair) return;
    if (pair.p1.avatar_url) urls.push(pair.p1.avatar_url);
    if (pair.p2.avatar_url) urls.push(pair.p2.avatar_url);
  };
  if (input.mode === 'groups') input.groups.forEach(g => g.members.forEach(pushPair));
  else if (input.mode === 'standings') input.standings.forEach(s => s.rows.forEach(r => pushPair(r.pair)));
  else {
    input.matches.forEach(m => { pushPair(m.pair1); pushPair(m.pair2); });
    if (input.champion) pushPair(input.champion);
    if (input.runnerUp) pushPair(input.runnerUp);
  }
  return Array.from(new Set(urls));
}

async function loadAvatars(urls: string[]): Promise<Map<string, HTMLImageElement>> {
  const results = await Promise.all(urls.map(u => loadImageSafe(u).then(im => [u, im] as const)));
  const map = new Map<string, HTMLImageElement>();
  results.forEach(([u, im]) => { if (im) map.set(u, im); });
  return map;
}

// ==================== Composición general ====================

interface Assets {
  logo: HTMLImageElement | null;
  isotipo: HTMLImageElement | null;
  copa: HTMLImageElement | null;
  sponsors: (HTMLImageElement | null)[];
  avatars: Map<string, HTMLImageElement>;
  podiumChampion: HTMLImageElement | null;
  podiumRunnerup: HTMLImageElement | null;
}

function drawPoster(ctx: CanvasRenderingContext2D, W: number, H: number, input: PosterInput, assets: Assets) {
  // Fondo con gradiente
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0F1524');
  bg.addColorStop(1, '#050810');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Grid muy sutil
  ctx.strokeStyle = 'rgba(216,246,70,0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }

  // Cinta lima superior derecha
  ctx.fillStyle = BALL;
  ctx.beginPath();
  ctx.moveTo(W, 0); ctx.lineTo(W, 90); ctx.lineTo(W - 360, 0);
  ctx.closePath(); ctx.fill();

  // Franja pie
  const sponsorsCount = assets.sponsors.filter(Boolean).length;
  const footerH = sponsorsCount > 0 ? 200 : 100;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, H - footerH, W, footerH);
  ctx.strokeStyle = BALL;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, H - footerH); ctx.lineTo(W, H - footerH); ctx.stroke();

  // Header
  drawHeader(ctx, W, input.tournamentName, input.category, assets.logo);

  const contentTop = 320;
  const contentBottom = H - footerH - 40;

  if (input.mode === 'groups') drawGroups(ctx, W, contentTop, contentBottom, input.groups, assets);
  else if (input.mode === 'standings') drawStandings(ctx, W, contentTop, contentBottom, input.standings, assets);
  else drawRound(ctx, W, contentTop, contentBottom, input.roundLabel, input.matches, input.champion, input.runnerUp, assets);

  drawSponsors(ctx, W, H, footerH, input.sponsors ?? [], assets.sponsors);
}

// ==================== Header ====================

function drawHeader(ctx: CanvasRenderingContext2D, W: number, title: string, category: string | undefined, logo: HTMLImageElement | null) {
  const cx = W / 2;

  // Logo NarvoQ real (arriba del todo, centrado)
  if (logo) {
    const targetH = 90;
    const ratio = logo.width / logo.height;
    const targetW = Math.min(400, targetH * ratio);
    ctx.save();
    // mixBlendMode-like via drawImage. Como Canvas soporta globalCompositeOperation="screen":
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(logo, cx - targetW / 2, 30, targetW, targetH);
    ctx.restore();
  } else {
    // Fallback texto
    ctx.font = '900 78px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = WHITE; ctx.fillText('narvo', cx - 40, 75);
    ctx.fillStyle = BALL; ctx.fillText('Q', cx + 90, 75);
  }

  // Tag TORNEO OFICIAL
  ctx.font = '900 13px system-ui, sans-serif';
  ctx.fillStyle = BALL;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('T O R N E O   O F I C I A L', cx, 148);

  // Divider
  ctx.strokeStyle = 'rgba(216,246,70,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - 220, 170); ctx.lineTo(cx + 220, 170); ctx.stroke();

  // Título torneo
  ctx.font = '900 42px system-ui, sans-serif';
  ctx.fillStyle = WHITE;
  wrappedText(ctx, title.toUpperCase(), cx, 210, W - 120, 46, 2);

  // Categoría
  if (category) {
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillStyle = W60;
    ctx.fillText(category.toUpperCase(), cx, 285);
  }
}

// ==================== Instance title con isotipo ====================

function drawInstanceTitle(ctx: CanvasRenderingContext2D, cx: number, y: number, text: string, isotipo: HTMLImageElement | null) {
  ctx.font = '900 46px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  const textW = ctx.measureText(text.toUpperCase()).width;
  const iconSize = 50;
  const gap = 20;
  const totalW = iconSize + gap + textW;
  const startX = cx - totalW / 2;

  // Isotipo
  if (isotipo) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(isotipo, startX, y - iconSize / 2, iconSize, iconSize);
    ctx.restore();
  } else {
    // Bullet lima fallback
    ctx.fillStyle = BALL;
    ctx.beginPath();
    ctx.arc(startX + iconSize / 2, y, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  // Texto
  ctx.fillStyle = BALL;
  ctx.textAlign = 'left';
  ctx.fillText(text.toUpperCase(), startX + iconSize + gap, y);
}

// ==================== Grupos ====================

function drawGroups(ctx: CanvasRenderingContext2D, W: number, top: number, bottom: number, groups: GroupSummary[], assets: Assets) {
  drawInstanceTitle(ctx, W / 2, top + 20, 'Grupos Definidos', assets.isotipo);

  const areaTop = top + 70;
  const areaH = bottom - areaTop;
  const cols = groups.length <= 4 ? 2 : Math.min(4, Math.ceil(Math.sqrt(groups.length)));
  const rows = Math.ceil(groups.length / cols);
  const gap = 24;
  const marginX = 50;
  const cardW = (W - marginX * 2 - gap * (cols - 1)) / cols;
  const cardH = Math.min(440, (areaH - gap * (rows - 1)) / rows);

  groups.forEach((g, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = marginX + col * (cardW + gap);
    const y = areaTop + row * (cardH + gap);
    drawGroupCard(ctx, x, y, cardW, cardH, g, assets);
  });
}

function drawGroupCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, g: GroupSummary, assets: Assets) {
  ctx.fillStyle = CARD;
  roundRect(ctx, x, y, w, h, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(216,246,70,0.4)';
  ctx.lineWidth = 2; ctx.stroke();

  // Header lima
  ctx.fillStyle = BALL;
  roundRect(ctx, x, y, w, 56, 16, { bottomLeft: 0, bottomRight: 0 });
  ctx.fill();

  // Letra grande fantasma
  ctx.fillStyle = 'rgba(10,15,26,0.15)';
  ctx.font = '900 90px system-ui, sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(g.label, x + 12, y + h / 2 + 20);

  // Header text
  ctx.fillStyle = '#0A0F1A';
  ctx.font = '900 24px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`GRUPO ${g.label}`, x + w / 2, y + 28);

  // Miembros (formato 2 filas + número al medio)
  const listTop = y + 72;
  const listH = h - 82;
  const rowH = listH / Math.max(1, g.members.length);

  g.members.forEach((p, i) => {
    const yy = listTop + i * rowH;
    if (i > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 20, yy); ctx.lineTo(x + w - 20, yy); ctx.stroke();
    }
    drawPairEntry(ctx, x + 12, yy, w - 24, rowH, p, i + 1, false, assets);
  });
}

// Dibuja una pareja con:
//  [num]  [avatar1] Nombre1 &
//         [avatar2] Nombre2
// El número aparece centrado verticalmente unificando ambas filas.
// `variant` cambia el sizing:
//   - 'default': para grupos → avatares grandes, texto grande
//   - 'compact': para posiciones → avatares chicos, texto chico (entra nombre completo)
function drawPairEntry(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  pair: PairRow, num: number | null,
  highlight: boolean,
  assets: Assets,
  variant: 'default' | 'compact' = 'default'
) {
  const rowGap = 4;
  const compact = variant === 'compact';
  const numW = num ? (compact ? 26 : 46) : 0;
  const numX = x + 2;
  const contentX = x + numW + 4;
  const maxAvatar = compact ? 22 : 42;
  const avatarSize = Math.min(maxAvatar, (h - rowGap) / 2 - 4);

  // Número al medio (unificando ambas filas)
  if (num !== null) {
    ctx.font = `900 ${compact ? 22 : 32}px system-ui, sans-serif`;
    ctx.fillStyle = highlight ? BALL : W60;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${num}`, numX + numW / 2, y + h / 2);
  }

  const player1Y = y + h / 2 - avatarSize / 2 - rowGap / 2;
  const player2Y = y + h / 2 + avatarSize / 2 + rowGap / 2;

  drawPlayerLine(ctx, contentX, player1Y, w - numW - 12, avatarSize, pair.p1, highlight, '&', assets, compact);
  drawPlayerLine(ctx, contentX, player2Y, w - numW - 12, avatarSize, pair.p2, highlight, null, assets, compact);
}

function drawPlayerLine(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, maxW: number, avatarSize: number,
  player: Player,
  highlight: boolean,
  suffix: string | null,
  assets: Assets,
  compact: boolean = false
) {
  // Avatar
  drawAvatar(ctx, x + avatarSize / 2, y, avatarSize / 2, player, assets);

  // Nombre
  const nameSize = compact ? (highlight ? 13 : 12) : (highlight ? 22 : 20);
  ctx.font = `${highlight ? 900 : 700} ${nameSize}px system-ui, sans-serif`;
  ctx.fillStyle = highlight ? BALL : WHITE;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const nameX = x + avatarSize + (compact ? 6 : 8);
  const label = suffix ? `${player.name} ${suffix}` : player.name;
  ctx.fillText(truncateText(ctx, label, maxW - avatarSize - (compact ? 8 : 14)), nameX, y);
}

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  player: Player,
  assets: Assets
) {
  const img = player.avatar_url ? assets.avatars.get(player.avatar_url) : null;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (img) {
    // Fit cover
    const size = r * 2;
    ctx.drawImage(img, cx - r, cy - r, size, size);
  } else {
    // Fallback: círculo grafito con inicial lima
    ctx.fillStyle = '#2A2E36';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = BALL;
    ctx.font = `900 ${Math.round(r * 1.1)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((player.name?.[0] ?? '?').toUpperCase(), cx, cy);
  }
  ctx.restore();
  // Ring
  ctx.strokeStyle = 'rgba(216,246,70,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

// ==================== Standings ====================

function drawStandings(ctx: CanvasRenderingContext2D, W: number, top: number, bottom: number, standings: StandingSummary[], assets: Assets) {
  drawInstanceTitle(ctx, W / 2, top + 20, 'Posiciones Finales', assets.isotipo);

  const areaTop = top + 70;
  const areaH = bottom - areaTop;
  const cols = standings.length <= 4 ? 2 : Math.min(4, Math.ceil(Math.sqrt(standings.length)));
  const rows = Math.ceil(standings.length / cols);
  const gap = 24;
  const marginX = 50;
  const cardW = (W - marginX * 2 - gap * (cols - 1)) / cols;
  const cardH = Math.min(480, (areaH - gap * (rows - 1)) / rows);

  standings.forEach((s, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = marginX + col * (cardW + gap);
    const y = areaTop + row * (cardH + gap);
    drawStandingCard(ctx, x, y, cardW, cardH, s, assets);
  });
}

function drawStandingCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, s: StandingSummary, assets: Assets) {
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
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`GRUPO ${s.label}`, x + w / 2, y + 25);

  // Stats de la derecha (PJ / DS / PTS) — más compactado
  const statsW = 96;
  const statsX = x + w - statsW;

  // Headers de columnas stats
  const headerY = y + 68;
  ctx.font = '800 10px system-ui, sans-serif';
  ctx.fillStyle = W30;
  ctx.textAlign = 'center';
  ctx.fillText('PJ', statsX + 14, headerY);
  ctx.fillText('DS', statsX + 44, headerY);
  ctx.fillText('PTS', statsX + 80, headerY);

  const rowsTop = headerY + 18;
  const rowH = (h - 92) / Math.max(1, s.rows.length);

  s.rows.forEach((r, i) => {
    const yy = rowsTop + i * rowH;
    const clasifica = i < 2;

    // Fondo clasificado
    if (clasifica) {
      ctx.fillStyle = 'rgba(216,246,70,0.10)';
      roundRect(ctx, x + 6, yy + 2, w - 12, rowH - 4, 10);
      ctx.fill();
    }

    // Pareja con formato 2 filas + número (variant compact para que entren nombres completos)
    drawPairEntry(ctx, x + 2, yy, w - statsW - 4, rowH, r.pair, i + 1, clasifica, assets, 'compact');

    // Stats
    ctx.font = '800 13px system-ui, sans-serif';
    ctx.fillStyle = clasifica ? WHITE : W60;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${r.pj}`, statsX + 14, yy + rowH / 2);
    ctx.fillText(`${r.ds >= 0 ? '+' : ''}${r.ds}`, statsX + 44, yy + rowH / 2);
    ctx.font = '900 20px system-ui, sans-serif';
    ctx.fillStyle = clasifica ? BALL : WHITE;
    ctx.fillText(`${r.pts}`, statsX + 80, yy + rowH / 2);
  });
}

// ==================== Ronda eliminatoria ====================

function drawRound(
  ctx: CanvasRenderingContext2D, W: number, top: number, bottom: number,
  roundLabel: string, matches: RoundMatch[],
  champion: PairRow | null | undefined, runnerUp: PairRow | null | undefined,
  assets: Assets
) {
  drawInstanceTitle(ctx, W / 2, top + 20, roundLabel, assets.isotipo);

  // Sub-badge con estado
  const played = matches.filter(m => m.winner_id).length;
  const total = matches.length;
  const status = played === 0 ? 'CRUCES DEFINIDOS'
    : played === total ? 'RESULTADOS FINALES'
    : `${played}/${total} PARTIDOS DISPUTADOS`;
  ctx.font = '900 14px system-ui, sans-serif';
  ctx.fillStyle = W60;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(status, W / 2, top + 70);

  // FINAL con campeón → poster distinto
  const isFinal = /final/i.test(roundLabel) && matches.length === 1;
  if (isFinal && champion) {
    drawFinalWithChampion(ctx, W, top + 110, bottom, matches[0], champion, runnerUp, assets);
    return;
  }

  // Grid de partidos
  const areaTop = top + 110;
  const areaH = bottom - areaTop;
  const cols = matches.length === 1 ? 1 : matches.length <= 3 ? 1 : matches.length <= 6 ? 2 : 2;
  const rows = Math.ceil(matches.length / cols);
  const gap = 20;
  const marginX = matches.length === 1 ? 120 : 50;
  const cardW = (W - marginX * 2 - gap * (cols - 1)) / cols;
  const cardH = Math.min(230, (areaH - gap * (rows - 1)) / rows);

  matches.forEach((m, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = marginX + col * (cardW + gap);
    const y = areaTop + row * (cardH + gap);
    drawMatchCard(ctx, x, y, cardW, cardH, m, i + 1, assets);
  });
}

function drawMatchCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, m: RoundMatch, num: number, assets: Assets) {
  // Fondo
  ctx.fillStyle = CARD;
  roundRect(ctx, x, y, w, h, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(216,246,70,0.35)';
  ctx.lineWidth = 2; ctx.stroke();

  // Número match en badge
  ctx.fillStyle = BALL;
  roundRect(ctx, x + 12, y + 12, 44, 24, 6);
  ctx.fill();
  ctx.font = '900 14px system-ui, sans-serif';
  ctx.fillStyle = '#0A0F1A';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`#${num}`, x + 34, y + 24);

  const hasScore = !!m.score;
  const scoreW = 130;
  const scoreX = x + w - scoreW - 14;
  const contentX = x + 12;
  const contentW = (hasScore ? scoreX - contentX - 12 : w - 24);
  const contentTop = y + 44;
  const contentH = h - 50;
  const teamH = (contentH - 8) / 2;

  // Team 1
  drawTeamInMatch(ctx, contentX, contentTop, contentW, teamH, m.pair1, m.winner_id === m.pair1?.id, m.winner_id != null, assets);
  // Separador
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 12, contentTop + teamH + 4); ctx.lineTo(x + w - 12, contentTop + teamH + 4); ctx.stroke();
  // "VS" chiquito
  if (!hasScore) {
    ctx.font = '900 12px system-ui, sans-serif';
    ctx.fillStyle = W30;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('VS', x + w - 60, contentTop + teamH + 4);
  }
  // Team 2
  drawTeamInMatch(ctx, contentX, contentTop + teamH + 8, contentW, teamH, m.pair2, m.winner_id === m.pair2?.id, m.winner_id != null, assets);

  // Score (pastilla lima)
  if (hasScore) {
    ctx.fillStyle = BALL;
    roundRect(ctx, scoreX, y + h / 2 - 26, scoreW, 52, 10);
    ctx.fill();
    ctx.fillStyle = '#0A0F1A';
    ctx.font = '900 22px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(truncateText(ctx, m.score!, scoreW - 20), scoreX + scoreW / 2, y + h / 2);
  }
}

function drawTeamInMatch(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  pair: PairRow | null | undefined,
  isWinner: boolean, decided: boolean,
  assets: Assets
) {
  if (!pair) {
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.fillStyle = W30;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('— A definir —', x + 4, y + h / 2);
    return;
  }
  const isLoser = decided && !isWinner;
  const avatarSize = Math.min(50, h - 8);
  const av1x = x + avatarSize / 2 + 4;
  const av2x = av1x + avatarSize - 8;   // ligeramente superpuestos (-space-x)
  // Avatares (más grandes)
  drawAvatar(ctx, av1x, y + h / 2, avatarSize / 2, pair.p1, assets);
  drawAvatar(ctx, av2x, y + h / 2, avatarSize / 2, pair.p2, assets);

  // Nombres
  ctx.font = isWinner ? '900 22px system-ui, sans-serif' : '700 20px system-ui, sans-serif';
  ctx.fillStyle = isWinner ? BALL : isLoser ? W30 : WHITE;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const nameX = av2x + avatarSize / 2 + 14;
  const nameW = w - (nameX - x) - 8;
  ctx.fillText(truncateText(ctx, `${pair.p1.name}  &  ${pair.p2.name}`, nameW), nameX, y + h / 2);
}

function drawFinalWithChampion(
  ctx: CanvasRenderingContext2D, W: number, top: number, bottom: number,
  finalMatch: RoundMatch, champion: PairRow, runnerUp: PairRow | null | undefined, assets: Assets
) {
  const cx = W / 2;

  // Copa (más chica, arriba)
  drawTrophy(ctx, cx, top + 110, 170, assets.copa);

  // Score
  if (finalMatch.score) {
    ctx.font = '900 24px system-ui, sans-serif';
    const scoreW = ctx.measureText(finalMatch.score).width + 60;
    ctx.fillStyle = BALL;
    roundRect(ctx, cx - scoreW / 2, top + 220, scoreW, 48, 12);
    ctx.fill();
    ctx.fillStyle = '#0A0F1A';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(finalMatch.score, cx, top + 244);
  }

  // Radio unificado — campeones y sub-campeones al MISMO tamaño
  const AVR = 55;
  const GAP = 24;

  // ---------- CAMPEONES ----------
  const champLabelY = top + 305;
  ctx.font = '900 22px system-ui, sans-serif';
  ctx.fillStyle = BALL;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('★  C A M P E O N E S  ★', cx, champLabelY);

  const champAvY = champLabelY + 80;
  // Si hay FOTO DEL PODIO, la usamos en vez de los 2 avatares
  if (assets.podiumChampion) {
    drawPodiumPhoto(ctx, cx, champAvY, 220, 140, assets.podiumChampion);
  } else {
    drawAvatar(ctx, cx - AVR - GAP / 2, champAvY, AVR, champion.p1, assets);
    drawAvatar(ctx, cx + AVR + GAP / 2, champAvY, AVR, champion.p2, assets);
    ctx.font = '900 34px system-ui, sans-serif';
    ctx.fillStyle = BALL;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('&', cx, champAvY);
  }
  // Nombres campeones
  ctx.font = '900 26px system-ui, sans-serif';
  ctx.fillStyle = WHITE;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const champNameY = champAvY + (assets.podiumChampion ? 100 : AVR + 30);
  ctx.fillText(truncateText(ctx, `${champion.p1.name}  &  ${champion.p2.name}`, W - 100), cx, champNameY);

  // ---------- SUB-CAMPEONES ----------
  if (runnerUp) {
    const subLabelY = champNameY + 60;
    ctx.font = '900 22px system-ui, sans-serif';
    ctx.fillStyle = W60;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('S U B - C A M P E O N E S', cx, subLabelY);

    const subAvY = subLabelY + 80;
    if (assets.podiumRunnerup) {
      drawPodiumPhoto(ctx, cx, subAvY, 220, 140, assets.podiumRunnerup);
    } else {
      drawAvatar(ctx, cx - AVR - GAP / 2, subAvY, AVR, runnerUp.p1, assets);
      drawAvatar(ctx, cx + AVR + GAP / 2, subAvY, AVR, runnerUp.p2, assets);
      ctx.font = '900 34px system-ui, sans-serif';
      ctx.fillStyle = BALL;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('&', cx, subAvY);
    }
    // Nombres sub-campeones (MISMO tamaño que campeones)
    ctx.font = '900 26px system-ui, sans-serif';
    ctx.fillStyle = W80;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const subNameY = subAvY + (assets.podiumRunnerup ? 100 : AVR + 30);
    ctx.fillText(truncateText(ctx, `${runnerUp.p1.name}  &  ${runnerUp.p2.name}`, W - 100), cx, subNameY);
  }
}

// Foto rectangular del podio con máscara redondeada y ring lima
function drawPodiumPhoto(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, w: number, h: number,
  img: HTMLImageElement
) {
  const x = cx - w / 2;
  const y = cy - h / 2;
  ctx.save();
  roundRect(ctx, x, y, w, h, 14);
  ctx.clip();
  // Cover fit
  const ratio = Math.max(w / img.width, h / img.height);
  const dw = img.width * ratio, dh = img.height * ratio;
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  ctx.restore();
  ctx.strokeStyle = BALL;
  ctx.lineWidth = 3;
  roundRect(ctx, x, y, w, h, 14);
  ctx.stroke();
}

// ==================== Auspiciantes ====================

function drawSponsors(
  ctx: CanvasRenderingContext2D, W: number, H: number, footerH: number,
  sponsors: Sponsor[], imgs: (HTMLImageElement | null)[]
) {
  const baseY = H - footerH;

  if (sponsors.length > 0) {
    ctx.font = '900 14px system-ui, sans-serif';
    ctx.fillStyle = BALL;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('A U S P I C I A N', W / 2, baseY + 26);

    const validImgs = imgs.map((im, i) => ({ im, sponsor: sponsors[i] })).filter(x => x.im);
    if (validImgs.length > 0) {
      const logoAreaTop = baseY + 56;
      const logoAreaBottom = H - 40;
      const logoH = 90;
      const maxLogos = 6;
      const shown = validImgs.slice(0, maxLogos);
      const gap = 24;
      const totalMaxW = W - 80;
      const logoW = Math.min(170, (totalMaxW - gap * (shown.length - 1)) / shown.length);
      const totalW = shown.length * logoW + (shown.length - 1) * gap;
      let cxLogo = (W - totalW) / 2;
      const cy = (logoAreaTop + logoAreaBottom) / 2 - logoH / 2;

      shown.forEach(({ im }) => {
        if (!im) return;
        // Fondo blanco
        ctx.fillStyle = '#FFFFFF';
        roundRect(ctx, cxLogo - 6, cy - 6, logoW + 12, logoH + 12, 8);
        ctx.fill();
        // Fit ratio
        const ratio = im.width / im.height;
        let dw = logoW, dh = logoW / ratio;
        if (dh > logoH) { dh = logoH; dw = logoH * ratio; }
        const dx = cxLogo + (logoW - dw) / 2;
        const dy = cy + (logoH - dh) / 2;
        ctx.drawImage(im, dx, dy, dw, dh);
        cxLogo += logoW + gap;
      });
    }
  }

  // Footer
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.fillStyle = W60;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Generado con narvoQ · narvoq.vercel.app', W / 2, H - 15);
}

// ==================== Copa ====================

function drawTrophy(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, customImg?: HTMLImageElement | null) {
  // Si hay una copa custom cargada, la usamos y salimos.
  if (customImg) {
    const ratio = customImg.width / customImg.height;
    let dh = size, dw = size * ratio;
    if (dw > size * 1.4) { dw = size * 1.4; dh = dw / ratio; }
    ctx.drawImage(customImg, cx - dw / 2, cy - dh / 2, dw, dh);
    return;
  }
  const scale = size / 200;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  ctx.fillStyle = '#8B6914';
  roundRect(ctx, -60, 70, 120, 22, 4); ctx.fill();
  ctx.fillStyle = '#5A4409';
  roundRect(ctx, -50, 58, 100, 18, 4); ctx.fill();

  const grad = ctx.createLinearGradient(-50, -80, 50, 60);
  grad.addColorStop(0, '#F8F8F8');
  grad.addColorStop(0.5, '#C8C8C8');
  grad.addColorStop(1, '#8A8A8A');
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.moveTo(-52, -70);
  ctx.bezierCurveTo(-52, -20, -40, 32, 0, 32);
  ctx.bezierCurveTo(40, 32, 52, -20, 52, -70);
  ctx.lineTo(52, -85); ctx.lineTo(-52, -85);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.stroke();

  ctx.fillStyle = '#D8D8D8';
  ctx.beginPath();
  ctx.ellipse(0, -85, 52, 12, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, -110, 12, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  ctx.strokeStyle = '#A0A0A0';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(-62, -40, 22, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(62, -40, 22, Math.PI / 2, -Math.PI / 2, true);
  ctx.stroke();

  const drawCinta = (side: -1 | 1) => {
    ctx.strokeStyle = '#75AADB'; ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(30 * side, 32);
    ctx.bezierCurveTo(40 * side, 70, 30 * side, 115, 55 * side, 140);
    ctx.stroke();
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(30 * side + 4 * side, 40);
    ctx.bezierCurveTo(38 * side, 75, 26 * side, 118, 50 * side, 145);
    ctx.stroke();
    ctx.strokeStyle = '#75AADB'; ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(30 * side + 8 * side, 48);
    ctx.bezierCurveTo(36 * side, 80, 22 * side, 122, 44 * side, 150);
    ctx.stroke();
  };
  drawCinta(-1); drawCinta(1);

  ctx.fillStyle = BALL;
  ctx.beginPath(); ctx.arc(-85, 95, 10, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = BALL_DARK; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-95, 95); ctx.quadraticCurveTo(-85, 90, -75, 95); ctx.stroke();
  ctx.beginPath(); ctx.arc(85, 95, 10, 0, Math.PI * 2); ctx.fillStyle = BALL; ctx.fill();
  ctx.beginPath(); ctx.moveTo(75, 95); ctx.quadraticCurveTo(85, 90, 95, 95); ctx.stroke();

  ctx.restore();
}

// ==================== Utilidades ====================

function loadImageSafe(url: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
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
