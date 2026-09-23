'use client';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function OldExitoRedirect() {
  const { slug, bookingId } = useParams<{ slug: string; bookingId: string }>();
  const router = useRouter();
  useEffect(() => { router.replace(`/${slug}/turnosdisponibles/exito/${bookingId}`); }, [slug, bookingId, router]);
  return <main className="min-h-dvh flex items-center justify-center text-white/60">Redirigiendo…</main>;
}
