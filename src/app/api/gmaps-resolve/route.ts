import { NextRequest, NextResponse } from 'next/server';
import { parseGoogleMapsUrl } from '@/lib/gmaps';

// Patrones adicionales para buscar dentro del HTML que devuelve Google Maps
function findInHtml(html: string): { lat: number; lng: number } | null {
  // Patrón A: ["...", lat, lng, ...] típico en apollo/appState
  const a = html.match(/\[null,null,(-?\d+\.\d{4,}),(-?\d+\.\d{4,})\]/);
  if (a) return { lat: parseFloat(a[1]), lng: parseFloat(a[2]) };

  // Patrón B: coordenadas en el meta og:image o link canonical
  const b = html.match(/[?&@](-?\d+\.\d{4,}),(-?\d+\.\d{4,})/);
  if (b) return { lat: parseFloat(b[1]), lng: parseFloat(b[2]) };

  // Patrón C: JSON literal "latitude":X.X,"longitude":Y.Y
  const c = html.match(/"latitude"\s*:\s*(-?\d+\.\d+)\s*,\s*"longitude"\s*:\s*(-?\d+\.\d+)/);
  if (c) return { lat: parseFloat(c[1]), lng: parseFloat(c[2]) };

  return null;
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'falta url' }, { status: 400 });

  const debug: any = { input: url, tried: [] };

  // 1) Parseo directo
  const direct = parseGoogleMapsUrl(url);
  if (direct) return NextResponse.json({ ...direct, source: 'direct' });
  debug.tried.push('direct');

  // 2) Seguir redirect
  let finalUrl = url;
  let html = '';
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        // User-agent de navegador desktop, si no Google devuelve una página distinta
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8'
      }
    });
    finalUrl = res.url;
    debug.finalUrl = finalUrl;

    // 3) Parsear la URL final
    const fromFinal = parseGoogleMapsUrl(finalUrl);
    if (fromFinal) return NextResponse.json({ ...fromFinal, source: 'finalUrl' });
    debug.tried.push('finalUrl');

    // 4) Buscar en el HTML de la respuesta
    html = await res.text();
    const fromHtml = parseGoogleMapsUrl(html);
    if (fromHtml) return NextResponse.json({ ...fromHtml, source: 'html-parse' });
    debug.tried.push('html-parse');

    const fromHtml2 = findInHtml(html);
    if (fromHtml2) return NextResponse.json({ ...fromHtml2, source: 'html-deep' });
    debug.tried.push('html-deep');

    debug.htmlPreview = html.slice(0, 500);
  } catch (e: any) {
    debug.fetchError = e.message;
  }

  return NextResponse.json({ error: 'no se pudo extraer coordenadas', debug }, { status: 404 });
}
