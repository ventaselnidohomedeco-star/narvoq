'use client';

/**
 * Placas específicas de PERFIL DE JUGADOR y PARTIDO.
 * Async porque cargamos fotos externas (avatares).
 */

const LIME = '#D8F646';
const CARBON = '#0C0F14';
const W = 1080, H = 1350;
const LOGO_URL = '/brand/logo.png';

// Carga una imagen y devuelve la promesa. Silenciosa: si falla devuelve null.
function loadImg(src?: string | null): Promise<HTMLImageElement | null> {
  return new Promise(res => {
    if (!src) return res(null);
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = src;
  });
}

function bgAndBrand(g: CanvasRenderingContext2D) {
  // Fondo carbón
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#161B24'); bg.addColorStop(0.5, CARBON); bg.addColorStop(1, '#05070A');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // Textura líneas diagonales
  g.strokeStyle = 'rgba(255,255,255,0.025)'; g.lineWidth = 2;
  for (let i = -H; i < W; i += 44) {
    g.beginPath(); g.moveTo(i, H); g.lineTo(i + H, 0); g.stroke();
  }
  // Diagonal lima superior derecha
  g.save();
  g.translate(W, 0); g.rotate(Math.PI / 7);
  g.fillStyle = LIME; g.fillRect(-140, -80, 60, 700);
  g.fillStyle = 'rgba(216,246,70,0.3)'; g.fillRect(-50, -80, 22, 550);
  g.restore();
}

function drawFooter(g: CanvasRenderingContext2D, logo: HTMLImageElement | null) {
  g.fillStyle = LIME;
  g.fillRect(0, H - 96, W, 96);
  if (logo) {
    const lh = 66;
    const lw = (logo.width / logo.height) * lh;
    g.drawImage(logo, 60, H - 84, lw, lh);
  }
  g.fillStyle = CARBON;
  g.font = '900 32px system-ui, sans-serif';
  g.textAlign = 'right';
  g.fillText('NARVOQ · ELEVÁ TU JUEGO', W - 60, H - 42);
  g.textAlign = 'left';
}

