// Extrae coordenadas (lat, lng) de una URL de Google Maps.
// Soporta los formatos más comunes:
//   https://maps.google.com/?q=-34.5628,-58.4442
//   https://www.google.com/maps/@-34.5628,-58.4442,15z
//   https://www.google.com/maps/place/.../@-34.5628,-58.4442,17z
//   https://www.google.com/maps/place/.../!3d-34.5628!4d-58.4442
//   https://goo.gl/maps/xxx  (acortada — NO se puede resolver sin backend)
//   https://maps.app.goo.gl/xxx  (acortada — idem)

export type MapCoords = { lat: number; lng: number };

export function parseGoogleMapsUrl(url: string): MapCoords | null {
  if (!url) return null;
  const s = url.trim();

  // 1) @lat,lng
  const at = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return { lat: parseFloat(at[1]), lng: parseFloat(at[2]) };

  // 2) !3dlat!4dlng
  const bang = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (bang) return { lat: parseFloat(bang[1]), lng: parseFloat(bang[2]) };

  // 3) ?q=lat,lng o &q=lat,lng
  const q = s.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (q) return { lat: parseFloat(q[1]), lng: parseFloat(q[2]) };

  // 4) ?ll=lat,lng
  const ll = s.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (ll) return { lat: parseFloat(ll[1]), lng: parseFloat(ll[2]) };

  // 5) /maps/search/LAT,+LNG (formato que Google devuelve al resolver acortados)
  const search = s.match(/\/maps\/search\/(-?\d+\.\d+),\s*\+?(-?\d+\.\d+)/);
  if (search) return { lat: parseFloat(search[1]), lng: parseFloat(search[2]) };

  // 6) /maps/place/.../LAT,+LNG
  const place = s.match(/\/maps\/place\/[^/]+\/(-?\d+\.\d+),\s*\+?(-?\d+\.\d+)/);
  if (place) return { lat: parseFloat(place[1]), lng: parseFloat(place[2]) };

  // 7) Formato "lat,lng" pelado (por si el usuario copia solo las coords) — con o sin espacio/+
  const plain = s.match(/^\s*(-?\d+\.\d+)\s*,\s*\+?(-?\d+\.\d+)\s*$/);
  if (plain) return { lat: parseFloat(plain[1]), lng: parseFloat(plain[2]) };

  return null;
}

// ¿Es un link acortado que necesita resolverse en el server?
export function isShortenedMapsUrl(url: string): boolean {
  return /goo\.gl\/maps|maps\.app\.goo\.gl/.test(url);
}
