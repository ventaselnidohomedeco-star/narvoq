import { NextRequest, NextResponse } from 'next/server';

// GET /api/geocode?address=X&locality=Y&province=Z
// Geocodifica con FALLBACK — si no encuentra la dirección exacta,
// intenta con solo localidad+provincia (usa el centro de la ciudad).
// Nunca falla en devolver algo si la localidad existe.
async function tryQuery(q: string): Promise<any | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'NarvoQ/1.0 (contacto@narvoq.com.ar)',
        'Accept-Language': 'es'
      }
    });
    if (!res.ok) return null;
    const arr = await res.json();
    if (!arr || arr.length === 0) return null;
    return arr[0];
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const address = sp.get('address') ?? '';
  const locality = sp.get('locality') ?? '';
  const province = sp.get('province') ?? '';
  const legacy = sp.get('q'); // retrocompat

  // Estrategia: probar del más específico al más general
  const attempts: { level: string; q: string }[] = [];
  if (legacy) attempts.push({ level: 'legacy', q: legacy });
  if (address && locality && province)
    attempts.push({ level: 'full', q: `${address}, ${locality}, ${province}, Argentina` });
  if (address && locality)
    attempts.push({ level: 'address+locality', q: `${address}, ${locality}, Argentina` });
  if (locality && province)
    attempts.push({ level: 'locality+province', q: `${locality}, ${province}, Argentina` });
  if (locality)
    attempts.push({ level: 'locality', q: `${locality}, Argentina` });

  if (attempts.length === 0) return NextResponse.json({ error: 'sin datos' }, { status: 400 });

  for (const a of attempts) {
    const r = await tryQuery(a.q);
    if (r) {
      return NextResponse.json({
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
        display_name: r.display_name,
        level: a.level,
        query: a.q
      });
    }
    // Nominatim policy: 1 req/sec — pequeña pausa
    await new Promise(r => setTimeout(r, 300));
  }
  return NextResponse.json({ error: 'not_found', tried: attempts.map(a => a.q) }, { status: 404 });
}
