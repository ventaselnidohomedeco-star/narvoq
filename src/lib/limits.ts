// Límites free vs premium por rol. Fuente única de verdad para toda la app.
// Cambiar acá cambia el enforcement en TODAS las pantallas.

export const FREE_LIMITS = {
  player: {
    // Plan Free: perfil, reservar (5 días), ranking (top 30), jugar amistosos/torneos,
    // ver feed, publicar 1 post/semana, chatear si el otro le escribió primero,
    // comprar en marketplace. Iniciar chats, buscador de canchas, stats y publicar
    // en marketplace son Premium.
    reservation_days_ahead: 5,           // vs premium: 15
    ranking_top_visible: 30,             // vs premium: sin límite
    smash_history_hours: 24,             // vs premium: 720 (30 días)
    smash_photos_per_chat: 5,            // vs premium: ilimitado
    smash_can_initiate: false,           // vs premium: true (iniciar chats nuevos)
    feed_posts_per_week: 1,              // vs premium: ilimitado (0 = bloqueado, >0 = cupo semanal)
    court_finder: false,                 // vs premium: true (buscador de canchas libres por zona/día/hora)
    stats_visible: false,                // vs premium: true
    activity_charts: false,              // vs premium: true
    friends_advanced: false,             // vs premium: true
    marketplace_publish: false           // vs premium: true (comprar sí, publicar solo premium)
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
    title: 'Reservas con 15 días de anticipación',
    description: 'Free: hasta 5 días adelante. Premium: 15 días adelante.'
  },
  smash_can_initiate: {
    title: 'Iniciar chats en Smashe@',
    description: 'Free podés recibir y responder mensajes. Con Premium podés iniciar chats nuevos con cualquiera.'
  },
  feed_posts_per_week: {
    title: 'Publicar en el Feed sin límite',
    description: 'Free: 1 publicación por semana. Premium: publicá todo lo que quieras.'
  },
  court_finder: {
    title: 'Buscador de canchas libres',
    description: 'Encontrá canchas disponibles por zona, día y horario en un solo lugar, sin entrar complejo por complejo. Solo Premium.'
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
