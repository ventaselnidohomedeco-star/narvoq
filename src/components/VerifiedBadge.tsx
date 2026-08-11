'use client';

// Badge NarvoQ Verificado — checkmark lima al lado del nombre.
// Se muestra SOLO si el usuario/complejo es premium activo.
// Usage:
//   <VerifiedBadge show={profile.is_premium} />
//   <VerifiedBadge show={complex.is_premium} size="lg" />

export default function VerifiedBadge({
  show, size = 'md', title = 'Cuenta NarvoQ Verificado'
}: {
  show?: boolean | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  title?: string;
}) {
  if (!show) return null;

  const px = size === 'sm' ? 14 : size === 'md' ? 18 : size === 'lg' ? 24 : 32;

  return (
    <span
      title={title}
      aria-label={title}
      className="inline-flex items-center align-middle ml-1 shrink-0"
      style={{ verticalAlign: 'baseline' }}>
      <svg width={px} height={px} viewBox="0 0 24 24" fill="none">
        {/* Estrella-checkmark estilo verificado */}
        <path
          d="M12 2 L14 5.5 L18 5 L18 9 L21.5 11 L18 13 L18 17 L14 16.5 L12 20 L10 16.5 L6 17 L6 13 L2.5 11 L6 9 L6 5 L10 5.5 Z"
          fill="#D8F646"
          stroke="#0A0F1A"
          strokeWidth="0.5"
          strokeLinejoin="round"
        />
        <path
          d="M8 11.5 L11 14.5 L16 8.5"
          stroke="#0A0F1A"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </span>
  );
}
