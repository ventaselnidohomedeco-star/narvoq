// Componente de marca Narvoq. Renderiza el isotipo (paleta) + wordmark.
// Sin handlers de cliente para que funcione en Server Components.
// Si el PNG no existe en /public/brand/isotipo.png, el navegador muestra
// solo el icono roto pero la app no se rompe.

type Variant = 'full' | 'mark' | 'inline';

const isotipoSrc = '/brand/isotipo.png';

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
      <img src={isotipoSrc} alt="Narvoq" width={size} height={size}
        className={className}
        style={{ width: size, height: size, objectFit: 'contain' }} />
    );
  }
  if (variant === 'full') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <img src={isotipoSrc} alt="" width={size} height={size}
          style={{ width: size, height: size, objectFit: 'contain' }} />
        <span className="font-display font-black tracking-wide" style={{ fontSize: size * 0.75 }}>
          NARVO<span className="text-ball">Q</span>
        </span>
      </div>
    );
  }
  // inline (default): isotipo chico + wordmark chico
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img src={isotipoSrc} alt="" width={size * 0.7} height={size * 0.7}
        style={{ width: size * 0.7, height: size * 0.7, objectFit: 'contain' }} />
      <span className="font-display font-black">
        NARVO<span className="text-ball">Q</span>
      </span>
    </span>
  );
}
