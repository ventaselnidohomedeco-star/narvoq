'use client';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Redirect del link viejo /r/<slug> al nuevo /<slug>/turnosdisponibles
export default function OldRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  useEffect(() => { router.replace(`/${slug}/turnosdisponibles`); }, [slug, router]);
  return <main className="min-h-dvh flex items-center justify-center text-white/60">Redirigiendo…</main>;
}
