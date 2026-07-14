// Componente de marca NarvoQ.
// Usa el logo real de /public/brand/logo.png como imagen para que se vea
// consistente en toda la app. Para íconos pequeños (mark) usa el isotipo SVG.

type Variant = 'full' | 'mark' | 'inline';

const logoSrc = '/brand/logo.png?v=4';
const iconoAppSrc = '/brand/icono-app.png?v=4';

function IsotipoSvg({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 100" width={size} height={size * 1.5}
      role="img" aria-label="NarvoQ" style={{ display: 'block' }}>
      <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="6" />
      <circle cx="26" cy="26" r="3.6" fill="#D8F646" />
      <circle cx="38" cy="26" r="3.6" fill="#D8F646" />
      <circle cx="26" cy="38" r="3.6" fill="#D8F646" />
      <circle cx="38" cy="38" r="3.6" fill="#D8F646" />
      <path d="M22 55 L32 66 L42 55 Z" fill="currentColor" />
      <rect x="28" y="66" width="8" height="6" rx="1" fill="currentColor" />
      <rect x="28" y="74" width="8" height="6" rx="1" fill="currentColor" />
      <rect x="28" y="82" width="8" height="6" rx="1" fill="currentColor" />
    </svg>
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
    // Ícono cuadrado — usamos el isotipo SVG (transparente, contornea el bg)
    return (
      <span className={`inline-flex items-center justify-center text-white ${className}`}
        style={{ width: size, height: size }}>
        <IsotipoSvg size={size * 0.7} />
      </span>
    );
  }

  // full o inline: logo real como imagen.
  // El PNG es 2172x724 (~3:1). Le damos altura por proporción.
  const height = variant === 'full' ? size * 1.35 : size * 1.05;
  return (
    <img src={logoSrc} alt="NarvoQ" className={className}
      style={{ height, width: 'auto', display: 'block', objectFit: 'contain' }} />
  );
}

export { iconoAppSrc };
