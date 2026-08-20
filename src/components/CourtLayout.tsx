'use client';

// Cancha visual de pádel en pseudo-3D con perspectiva. 4 puestos separados por red.
// - onSwap: cambiar de equipo tocando el jugador
// - onAddClick: abrir picker de amigos tocando un slot vacío (+)
// - onRemove: sacar a un jugador (solo el creador del partido)

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
          className="flex flex-col items-center justify-center gap-2 rounded-2xl h-full w-full
            bg-white/8 border-2 border-dashed border-white/30 active:scale-95 transition
            hover:bg-ball/10 hover:border-ball/50 backdrop-blur-sm shadow-xl">
          <span className="w-14 h-14 rounded-full bg-ball/15 border-2 border-ball/50 flex items-center justify-center text-3xl font-black text-ball shadow-inner">
            +
          </span>
          <span className="text-[11px] font-bold text-white/80">
            {onAddClick ? 'Agregar' : 'Libre'}
          </span>
        </button>
      );
    }

    return (
      <div className="relative h-full w-full">
        <button
          disabled={!clickableSwap}
          onClick={() => clickableSwap && onSwap!(p.player_id, targetTeam)}
          title={clickableSwap ? `Cambiar a equipo ${targetTeam}` : label}
          className={`w-full h-full flex flex-col items-center justify-center gap-1.5 rounded-2xl p-2
            bg-gradient-to-b from-white/25 to-white/10 backdrop-blur-md border border-white/30 shadow-xl
            ${clickableSwap ? 'active:scale-95 transition' : ''}`}>
          {/* Sombra debajo del jugador (efecto 3D) */}
          <div className="relative">
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-12 h-2 bg-black/40 rounded-full blur-sm" />
            {p.profile.avatar_url
              ? <img src={p.profile.avatar_url} alt=""
                  className="relative w-14 h-14 rounded-full object-cover border-2 border-ball/80 shadow-lg" />
              : <span className="relative w-14 h-14 rounded-full bg-court text-white font-display font-black text-lg flex items-center justify-center border-2 border-ball/80 shadow-lg">
                  {p.profile.first_name?.[0]?.toUpperCase()}
                </span>}
          </div>
          <span className="text-xs font-bold text-center leading-tight truncate max-w-full text-white drop-shadow">
            {label}
          </span>
          {p.profile.category != null && (
            <span className="text-[10px] text-ball font-black bg-black/40 rounded-full px-2 py-0.5 shadow">
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
            className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-red-500 text-white text-base font-black flex items-center justify-center shadow-lg active:scale-90 hover:bg-red-600 z-20">
            ✕
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="relative select-none" style={{ perspective: '1200px' }}>
      {/* Contenedor con perspectiva 3D */}
      <div className="rounded-3xl overflow-hidden border-2 border-white/20 shadow-2xl relative"
        style={{
          background: 'radial-gradient(ellipse at center top, #1a4585 0%, #0b2f5c 45%, #06183a 100%)',
          aspectRatio: '4 / 5',
          transformStyle: 'preserve-3d'
        }}>

        {/* PISO de la cancha inclinado (efecto 3D) */}
        <div className="absolute inset-4 origin-top"
          style={{
            transform: 'rotateX(30deg) scale(1.05)',
            transformOrigin: '50% 50%',
            background: 'linear-gradient(180deg, rgba(30,80,150,0.9) 0%, rgba(40,100,180,0.85) 50%, rgba(30,80,150,0.9) 100%)',
            borderRadius: '8px',
            boxShadow: 'inset 0 0 60px rgba(0,0,0,0.4)'
          }}>
          {/* Líneas del piso */}
          <div className="absolute inset-0 border-2 border-white/60 rounded-md" />
          {/* Líneas de servicio */}
          <div className="absolute left-0 right-0 top-[28%] h-[2px] bg-white/50" />
          <div className="absolute left-0 right-0 bottom-[28%] h-[2px] bg-white/50" />
          {/* Línea central en T */}
          <div className="absolute left-1/2 top-[28%] bottom-[28%] w-[2px] bg-white/50 -translate-x-1/2" />
          {/* Textura de superficie */}
          <div className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 20px, rgba(255,255,255,0.03) 20px 21px)'
            }} />
        </div>

        {/* PAREDES DE CRISTAL — laterales */}
        <div className="absolute left-0 top-0 bottom-0 w-4"
          style={{
            background: 'linear-gradient(90deg, rgba(180,220,255,0.25) 0%, rgba(180,220,255,0.05) 100%)',
            borderRight: '2px solid rgba(255,255,255,0.4)',
            transform: 'skewY(-6deg)',
            transformOrigin: 'right center'
          }} />
        <div className="absolute right-0 top-0 bottom-0 w-4"
          style={{
            background: 'linear-gradient(-90deg, rgba(180,220,255,0.25) 0%, rgba(180,220,255,0.05) 100%)',
            borderLeft: '2px solid rgba(255,255,255,0.4)',
            transform: 'skewY(6deg)',
            transformOrigin: 'left center'
          }} />

        {/* RED en el medio con postes 3D */}
        <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-6 pointer-events-none z-10 flex items-center">
          {/* Poste izquierdo */}
          <div className="w-2 h-8 bg-gradient-to-b from-white/90 to-white/40 rounded shadow-lg" />
          {/* Malla */}
          <div className="flex-1 h-5 relative"
            style={{
              background: `
                repeating-linear-gradient(0deg, rgba(255,255,255,0.85) 0 1px, transparent 1px 4px),
                repeating-linear-gradient(90deg, rgba(255,255,255,0.75) 0 1px, transparent 1px 4px)
              `,
              borderTop: '2px solid white',
              borderBottom: '2px solid rgba(255,255,255,0.4)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
            }} />
          {/* Poste derecho */}
          <div className="w-2 h-8 bg-gradient-to-b from-white/90 to-white/40 rounded shadow-lg" />
        </div>

        {/* JUGADORES */}
        <div className="relative w-full h-full p-5 flex flex-col z-20">
          {/* EQUIPO 1 — arriba */}
          <div className="flex-1 flex flex-col justify-center gap-2 pb-3">
            <p className="text-[10px] font-black text-ball tracking-widest text-center drop-shadow-lg">
              🔵 EQUIPO 1
            </p>
            <div className="flex gap-3 flex-1">
              <Slot p={team1[0]} teamOfSlot={1} />
              <Slot p={team1[1]} teamOfSlot={1} />
            </div>
          </div>

          {/* Espacio central para la red */}
          <div className="h-6" />

          {/* EQUIPO 2 — abajo */}
          <div className="flex-1 flex flex-col justify-center gap-2 pt-3">
            <div className="flex gap-3 flex-1">
              <Slot p={team2[0]} teamOfSlot={2} />
              <Slot p={team2[1]} teamOfSlot={2} />
            </div>
            <p className="text-[10px] font-black text-ball tracking-widest text-center drop-shadow-lg">
              🟢 EQUIPO 2
            </p>
          </div>
        </div>

        {/* Reflejo/brillo superior (efecto 3D) */}
        <div className="absolute inset-x-0 top-0 h-16 pointer-events-none"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 100%)' }} />
      </div>

      {onSwap && (canSwap || meId) && (
        <p className="mt-2 px-3 text-white/50 text-[10px] text-center">
          {canSwap ? 'Tocá un jugador para cambiarlo de equipo · ✕ para sacarlo' : 'Tocate a vos mismo para cambiar de equipo'}
        </p>
      )}
    </div>
  );
}
