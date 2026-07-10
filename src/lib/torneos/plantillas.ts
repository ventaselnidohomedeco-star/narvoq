import type { Sex } from '../types';

export interface TournamentTemplate {
  key: string;
  name: string;            // nombre sugerido (editable)
  rules: string;           // reglamento base (editable)
  categories: number[];    // categorías permitidas
  sex: Sex | null;         // null = abierto
  sumTarget: number | null;
  maxPairs: number;
  format: 'eliminacion' | 'zonas';
}

const BASE_RULES = (extra: string) => `Formato: zonas de 3 + cruces (editable).
Partidos a 2 sets con super tie-break en el tercero.
Presentarse 15 minutos antes del horario asignado.
La organización puede reprogramar por lluvia.
${extra}`;

// ---- Plantillas por categoría (1ra a 8va) ----
const ORD = ['1ra', '2da', '3ra', '4ta', '5ta', '6ta', '7ma', '8va'];
const categoryTemplates: TournamentTemplate[] = ORD.map((label, i) => ({
  key: `cat_${i + 1}`,
  name: `Torneo ${label}`,
  rules: BASE_RULES(`Categoría ${label}: solo jugadores de categoría ${i + 1}${i < 7 ? ` o ${i + 2} jugando hacia arriba` : ''}.`),
  categories: i < 7 ? [i + 1, i + 2] : [8],
  sex: null,
  sumTarget: null,
  maxPairs: 16,
  format: 'zonas'
}));

// ---- Plantillas por sexo ----
const sexTemplates: TournamentTemplate[] = ([
  { key: 'masc', name: 'Torneo Masculino', sex: 'M' },
  { key: 'fem', name: 'Torneo Femenino', sex: 'F' },
  { key: 'mixto', name: 'Torneo Mixto', sex: 'X' }
] satisfies Pick<TournamentTemplate, 'key' | 'name' | 'sex'>[]).map(t => ({
  ...t,
  rules: BASE_RULES(t.key === 'mixto' ? 'Parejas mixtas: un jugador de cada sexo.' : ''),
  categories: [1, 2, 3, 4, 5, 6, 7, 8],
  sumTarget: null,
  maxPairs: 16,
  format: 'zonas' as const
}));

// ---- Plantillas suma (10 a 18) ----
const sumTemplates: TournamentTemplate[] = Array.from({ length: 9 }, (_, i) => {
  const s = i + 10;
  return {
    key: `suma_${s}`,
    name: `Torneo Suma ${s}`,
    rules: BASE_RULES(
      `Suma ${s}: la suma de categorías de la pareja debe ser ${s} o más.
Ejemplo válido: categoría ${Math.floor(s / 2)} + categoría ${Math.ceil(s / 2)} = ${s}.`
    ),
    categories: [1, 2, 3, 4, 5, 6, 7, 8],
    sex: null,
    sumTarget: s,
    maxPairs: 16,
    format: 'zonas' as const
  };
});

export const TEMPLATES: TournamentTemplate[] = [
  ...categoryTemplates, ...sexTemplates, ...sumTemplates
];

export const getTemplate = (key: string) => TEMPLATES.find(t => t.key === key);

// ---- Validación de pareja ----
export function validatePair(
  t: { sum_target: number | null; sum_exact: boolean; categories: number[]; sex: Sex | null },
  p1: { category: number; sex: Sex }, p2: { category: number; sex: Sex }
): { ok: boolean; error?: string } {
  if (t.sum_target) {
    const sum = p1.category + p2.category;
    if (t.sum_exact && sum !== t.sum_target)
      return { ok: false, error: `La suma de la pareja es ${sum}, debe ser exactamente ${t.sum_target}.` };
    if (!t.sum_exact && sum < t.sum_target)
      return { ok: false, error: `La suma de la pareja es ${sum}, debe ser ${t.sum_target} o más.` };
  }
  if (t.categories.length && (!t.categories.includes(p1.category) || !t.categories.includes(p2.category)))
    return { ok: false, error: 'Alguno de los jugadores no está en las categorías permitidas.' };
  if (t.sex === 'M' && (p1.sex !== 'M' || p2.sex !== 'M'))
    return { ok: false, error: 'Torneo masculino: ambos jugadores deben ser masculinos.' };
  if (t.sex === 'F' && (p1.sex !== 'F' || p2.sex !== 'F'))
    return { ok: false, error: 'Torneo femenino: ambas jugadoras deben ser femeninas.' };
  if (t.sex === 'X' && p1.sex === p2.sex)
    return { ok: false, error: 'Torneo mixto: la pareja debe tener un jugador de cada sexo.' };
  return { ok: true };
}

// ---- Generador de fixture ----
export interface FixtureMatch {
  round: string; pair1_id: string | null; pair2_id: string | null; order_index: number;
}

