// Textos canónicos de las features que se muestran en las tarjetas de /planes.
// Se usan como override si el plan de la DB no tiene features cargados o si
// preferís mantener el copy centralizado acá (recomendado).

export const FREE_FEATURES: Record<'player' | 'coach' | 'complex_admin', string[]> = {
  player: [
    'Reservar canchas (5 días de anticipación)',
    'Ver ranking (top 30)',
    'Jugar amistosos y torneos',
    'Ver el feed de la comunidad',
    'Publicar 1 vez por semana en el feed',
    'Recibir y responder mensajes en Smashe@',
    'Comprar en el Marketplace'
  ],
  coach: [
    'Perfil público con disponibilidad y tarifas',
    'Hasta 10 alumnos',
    'Recibir consultas de jugadores'
  ],
  complex_admin: [
    'Perfil público del club',
    'Hasta 4 canchas',
    '1 torneo activo simultáneo',
    'Calendario de reservas'
  ]
};

export const PREMIUM_FEATURES: Record<'player' | 'coach' | 'complex_admin', string[]> = {
  player: [
    'Badge NarvoQ Verificado',
    'Reservar canchas hasta 15 días de anticipación',
    'Buscador inteligente de canchas libres por zona y horario',
    'Ver ranking sin límite',
    'Publicar sin límite en el Feed',
    'Iniciar chats con cualquiera en Smashe@',
    'Fotos ilimitadas en Smashe@',
    'Estadísticas del juego (winrate, evolución, gráficos)',
    'Comparar tus stats con amigos',
    'Publicar en el Marketplace'
  ],
  coach: [
    'Badge NarvoQ Verificado',
    'Alumnos ilimitados',
    'Crear torneos ilimitados',
    'Academia: vender clases y packs a jugadores',
    'Estadísticas avanzadas'
  ],
  complex_admin: [
    'Badge NarvoQ Verificado',
    'Canchas ilimitadas',
    'Torneos activos ilimitados',
    'Empleados con roles',
    'Publicar promos al feed público',
    'Membresías y socios con cobro mensual',
    'CRM completo (POS, productos, clientes, ventas)',
    'Reportes financieros y rentabilidad',
    'Estadísticas Premium del negocio',
    'Cobro automático de seña con Mercado Pago'
  ]
};
