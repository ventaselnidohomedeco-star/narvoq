'use client';

// Cancha visual de pádel con 4 puestos (2 por equipo, separados por la red).
// Muestra avatares y permite seleccionar/cambiar de equipo si onSwap está definido.

type Player = {
  player_id: string;
  team: number;
  profile: { first_name: string; last_name?: string; avatar_url?: string | null; category?: number };
};

export default function CourtLayout({
  players,
  onSwap,
  canSwap,
  meId
}: {
  players: Player[];
  onSwap?: (playerId: string, newTeam: 1 | 2) => void;
  canSwap?: boolean;
  meId?: string | null;
}) {
  const team1 = players.filter(p => p.team === 1).slice(0, 2);
  const team2 = players.filter(p => p.team === 2).slice(0, 2);
  const empty1 = 2 - team1.length;
  const empty2 = 2 - team2.length;

  const Slot = ({ p, teamOfSlot }: { p?: Player; teamOfSlot: 1 | 2 }) => {
    const isMe = meId && p?.player_id === meId;
    const clickable = p && onSwap && (canSwap || isMe);
    const targetTeam: 1 | 2 = teamOfSlot === 1 ? 2 : 1;
    const label = p ? `${p.profile.first_name}${p.profile.last_name ? ' ' + p.profile.last_name[0] + '.' : ''}` : 'Libre';
    return (
      <button
        disabled={!clickable}
        onClick={() => clickable && onSwap!(p!.player_id, targetTeam)}
        title={clickable ? `Cambiar a equipo ${targetTeam}` : label}
        className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2 min-w-[70px] flex-1
          ${p ? 'bg-white/10' : 'bg-white/5 border border-dashed border-white/15'}
          ${clickable ? 'active:scale-95 transition' : ''}`}>
        {p
          ? (p.profile.avatar_url
              ? <img src={p.profile.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover" />
              : <span className="w-11 h-11 rounded-full bg-court text-white font-display font-black flex items-center justify-center">
                  {p.profile.first_name?.[0]?.toUpperCase()}
                </span>)
          : <span className="w-11 h-11 rounded-full bg-white/5 flex items-center justify-center text-white/40 text-lg">+</span>}
        <span className="text-[11px] font-bold text-center leading-tight truncate max-w-full">{label}</span>
        {p?.profile.category != null && (
          <span className="text-[9px] text-ball font-black">cat. {p.profile.category}</span>
        )}
      </button>
    );
  };

  return (
    <div className="rounded-2xl overflow-hidden border border-white/10"
      style={{ background: 'linear-gradient(180deg, #0f2144 0%, #0b1935 50%, #0f2144 100%)' }}>
      {/* Marco de la cancha */}
      <div className="p-3 relative">
        {/* Líneas laterales */}
        <div className="absolute inset-3 border-2 border-white/30 rounded-md pointer-events-none" />
        {/* Red */}
        <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-[3px] bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.5)] pointer-events-none" />
        <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-2 bg-repeating-linear-gradient pointer-events-none"
          style={{ background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.6) 0 4px, transparent 4px 8px)' }} />

        {/* Equipo 1 (arriba) */}
        <div className="relative flex gap-2 pb-4">
          <p className="absolute -top-1 left-2 text-[9px] font-black text-ball tracking-widest">EQUIPO 1</p>
          <Slot p={team1[0]} teamOfSlot={1} />
          <Slot p={team1[1]} teamOfSlot={1} />
          {Array.from({ length: empty1 - (team1.length ? 0 : 0) - (team1.length === 0 ? 0 : 0) }).map((_, i) =>
            i === 0 && team1.length === 1 ? null : null
          )}
        </div>

        {/* Equipo 2 (abajo) */}
        <div className="relative flex gap-2 pt-4">
          <p className="absolute -bottom-1 left-2 text-[9px] font-black text-ball tracking-widest">EQUIPO 2</p>
          <Slot p={team2[0]} teamOfSlot={2} />
          <Slot p={team2[1]} teamOfSlot={2} />
        </div>
      </div>

      {onSwap && (canSwap || meId) && (
        <p className="px-3 pb-2 text-white/40 text-[10px] text-center">
          {canSwap ? 'Tocá un jugador para cambiarlo de equipo' : 'Tocate a vos mismo para cambiar de equipo'}
        </p>
      )}
    </div>
  );
}