/** Zonas de 3-4 parejas (round robin interno) + cruces eliminatorios entre primeros. */
export function generateZonesFixture(pairIds: string[]): { zones: Record<string, string[]>; matches: FixtureMatch[] } {
  const shuffled = [...pairIds].sort(() => Math.random() - 0.5);
  const zoneCount = Math.max(1, Math.ceil(shuffled.length / 4));
  const zones: Record<string, string[]> = {};
  shuffled.forEach((id, i) => {
    const z = String.fromCharCode(65 + (i % zoneCount)); // A, B, C...
    (zones[z] ||= []).push(id);
  });

  const matches: FixtureMatch[] = [];
  let idx = 0;
  // round robin dentro de cada zona
  for (const [z, ids] of Object.entries(zones))
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++)
        matches.push({ round: `Zona ${z}`, pair1_id: ids[i], pair2_id: ids[j], order_index: idx++ });

  // cruces: se completan cuando terminan las zonas (pares en null)
  const qualified = Object.keys(zones).length * 2; // clasifican 1° y 2°
  const rounds = qualified >= 8 ? ['Cuartos', 'Semifinal', 'Final']
               : qualified >= 4 ? ['Semifinal', 'Final'] : ['Final'];
  for (const r of rounds) {
    const n = r === 'Cuartos' ? 4 : r === 'Semifinal' ? 2 : 1;
    for (let i = 0; i < n; i++)
      matches.push({ round: r, pair1_id: null, pair2_id: null, order_index: idx++ });
  }
  return { zones, matches };
}

/** Eliminación simple con byes hasta la potencia de 2 más cercana. */
export function generateKnockoutFixture(pairIds: string[]): FixtureMatch[] {
  const shuffled = [...pairIds].sort(() => Math.random() - 0.5);
  const size = 2 ** Math.ceil(Math.log2(Math.max(2, shuffled.length)));
  const slots: (string | null)[] = [...shuffled, ...Array(size - shuffled.length).fill(null)];
  const roundName = (n: number) =>
    n === 2 ? 'Final' : n === 4 ? 'Semifinal' : n === 8 ? 'Cuartos' : `Ronda de ${n}`;

  const matches: FixtureMatch[] = [];
  let idx = 0;
  for (let i = 0; i < size; i += 2)
    matches.push({ round: roundName(size), pair1_id: slots[i], pair2_id: slots[i + 1], order_index: idx++ });
  for (let n = size / 2; n >= 2; n /= 2)
    for (let i = 0; i < n / 2; i++)
      matches.push({ round: roundName(n), pair1_id: null, pair2_id: null, order_index: idx++ });
  return matches;
}

// ============================================================
// Constructor de torneos combinables:
// Tipo (categoría 1-8 | suma 10-18 | libre)  ×  Sexo (M | F | Mixto | Abierto)
// ============================================================
export interface TournamentConfig {
  name: string; rules: string; categories: number[];
  sex: Sex | null; sumTarget: number | null;
}

const SEX_LABEL: Record<string, string> = { M: 'Masculino', F: 'Femenino', X: 'Mixto' };

export function buildTournamentConfig(opts: {
  tipo: 'libre' | 'cat' | 'suma';
  cat?: number;          // 1..8 si tipo = cat
  suma?: number;         // 10..18 si tipo = suma
  sexo: Sex | null;      // null = abierto
}): TournamentConfig {
  const { tipo, cat = 4, suma = 13, sexo } = opts;
  const sexPart = sexo ? ` ${SEX_LABEL[sexo]}` : '';

  if (tipo === 'cat') {
    const label = ORD[cat - 1];
    return {
      name: `Torneo ${label}${sexPart}`,
      rules: BASE_RULES(
        `Categoría ${label}: jugadores de categoría ${cat}${cat < 8 ? ` o ${cat + 1} jugando hacia arriba` : ''}.` +
        (sexo === 'X' ? '\nParejas mixtas: un jugador de cada sexo.' : '')
      ),
      categories: cat < 8 ? [cat, cat + 1] : [8],
      sex: sexo, sumTarget: null
    };
  }
  if (tipo === 'suma') {
    return {
      name: `Torneo Suma ${suma}${sexPart}`,
      rules: BASE_RULES(
        `Suma ${suma}: la suma de categorías de la pareja debe ser ${suma} o más.\n` +
        `Ejemplo válido: categoría ${Math.floor(suma / 2)} + categoría ${Math.ceil(suma / 2)} = ${suma}.` +
        (sexo === 'X' ? '\nParejas mixtas: un jugador de cada sexo.' : '')
      ),
      categories: [1, 2, 3, 4, 5, 6, 7, 8],
      sex: sexo, sumTarget: suma
    };
  }
  return {
    name: `Torneo Abierto${sexPart}`,
    rules: BASE_RULES(sexo === 'X' ? 'Parejas mixtas: un jugador de cada sexo.' : 'Abierto a todas las categorías.'),
    categories: [1, 2, 3, 4, 5, 6, 7, 8],
    sex: sexo, sumTarget: null
  };
}
