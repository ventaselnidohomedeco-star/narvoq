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

/** Geocodificar dirección con la API de OpenStreetMap Nominatim (gratis). */
export async function geocodeAddress(address: string): Promise<Coords | null> {
  if (!address) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address + ', Argentina')}`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
    if (!res.ok) return null;
    const arr = await res.json();
    if (!arr || arr.length === 0) return null;
    return { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) };
  } catch {
    return null;
  }
}
