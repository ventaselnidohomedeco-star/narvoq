import { NextResponse } from 'next/server';

// Devuelve la VAPID public key al cliente (necesaria para suscribirse).
export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return NextResponse.json({ error: 'VAPID_PUBLIC_KEY no configurada' }, { status: 500 });
  return NextResponse.json({ key });
}
