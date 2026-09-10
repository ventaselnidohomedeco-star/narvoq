// Sonidos in-app. Usa Web Audio API para no depender de archivos.
// Si en el futuro querés un mp3/wav custom, poné el archivo en /public/sounds/
// y usá playFile('/sounds/chime.mp3').

export async function playNarvoqChime(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx: AudioContext = new AC();

    // Necesita gesto de usuario para autoplay
    if (ctx.state === 'suspended') { try { await ctx.resume(); } catch {} }

    // Chime NarvoQ: 3 notas ascendentes cortas (C5 → E5 → G5) — feliz y reconocible
    const notes: Array<{ freq: number; start: number; dur: number }> = [
      { freq: 523.25, start: 0.00, dur: 0.12 },  // C5
      { freq: 659.25, start: 0.10, dur: 0.12 },  // E5
      { freq: 783.99, start: 0.22, dur: 0.30 }   // G5 más larga
    ];

    const master = ctx.createGain();
    master.gain.value = 0.25;
    master.connect(ctx.destination);

    for (const n of notes) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = n.freq;
      // Envolvente para que no clickee
      g.gain.setValueAtTime(0, ctx.currentTime + n.start);
      g.gain.linearRampToValueAtTime(1, ctx.currentTime + n.start + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.start + n.dur);
      osc.connect(g); g.connect(master);
      osc.start(ctx.currentTime + n.start);
      osc.stop(ctx.currentTime + n.start + n.dur + 0.02);
    }

    // Cerramos el context cuando termine
    setTimeout(() => { try { ctx.close(); } catch {} }, 900);
  } catch { /* silencioso */ }
}

// Reproduce un archivo (mp3/wav) desde /public
export async function playFile(url: string, volume = 0.6): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const a = new Audio(url);
    a.volume = volume;
    await a.play();
  } catch { /* silencioso */ }
}
