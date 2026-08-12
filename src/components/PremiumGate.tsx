'use client';
import Link from 'next/link';
import { FEATURE_INFO } from '@/lib/limits';
import VerifiedBadge from './VerifiedBadge';

// PremiumGate — bloquea una feature detrás de una tarjeta "Actualizá a Premium".
// Uso:
//   <PremiumGate isPremium={sub.isPremium} feature="courts_max">
//     <BotónCrearCancha />
//   </PremiumGate>
//
// Si isPremium=true, renderiza children normal.
// Si isPremium=false, muestra un card bloqueado con CTA a /planes.

export default function PremiumGate({
  isPremium, feature, children, mode = 'block'
}: {
  isPremium: boolean;
  feature: string;
  children: React.ReactNode;
  mode?: 'block' | 'inline' | 'overlay';   // block: reemplaza. inline: banner arriba. overlay: encima con blur.
}) {
  if (isPremium) return <>{children}</>;

  const info = FEATURE_INFO[feature] ?? {
    title: 'Feature Premium',
    description: 'Esta feature requiere NarvoQ Verificado.'
  };

  if (mode === 'inline') {
    return (
      <>
        <div className="card !p-4 border border-ball/40 bg-ball/5 flex items-center gap-3 mb-3">
          <VerifiedBadge show size="md" />
          <div className="flex-1 min-w-0">
            <p className="font-black text-sm truncate">{info.title}</p>
            <p className="text-white/60 text-xs truncate">{info.description}</p>
          </div>
          <Link href={`/planes?f=${feature}`}
            className="bg-ball text-courtdark font-black text-xs px-3 py-2 rounded-lg shrink-0">
            Ver planes
          </Link>
        </div>
        {children}
      </>
    );
  }

  if (mode === 'overlay') {
    return (
      <div className="relative">
        <div className="pointer-events-none opacity-30 blur-[2px]">{children}</div>
        <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm bg-black/40 rounded-xl">
          <UpgradeCard feature={feature} />
        </div>
      </div>
    );
  }

  // mode = 'block' (default) — reemplaza children
  return <UpgradeCard feature={feature} />;
}

function UpgradeCard({ feature }: { feature: string }) {
  const info = FEATURE_INFO[feature] ?? {
    title: 'Feature Premium',
    description: 'Esta feature requiere NarvoQ Verificado.'
  };
  return (
    <div className="card !p-6 border-2 border-ball/40 bg-gradient-to-br from-ball/10 via-transparent to-transparent text-center max-w-md mx-auto">
      <div className="flex justify-center mb-3">
        <VerifiedBadge show size="xl" />
      </div>
      <p className="font-display font-black text-xl leading-tight">{info.title}</p>
      <p className="text-white/70 text-sm mt-2">{info.description}</p>
      <Link href={`/planes?f=${feature}`}
        className="mt-5 inline-block bg-ball text-courtdark font-display font-black rounded-2xl px-6 py-3">
        Actualizar a Premium →
      </Link>
    </div>
  );
}
