'use client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Botón de "Volver" pensado para 14-70 años:
// grande, con ícono y label. Si hay historial usa router.back(),
// si no, usa el fallback href.
export default function BackButton({
  fallbackHref = '/',
  label = 'Volver',
  className = ''
}: {
  fallbackHref?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();

  function go() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  const inner = (
    <span className={`inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white/80 rounded-xl px-4 py-2.5 font-black text-sm active:scale-95 transition min-h-[44px] ${className}`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {label}
    </span>
  );

  // En cel: NextLink al fallback (más rápido). En desktop: back() nativo.
  // Simplificamos: siempre usamos onClick con router.back().
  return (
    <button onClick={go} className="inline-block">
      {inner}
    </button>
  );
}
