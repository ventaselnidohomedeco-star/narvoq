// Componente de marca NarvoQ.
// Renderiza:
//   - variant="full":    isotipo grande + wordmark grande (para landings)
//   - variant="inline":  isotipo chico + wordmark chico (para headers)
//   - variant="mark":    solo el isotipo (icono cuadrado)
// El isotipo se dibuja como SVG con fondo transparente, así se integra en
// cualquier bg y no queda un "rectángulo" negro sobrepuesto.

type Variant = 'full' | 'mark' | 'inline';

function Isotipo({ size = 32 }: { size?: number }) {
  // Paleta de pádel: cabeza redonda con 4 puntos lima, mango con 3 rayas.
  return (
    <svg viewBox="0 0 64 100" width={size} height={size * 1.5}
      role="img" aria-label="NarvoQ" style={{ display: 'block' }}>
      {/* Cabeza de la paleta */}
      <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="6" />
      {/* 4 puntos lima */}
      <circle cx="26" cy="26" r="3.6" fill="#D8F646" />
      <circle cx="38" cy="26" r="3.6" fill="#D8F646" />
      <circle cx="26" cy="38" r="3.6" fill="#D8F646" />
      <circle cx="38" cy="38" r="3.6" fill="#D8F646" />
      {/* "V" del garganta */}
      <path d="M22 55 L32 66 L42 55 Z" fill="currentColor" />
      {/* Mango con 3 rayas */}
      <rect x="28" y="66" width="8" height="6" rx="1" fill="currentColor" />
      <rect x="28" y="74" width="8" height="6" rx="1" fill="currentColor" />
      <rect x="28" y="82" width="8" height="6" rx="1" fill="currentColor" />
    </svg>
  );
}

function Wordmark({ size = 24 }: { size?: number }) {
  // Renderizamos "NarvoQ" con Q mayúscula (marca oficial), en font display.
  return (
    <span className="font-display font-black tracking-wide leading-none"
      style={{ fontSize: size, whiteSpace: 'nowrap' }}>
      Narvo<span className="text-ball">Q</span>
    </span>
  );
}

export default function Brand({
  variant = 'inline',
  size = 32,
  className = ''
}: {
  variant?: Variant;
  size?: number;
  className?: string;
}) {
  if (variant === 'mark') {
    return (
      <span className={`inline-flex items-center justify-center text-white ${className}`}
        style={{ width: size, height: size }}>
        <Isotipo size={size * 0.7} />
      </span>
    );
  }
  if (variant === 'full') {
    return (
      <span className={`inline-flex items-center gap-3 text-white ${className}`}>
        <Isotipo size={size * 0.9} />
        <Wordmark size={size * 0.9} />
      </span>
    );
  }
  // inline (default): más compacto para headers
  return (
    <span className={`inline-flex items-center gap-2 text-white ${className}`}>
      <Isotipo size={size * 0.85} />
      <Wordmark size={size * 0.85} />
    </span>
  );
}
