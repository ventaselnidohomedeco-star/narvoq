// Utilidades de geolocalización.

export type Coords = { lat: number; lng: number };

/** Pide al navegador la ubicación del usuario. */
export function getMyLocation(options?: PositionOptions): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      return reject(new Error('Tu navegador no soporta geolocalización.'));
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => reject(err),
      { timeout: 15000, maximumAge: 60000, ...options }
    );
  });
}

/** Distancia entre 2 puntos en km (fórmula haversine). */
export function distanceKm(a: Coords, b: Coords): number {
  const R = 6371;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Geocodifica con fallback: dirección exacta → localidad+prov → localidad sola.
 *  Casi nunca falla si la localidad existe. */
export async function geocodeAddress(parts: {
  address?: string; locality?: string; province?: string;
}): Promise<Coords | null> {
  if (!parts.locality) return null;
  const qs = new URLSearchParams();
  if (parts.address) qs.set('address', parts.address);
  if (parts.locality) qs.set('locality', parts.locality);
  if (parts.province) qs.set('province', parts.province);

  // Client-side
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/geocode?${qs.toString()}`);
      if (!res.ok) return null;
      const j = await res.json();
      return j.lat && j.lng ? { lat: j.lat, lng: j.lng } : null;
    } catch { return null; }
  }

  // Server-side: llamar Nominatim directo con fallback
  const attempts: string[] = [];
  if (parts.address && parts.locality && parts.province)
    attempts.push(`${parts.address}, ${parts.locality}, ${parts.province}, Argentina`);
  if (parts.locality && parts.province)
    attempts.push(`${parts.locality}, ${parts.province}, Argentina`);
  if (parts.locality)
    attempts.push(`${parts.locality}, Argentina`);

  for (const q of attempts) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'NarvoQ/1.0 (contacto@narvoq.com.ar)', 'Accept-Language': 'es' }
      });
      if (!res.ok) continue;
      const arr = await res.json();
      if (arr && arr.length > 0) return { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) };
    } catch {}
    await new Promise(r => setTimeout(r, 300));
  }
  return null;
}
