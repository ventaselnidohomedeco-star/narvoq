import { NextRequest, NextResponse } from 'next/server';
import { parseGoogleMapsUrl } from '@/lib/gmaps';

// GET /api/gmaps-resolve?url=<google_maps_url>
// Sigue el redirect (si es acortado) y devuelve lat/lng.
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'falta url' }, { status: 400 });

  // 1) Intento parseo directo
  const direct = parseGoogleMapsUrl(url);
  if (direct) return NextResponse.json(direct);

  // 2) Es acortado → seguimos el redirect
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 NarvoQ/1.0' }
    });
    // La URL final ya expandida
    const finalUrl = res.url;
    const parsed = parseGoogleMapsUrl(finalUrl);
    if (parsed) return NextResponse.json(parsed);

    // 3) Buscar en el HTML si el fetch trajo la página
    const html = await res.text();
    const inHtml = parseGoogleMapsUrl(html);
    if (inHtml) return NextResponse.json(inHtml);

    return NextResponse.json({ error: 'no se pudo extraer coordenadas', finalUrl }, { status: 404 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