function drawCircleAvatar(
  g: CanvasRenderingContext2D, img: HTMLImageElement | null,
  cx: number, cy: number, r: number, fallbackLetter = '?'
) {
  g.save();
  // Halo
  g.strokeStyle = LIME; g.lineWidth = 8;
  g.beginPath(); g.arc(cx, cy, r + 6, 0, Math.PI * 2); g.stroke();
  // Circle mask
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
  if (img) {
    // Cover ajustando aspect ratio
    const s = Math.max((r * 2) / img.width, (r * 2) / img.height);
    const w = img.width * s, h = img.height * s;
    g.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  } else {
    g.fillStyle = '#2A303A'; g.fillRect(cx - r, cy - r, r * 2, r * 2);
    g.fillStyle = LIME;
    g.font = `900 ${r * 1.1}px system-ui, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText((fallbackLetter || '?').toUpperCase(), cx, cy);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  }
  g.restore();
}

function wrap(g: CanvasRenderingContext2D, t: string, x: number, y: number, maxW: number, lh: number, maxLines = 4) {
  const words = (t || '').split(/\s+/);
  let line = '', ly = y, lines = 0;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, ly); ly += lh; lines++; line = w;
      if (lines >= maxLines - 1) break;
    } else line = test;
  }
  if (line) g.fillText(line, x, ly);
}

// ============ PLACA DE PERFIL DE JUGADOR ============
export interface PerfilPlacaData {
  first_name?: string;
  last_name?: string;
  username?: string;
  avatar_url?: string | null;
  category?: number | null;
  side?: string | null;         // 'drive' | 'reves' | 'ambos' | otro
  bio?: string | null;
  city?: string | null;
}

export async function drawPerfilPlaca(p: PerfilPlacaData): Promise<HTMLCanvasElement> {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  bgAndBrand(g);

  const [logo, avatar] = await Promise.all([loadImg(LOGO_URL), loadImg(p.avatar_url ?? undefined)]);

  // Logo grande arriba
  if (logo) {
    const lh = 90;
    const lw = (logo.width / logo.height) * lh;
    g.drawImage(logo, 60, 60, lw, lh);
  } else {
    g.fillStyle = '#FFF';
    g.font = '900 64px system-ui, sans-serif';
    g.fillText('NARVOQ', 60, 130);
  }

  // Avatar circular centrado grande
  drawCircleAvatar(g, avatar, W / 2, 400, 220, p.first_name?.[0]);

  // Nombre completo
  const fullName = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim().toUpperCase() || 'JUGADOR NARVOQ';
  g.fillStyle = '#FFF';
  g.textAlign = 'center';
  g.font = '900 76px system-ui, sans-serif';
  wrap(g, fullName, W / 2, 700, W - 100, 80, 2);

  // @username
  if (p.username) {
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.font = '700 40px system-ui, sans-serif';
    g.fillText(`@${p.username}`, W / 2, 800);
  }

  // Categoría destacada
  if (p.category != null) {
    // Cinta lima con "CATEGORÍA X"
    const catW = 500, catH = 110, catX = (W - catW) / 2, catY = 850;
    g.fillStyle = LIME;
    g.beginPath();
    g.moveTo(catX, catY);
    g.lineTo(catX + catW, catY);
    g.lineTo(catX + catW - 30, catY + catH);
    g.lineTo(catX + 30, catY + catH);
    g.closePath();
    g.fill();
    g.fillStyle = CARBON;
    g.font = '900 52px system-ui, sans-serif';
    g.fillText(`CATEGORÍA ${p.category}`, W / 2, catY + 72);
  }

  // Chips de info: tipo de paleta + ciudad
  let chipY = 1020;
  const chips: string[] = [];
  if (p.side) {
    const sideLabel = p.side === 'drive' ? '🎾 DRIVE'
      : p.side === 'reves' ? '🎾 REVÉS'
      : p.side === 'ambos' ? '🎾 AMBOS'
      : `🎾 ${p.side.toUpperCase()}`;
    chips.push(sideLabel);
  }
  if (p.city) chips.push(`📍 ${p.city.toUpperCase()}`);

  if (chips.length > 0) {
    g.font = '800 34px system-ui, sans-serif';
    const widths = chips.map(t => g.measureText(t).width + 60);
    const totalW = widths.reduce((a, b) => a + b, 0) + (chips.length - 1) * 20;
    let x = (W - totalW) / 2;
    chips.forEach((t, i) => {
      const w = widths[i];
      g.fillStyle = 'rgba(216,246,70,0.15)';
      g.strokeStyle = LIME; g.lineWidth = 2;
      g.beginPath();
      g.roundRect(x, chipY, w, 60, 30);
      g.fill(); g.stroke();
      g.fillStyle = LIME;
      g.fillText(t, x + 30, chipY + 42);
      x += w + 20;
    });
    chipY += 90;
  }

  // Bio
  if (p.bio) {
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.font = 'italic 500 32px system-ui, sans-serif';
    g.textAlign = 'center';
    wrap(g, `"${p.bio}"`, W / 2, chipY + 20, W - 160, 42, 3);
  }
  g.textAlign = 'left';

  drawFooter(g, logo);
  return c;
}

// ============ PLACA DE PARTIDO (busco jugadores / partido completo) ============
export interface PartidoPlayer {
  first_name?: string;
  last_name?: string;
  avatar_url?: string | null;
  category?: number | null;
  team?: number;
}
export interface PartidoPlacaData {
  players: PartidoPlayer[];   // hasta 4
  needed: number;              // cuántos faltan (0..3)
  complex: string;
  court: string;
  when: Date;
}

export async function drawPartidoPlaca(d: PartidoPlacaData): Promise<HTMLCanvasElement> {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  bgAndBrand(g);

  const [logo, ...avatars] = await Promise.all([
    loadImg(LOGO_URL),
    ...d.players.slice(0, 4).map(p => loadImg(p.avatar_url ?? undefined))
  ]);

  // Logo arriba
  if (logo) {
    const lh = 88;
    const lw = (logo.width / logo.height) * lh;
    g.drawImage(logo, 60, 60, lw, lh);
  }

  // Título grande
  g.fillStyle = LIME;
  g.font = '900 54px system-ui, sans-serif';
  g.textAlign = 'right';
  const titleText = d.needed > 0
    ? `BUSCAMOS ${d.needed} JUGADOR${d.needed > 1 ? 'ES' : ''}`
    : 'PARTIDO COMPLETO';
  g.fillText(titleText, W - 60, 120);
  g.textAlign = 'left';

  // Info: complejo + cancha + horario
  const whenText = d.when.toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long'
  }).toUpperCase();
  const hourText = d.when.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  g.fillStyle = '#FFF';
  g.font = '900 58px system-ui, sans-serif';
  wrap(g, (d.complex || '').toUpperCase(), 60, 260, W - 120, 66, 2);

  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.font = '700 34px system-ui, sans-serif';
  g.fillText((d.court || '').toUpperCase(), 60, 360);

  // Fecha + hora — banda lima
  const dateBarY = 400;
  g.fillStyle = LIME;
  g.fillRect(0, dateBarY, W, 90);
  g.fillStyle = CARBON;
  g.font = '900 38px system-ui, sans-serif';
  g.fillText(`📅 ${whenText}`, 60, dateBarY + 58);
  g.textAlign = 'right';
  g.fillText(`⏰ ${hourText} hs`, W - 60, dateBarY + 58);
  g.textAlign = 'left';

  // 4 slots de jugadores — 2 arriba (equipo 1), 2 abajo (equipo 2)
  const slotW = 220, slotY1 = 570, slotY2 = 910, slotGap = 40;
  const totalW = slotW * 2 + slotGap;
  const startX = (W - totalW) / 2;

  const team1 = d.players.filter(p => (p.team ?? 1) === 1).slice(0, 2);
  const team2 = d.players.filter(p => p.team === 2).slice(0, 2);
  // Si menos de 4 jugadores sin team asignado, distribuir
  const noTeamPlayers = d.players.filter(p => p.team == null);
  while (team1.length < 2 && noTeamPlayers.length > 0) team1.push(noTeamPlayers.shift()!);
  while (team2.length < 2 && noTeamPlayers.length > 0) team2.push(noTeamPlayers.shift()!);

  const drawSlot = (x: number, y: number, player: PartidoPlayer | undefined, avatarImg: HTMLImageElement | null) => {
    if (player) {
      drawCircleAvatar(g, avatarImg, x + slotW / 2, y + 120, 100, player.first_name?.[0]);
      g.fillStyle = '#FFF';
      g.font = '900 34px system-ui, sans-serif';
      g.textAlign = 'center';
      const name = `${player.first_name ?? ''} ${player.last_name?.[0] ?? ''}.`.trim();
      g.fillText(name.toUpperCase(), x + slotW / 2, y + 270);
      if (player.category != null) {
        g.fillStyle = LIME;
        g.font = '800 26px system-ui, sans-serif';
        g.fillText(`CAT. ${player.category}`, x + slotW / 2, y + 300);
      }
    } else {
      // Slot vacío con "?"
      g.strokeStyle = 'rgba(216,246,70,0.4)';
      g.lineWidth = 4;
      g.setLineDash([8, 8]);
      g.beginPath();
      g.arc(x + slotW / 2, y + 120, 100, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = 'rgba(216,246,70,0.7)';
      g.font = '900 110px system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText('?', x + slotW / 2, y + 160);
      g.font = '800 26px system-ui, sans-serif';
      g.fillText('¿SOS VOS?', x + slotW / 2, y + 280);
    }
    g.textAlign = 'left';
  };

  // Team 1
  const label1Y = slotY1 - 30;
  g.fillStyle = LIME; g.font = '800 26px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText('🔵 EQUIPO 1', W / 2, label1Y);
  drawSlot(startX, slotY1, team1[0], avatars[d.players.indexOf(team1[0])] ?? null);
  drawSlot(startX + slotW + slotGap, slotY1, team1[1], avatars[d.players.indexOf(team1[1] as any)] ?? null);

  // "vs" central + línea de red
  g.strokeStyle = 'rgba(216,246,70,0.5)';
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(60, 890); g.lineTo(W - 60, 890); g.stroke();
  g.fillStyle = LIME;
  g.font = 'italic 900 42px system-ui, sans-serif';
  const vsW = g.measureText('VS').width;
  g.fillStyle = CARBON;
  g.fillRect(W / 2 - vsW / 2 - 20, 870, vsW + 40, 40);
  g.fillStyle = LIME;
  g.fillText('VS', W / 2 - vsW / 2, 902);

  // Team 2
  drawSlot(startX, slotY2, team2[0], avatars[d.players.indexOf(team2[0] as any)] ?? null);
  drawSlot(startX + slotW + slotGap, slotY2, team2[1], avatars[d.players.indexOf(team2[1] as any)] ?? null);
  g.textAlign = 'center';
  g.fillStyle = LIME; g.font = '800 26px system-ui, sans-serif';
  g.fillText('🟢 EQUIPO 2', W / 2, slotY2 + 355);
  g.textAlign = 'left';

  drawFooter(g, logo);
  return c;
}

// Helper: comparte o descarga cualquier canvas como JPG
export async function sharePlacaAsync(
  drawer: () => Promise<HTMLCanvasElement>,
  fileName: string,
  title: string
) {
  const canvas = await drawer();
  const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), 'image/jpeg', 0.92));
  const file = new File([blob], fileName, { type: 'image/jpeg' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return; } catch {}
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName; a.click();
  URL.revokeObjectURL(url);
}
