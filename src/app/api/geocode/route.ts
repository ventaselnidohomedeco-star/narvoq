import { NextRequest, NextResponse } from 'next/server';

// GET /api/geocode?q=direccion
// Geocodifica una dirección vía Nominatim (OSM) desde el server —
// evita CORS + User-Agent issues del navegador.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q');
  if (!q) return NextResponse.json({ error: 'q requerido' }, { status: 400 });

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'NarvoQ/1.0 (contacto@narvoq.com.ar)',
        'Accept-Language': 'es'
      }
    });
    if (!res.ok) return NextResponse.json({ error: `nominatim ${res.status}` }, { status: 502 });
    const arr = await res.json();
    if (!arr || arr.length === 0) return NextResponse.json({ error: 'not_found', query: q }, { status: 404 });
    return NextResponse.json({
      lat: parseFloat(arr[0].lat),
      lng: parseFloat(arr[0].lon),
      display_name: arr[0].display_name
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
