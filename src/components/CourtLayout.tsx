'use client';

// Cancha visual de pádel — vertical, tamaño real (alto), 4 puestos separados por red.
// Muestra avatares y permite:
//  - onSwap: cambiar de equipo tocando el jugador
//  - onAddClick: abrir picker de amigos tocando un slot vacío (+)
//  - onRemove: sacar a un jugador (creador del partido)

type Player = {
  player_id: string;
  team: number;
  profile: { first_name: string; last_name?: string; avatar_url?: string | null; category?: number };
};

export default function CourtLayout({
  players,
  onSwap,
  canSwap,
  meId,
  onAddClick,
  onRemove
}: {
  players: Player[];
  onSwap?: (playerId: string, newTeam: 1 | 2) => void;
  canSwap?: boolean;
  meId?: string | null;
  onAddClick?: (team: 1 | 2) => void;
  onRemove?: (playerId: string) => void;
}) {
  const team1 = players.filter(p => p.team === 1).slice(0, 2);
  const team2 = players.filter(p => p.team === 2).slice(0, 2);

  const Slot = ({ p, teamOfSlot }: { p?: Player; teamOfSlot: 1 | 2 }) => {
    const isMe = meId && p?.player_id === meId;
    const clickableSwap = p && onSwap && (canSwap || isMe);
    const canRemove = p && onRemove && canSwap && !isMe;
    const targetTeam: 1 | 2 = teamOfSlot === 1 ? 2 : 1;
    const label = p
      ? `${p.profile.first_name}${p.profile.last_name ? ' ' + p.profile.last_name[0] + '.' : ''}`
      : 'Libre';

    if (!p) {
      return (
        <button
          onClick={() => onAddClick?.(teamOfSlot)}
          disabled={!onAddClick}
          className="relative flex flex-col items-center justify-center gap-2 rounded-2xl min-h-[130px] flex-1 min-w-0
            bg-white/5 border-2 border-dashed border-white/25 active:scale-95 transition
            hover:bg-ball/10 hover:border-ball/50">
          <span className="w-14 h-14 rounded-full bg-ball/15 border-2 border-ball/50 flex items-center justify-center text-3xl font-black text-ball">
            +
          </span>
          <span className="text-[11px] font-bold text-white/60">
            {onAddClick ? 'Agregar' : 'Libre'}
          </span>
        </button>
      );
    }

    return (
      <div className="relative flex-1 min-w-0">
        <button
          disabled={!clickableSwap}
          onClick={() => clickableSwap && onSwap!(p.player_id, targetTeam)}
          title={clickableSwap ? `Cambiar a equipo ${targetTeam}` : label}
          className={`w-full flex flex-col items-center justify-center gap-2 rounded-2xl p-3 min-h-[130px]
            bg-white/15 backdrop-blur-sm border border-white/20
            ${clickableSwap ? 'active:scale-95 transition' : ''}`}>
          {p.profile.avatar_url
            ? <img src={p.profile.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-ball/60" />
            : <span className="w-14 h-14 rounded-full bg-court text-white font-display font-black text-lg flex items-center justify-center border-2 border-ball/60">
                {p.profile.first_name?.[0]?.toUpperCase()}
              </span>}
          <span className="text-xs font-bold text-center leading-tight truncate max-w-full text-white">{label}</span>
          {p.profile.category != null && (
            <span className="text-[10px] text-ball font-black bg-black/30 rounded-full px-2 py-0.5">
              cat. {p.profile.category}
            </span>
          )}
        </button>
        {canRemove && (
          <button
            onClick={() => {
              if (confirm(`¿Sacar a ${p.profile.first_name} del partido?`)) onRemove!(p.player_id);
            }}
            title="Sacar del partido"
            className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-500 text-white text-sm font-black flex items-center justify-center shadow-lg active:scale-90 hover:bg-red-600">
            ✕
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-3xl overflow-hidden border-2 border-white/15 shadow-2xl"
      style={{
        background: 'linear-gradient(180deg, #0b2f5c 0%, #0a2450 50%, #0b2f5c 100%)',
        aspectRatio: '3 / 4'
      }}>
      {/* Marco de la cancha */}
      <div className="relative w-full h-full p-4 flex flex-col">
        {/* Líneas laterales blancas */}
        <div className="absolute inset-4 border-2 border-white/40 rounded-lg pointer-events-none" />
        {/* Línea de servicio superior */}
        <div className="absolute left-4 right-4 top-[27%] h-[2px] bg-white/30 pointer-events-none" />
        {/* Línea de servicio inferior */}
        <div className="absolute left-4 right-4 bottom-[27%] h-[2px] bg-white/30 pointer-events-none" />
        {/* Línea central vertical (entre líneas de servicio) */}
        <div className="absolute left-1/2 top-[27%] bottom-[27%] w-[2px] bg-white/30 -translate-x-1/2 pointer-events-none" />

        {/* RED — con postes y malla */}
        <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-4 pointer-events-none flex items-center">
          <span className="w-1.5 h-4 bg-white/70 rounded-sm" />
          <div className="flex-1 h-3 border-t-2 border-b-2 border-white/70"
            style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.6) 0 2px, transparent 2px 6px)' }} />
          <span className="w-1.5 h-4 bg-white/70 rounded-sm" />
        </div>

        {/* EQUIPO 1 — arriba */}
        <div className="flex-1 flex flex-col justify-center gap-2 relative z-10 pb-2">
          <p className="text-[10px] font-black text-ball tracking-widest text-center opacity-80">
            🔵 EQUIPO 1
          </p>
          <div className="flex gap-2">
            <Slot p={team1[0]} teamOfSlot={1} />
            <Slot p={team1[1]} teamOfSlot={1} />
          </div>
        </div>

        {/* Espacio de la red */}
        <div className="h-4" />

        {/* EQUIPO 2 — abajo */}
        <div className="flex-1 flex flex-col justify-center gap-2 relative z-10 pt-2">
          <div className="flex gap-2">
            <Slot p={team2[0]} teamOfSlot={2} />
            <Slot p={team2[1]} teamOfSlot={2} />
          </div>
          <p className="text-[10px] font-black text-ball tracking-widest text-center opacity-80">
            🟢 EQUIPO 2
          </p>
        </div>
      </div>

      {onSwap && (canSwap || meId) && (
        <p className="px-3 pb-3 text-white/50 text-[10px] text-center">
          {canSwap ? 'Tocá un jugador para cambiarlo de equipo · ✕ para sacarlo' : 'Tocate a vos mismo para cambiar de equipo'}
        </p>
      )}
    </div>
  );
}
