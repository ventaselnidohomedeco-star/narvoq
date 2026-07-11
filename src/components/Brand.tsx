// Componente de marca Narvoq.
// - variant="full" o "inline": usa /brand/logo.png (NARVOQ + paleta ya integrados)
// - variant="mark": usa /brand/icono-app.png (isotipo con fondo redondeado)
// - variant="isotipo": usa /brand/isotipo.png crudo

type Variant = 'full' | 'mark' | 'inline' | 'isotipo';

const logoSrc = '/brand/logo.png?v=3';
const isotipoSrc = '/brand/isotipo.png?v=3';
const iconoAppSrc = '/brand/icono-app.png?v=3';

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
    // Ícono cuadrado (para tabs, favicons, chips)
    return (
      <img src={iconoAppSrc} alt="Narvoq" width={size} height={size}
        className={`rounded-xl ${className}`}
        style={{ width: size, height: size, objectFit: 'contain' }} />
    );
  }
  if (variant === 'isotipo') {
    return (
      <img src={isotipoSrc} alt="Narvoq" width={size} height={size}
        className={className}
        style={{ width: size, height: size, objectFit: 'contain' }} />
    );
  }
  // full o inline: usamos el LOGO.png completo (paleta + wordmark).
  // El PNG tiene proporción ~3:1 (2172x724). Le damos width por altura.
  const height = variant === 'full' ? size * 1.2 : size;
  const width = height * 3;
  return (
    <img src={logoSrc} alt="Narvoq — Elevá tu juego, elevá tu nivel"
      className={className}
      style={{ height, width: 'auto', maxWidth: width, objectFit: 'contain', display: 'block' }} />
  );
}
