'use client';
import Link from 'next/link';
import { daysLeft } from '@/lib/trial';
import VerifiedBadge from './VerifiedBadge';

// Chip que muestra cuántos días restan del trial Premium.
// Colores: verde >20d, amarillo 5-20d, rojo <5d.
// Si tiene suscripción activa (no es trial) → muestra "Premium activo" sin countdown.
// Si ya vencio o nunca fue premium → no muestra nada.
export default function TrialCountdown({
  premiumExpiresAt,
  hasActiveSubscription = false,
  compact = false
}: {
  premiumExpiresAt: string | null | undefined;
  hasActiveSubscription?: boolean;
  compact?: boolean;
}) {
  const left = daysLeft(premiumExpiresAt);

  // Suscripción activa (no trial) → chip verde estable
  if (hasActiveSubscription && left && left > 0) {
    return (
      <Link href="/mi-suscripcion"
        className="inline-flex items-center gap-1.5 bg-ball/15 border border-ball/40 rounded-full px-3 py-1 text-xs font-black text-ball hover:bg-ball/25">
        <VerifiedBadge show size="sm" title="Cuenta activa" />
        <span>Premium activo</span>
      </Link>
    );
  }

  // Ya vencido o nunca fue premium → mostrar CTA a planes
  if (!left || left <= 0) return null;

  // En trial: color según urgencia
  const urgency: 'ok' | 'warn' | 'critical' = left > 20 ? 'ok' : left > 5 ? 'warn' : 'critical';
  const colors = {
    ok: 'bg-ball/15 border-ball/40 text-ball hover:bg-ball/25',
    warn: 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/25',
    critical: 'bg-red-500/15 border-red-500/40 text-red-300 hover:bg-red-500/25 animate-pulse'
  };

  if (compact) {
    return (
      <Link href="/planes"
        className={`inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-[10px] font-black ${colors[urgency]}`}>
        <VerifiedBadge show size="sm" />
        <span>{left}d</span>
      </Link>
    );
  }

  const msg = urgency === 'critical' ? `¡Vence en ${left}d! Suscribite`
    : urgency === 'warn' ? `Trial: ${left}d restantes`
    : `Premium por ${left} días`;

  return (
    <Link href="/planes"
      className={`inline-flex items-center gap-2 border rounded-full px-3 py-1.5 text-xs font-black ${colors[urgency]}`}>
      <VerifiedBadge show size="sm" />
      <span>{msg}</span>
    </Link>
  );
}
