// Límites free vs premium por rol. Fuente única de verdad para toda la app.
// Cambiar acá cambia el enforcement en TODAS las pantallas.

export const FREE_LIMITS = {
  player: {
    // Plan Free MÍNIMO: perfil visible (sin stats), reservar canchas,
    // tabla de posiciones, jugar amistosos y torneos. Todo lo demás es premium.
    reservation_days_ahead: 7,          // vs premium: 30
    ranking_top_visible: 100,            // vs premium: sin límite
    smash_history_hours: 24,             // vs premium: 720 (30 días)
    smash_photos_per_chat: 5,            // vs premium: ilimitado
    stats_visible: false,                // vs premium: true (dashboard con winrate, gráficos, evolución)
    activity_charts: false,              // vs premium: true (gráficos temporales)
    friends_advanced: false,             // vs premium: true (comparar stats con amigos, sugerencias)
    marketplace_publish: false           // vs premium: true (publicar en marketplace)
  },
  coach: {
    students_max: 10,                    // vs premium: ilimitado
    tournaments_active_max: 0,           // vs premium: ilimitado (0 = no puede crear)
    academy_enabled: false               // vs premium: true
  },
  complex_admin: {
    courts_max: 4,                       // vs premium: ilimitado
    tournaments_active_max: 1,           // vs premium: ilimitado
    employees_max: 0,                    // vs premium: ilimitado (0 = no puede crear)
    promos_to_feed: false,               // vs premium: true
    financial_reports: false,            // vs premium: true (rentabilidad)
    memberships: false,                  // vs premium: true
    mp_auto_charge: false                // vs premium: true (cobro automático)
  }
} as const;

export type Role = keyof typeof FREE_LIMITS;
export type FeatureKey<R extends Role> = keyof typeof FREE_LIMITS[R];

// Info humana de cada feature (para mostrar en el gate).
export const FEATURE_INFO: Record<string, { title: string; description: string }> = {
  courts_max: {
    title: 'Canchas ilimitadas',
    description: 'Tu plan Free permite hasta 3 canchas. Con Premium podés cargar todas las que quieras.'
  },
  students_max: {
    title: 'Alumnos ilimitados',
    description: 'Tu plan Free permite hasta 10 alumnos. Con Premium podés registrar todos los que quieras.'
  },
  tournaments_active_max: {
    title: 'Torneos ilimitados',
    description: 'Podés crear más torneos suscribiéndote a Premium.'
  },
  employees_max: {
    title: 'Empleados con roles',
    description: 'Delegá el trabajo de recepción a empleados con permisos limitados. Disponible en Premium.'
  },
  promos_to_feed: {
    title: 'Publicar promos al feed',
    description: 'Hacé que tus promociones lleguen a todos los jugadores de la zona en el feed público. Solo Premium.'
  },
  financial_reports: {
    title: 'Reportes financieros',
    description: 'Ingresos por cancha, horario y día. Análisis de rentabilidad completo. Solo Premium.'
  },
  memberships: {
    title: 'Membresías y socios',
    description: 'Cobrá cuotas mensuales automáticas a tus socios con beneficios. Solo Premium.'
  },
  mp_auto_charge: {
    title: 'Cobro automático MP',
    description: 'Cobrá la seña de reserva automáticamente al momento del turno. Solo Premium.'
  },
  academy_enabled: {
    title: 'Academia (marketplace de clases)',
    description: 'Vendé clases individuales o packs a jugadores que buscan profe. Solo Premium.'
  },
  reservation_days_ahead: {
    title: 'Reservas con 30 días de anticipación',
    description: 'Free: solo hasta 7 días adelante. Premium: 30 días adelante.'
  },
  stats_visible: {
    title: 'Estadísticas de tu juego',
    description: 'Winrate, partidos ganados/perdidos, evolución técnica y gráficos de tu rendimiento. Solo Premium.'
  },
  activity_charts: {
    title: 'Gráficos de actividad',
    description: 'Ver tu evolución mes a mes, tendencias y análisis detallado. Solo Premium.'
  },
  friends_advanced: {
    title: 'Comparar con amigos',
    description: 'Ver stats de tus amigos, comparar y sugerencia de compañero. Solo Premium.'
  },
  marketplace_publish: {
    title: 'Vender en Marketplace',
    description: 'Podés comprar en el marketplace desde el plan Free. Para publicar tus propias paletas/ropa/accesorios necesitás Premium.'
  }
};

// Chequeo simple: dado un rol, feature y cantidad actual, ¿puede hacer más?
export function canAddMore(role: Role, feature: string, current: number, isPremium: boolean): boolean {
  if (isPremium) return true;
  const limits = FREE_LIMITS[role] as Record<string, any>;
  const max = limits[feature];
  if (typeof max !== 'number') return true;
  return current < max;
}

export function getLimit(role: Role, feature: string): number | boolean | undefined {
  const limits = FREE_LIMITS[role] as Record<string, any>;
  return limits[feature];
}
