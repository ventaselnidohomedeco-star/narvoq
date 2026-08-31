// Provincias de Argentina + helpers para localidades.
// Usamos la API pública de GeoRef del gobierno (gratis, oficial, sin límites)
// para localidades — así siempre está actualizado sin mantener el dataset.

export const PROVINCIAS_AR = [
  'Buenos Aires',
  'Ciudad Autónoma de Buenos Aires',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Córdoba',
  'Corrientes',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucumán'
] as const;

export type Provincia = (typeof PROVINCIAS_AR)[number];

// Cache en memoria para no rehacer requests
const localidadesCache = new Map<string, string[]>();

/** Trae localidades de una provincia. Devuelve array ordenado alfabético. */
export async function fetchLocalidades(provincia: string): Promise<string[]> {
  if (!provincia) return [];
  if (localidadesCache.has(provincia)) return localidadesCache.get(provincia)!;

  try {
    // GeoRef API: hasta 5000 resultados por página
    const url = `https://apis.datos.gob.ar/georef/api/localidades?provincia=${encodeURIComponent(provincia)}&max=5000&campos=nombre`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch failed');
    const data = await res.json();
    const nombres = (data.localidades ?? [])
      .map((l: any) => l.nombre as string)
      .filter(Boolean)
      // Deduplicar por nombre normalizado
      .filter((n: string, i: number, arr: string[]) =>
        arr.findIndex(x => x.toLowerCase() === n.toLowerCase()) === i)
      .sort((a: string, b: string) => a.localeCompare(b, 'es'));
    localidadesCache.set(provincia, nombres);
    return nombres;
  } catch {
    // Fallback: array vacío si la API falla, el usuario puede tipear libre
    return [];
  }
}
