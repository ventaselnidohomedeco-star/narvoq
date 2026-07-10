# PadelApp — Análisis y Definición del MVP
**Ciudad piloto:** San Miguel del Monte, Buenos Aires, Argentina

---

## 1. Análisis de la idea

**Fortalezas**
- El pádel en Argentina está en pleno boom y los complejos de ciudades chicas gestionan reservas por WhatsApp y planillas. El dolor es real.
- Un pueblo chico es el laboratorio perfecto: pocos complejos (2–4), comunidad cerrada, el boca a boca funciona.
- El diferencial no es "reservar cancha" (eso ya existe: Atleta, Playtomic). El diferencial es **la capa social + ranking local + torneos suma**, que es cómo se juega realmente en el interior.

**Riesgo central:** problema de huevo y gallina. Sin complejos no hay jugadores; sin jugadores el complejo no ve valor. La estrategia de validación (punto 12) ataca esto.

**Tesis del MVP:** si en 60 días un complejo de Monte gestiona el 50% de sus turnos por la app y corre 1 torneo suma completo con fixture generado automáticamente, la idea está validada.

## 2. MVP (lo que se construye ahora)

| Módulo | Alcance MVP |
|---|---|
| Auth | Registro/login único con roles: jugador, admin de complejo, super admin |
| Complejos | Perfil, canchas, horarios, duración de turno, precio, bloqueos |
| Reservas | Grilla de disponibilidad por cancha, reservar, cancelar según regla del complejo |
| Partidos | Link de invitación, 4 cupos, lista de espera, nivel promedio |
| Torneos | Plantillas pre-seteadas (categoría + suma), inscripción de parejas, validación de suma, fixture por zonas + cruces |
| Resultados | Carga por jugador, validación por complejo |
| Ranking | Motor de puntos con variables editables por complejo; ranking por complejo, ciudad, categoría, sexo y general |
| Feed | Publicaciones automáticas y manuales, likes, comentarios |
| Placas JPG | Generadas en el navegador (Canvas): reserva, busco jugador, resultado, campeones, ranking |
| Dashboard jugador | Partidos J/G/P, próximos partidos, torneos, ranking, entrenamientos |
| Entrenamientos | Carga simple: tipo, fecha, duración, notas |

## 3. Queda para V2

- Pagos online (Mercado Pago) y señas.
- App nativa / notificaciones push (el MVP es PWA-ready).
- Buscador inteligente de partidos con matching automático (en MVP: sugerencias simples por categoría ±1 en la misma ciudad).
- Chat interno (en MVP se usa WhatsApp con links).
- Promociones automáticas por baja ocupación (en MVP: publicación manual de promos).
- Formatos Round Robin y Liga completos (MVP: eliminación simple y zonas + cruces, que cubren el 90% de los torneos reales).
- Etiquetado avanzado en feed, compartir nativo, stories.
- Panel completo de super admin (MVP: gestión por SQL/Supabase Studio + flags básicos).
- Multi-idioma, multi-moneda.

## 4. Arquitectura recomendada

```
Cliente (PWA mobile-first)
  Next.js 14 App Router + Tailwind
        │ supabase-js (RLS aplica permisos por rol)
        ▼
Supabase
  ├── Auth (email/celular+password, JWT con rol en profile)
  ├── Postgres (modelo relacional, abajo)
  ├── Row Level Security (jugador ve lo suyo, complejo lo suyo)
  ├── Storage (logos, fotos, imágenes de feed)
  └── Edge Functions (v2: notificaciones, cron de promos)

Hosting: Vercel (frontend) + Supabase cloud (free tier alcanza para el piloto)
Placas JPG: Canvas API en el cliente → sin costo de servidor
```

**Por qué así:** relacional (reservas/torneos/ranking son joins puros), RLS elimina un backend propio, todo el stack es gratis hasta ~10k usuarios, y Next.js permite server components para SEO de complejos públicos.

## 5–6. Modelo de datos y tablas

Ver `supabase/schema.sql` (ejecutable). Resumen de tablas:

`cities` → `complexes` → `courts` → `bookings` → `matches` → `match_players`
`profiles` (rol + categoría 1-8), `tournaments` ← plantillas en `src/lib/torneos/plantillas.ts`, `tournament_pairs`, `tournament_matches`, `results`, `ranking_rules` (variables editables), `ranking_points` (ledger de puntos), `trainings`, `posts`, `post_likes`, `post_comments`, `waitlist`.

Decisiones clave del modelo:
- **Disponibilidad calculada, no almacenada:** slots = horarios del complejo − reservas − bloqueos. Evita sincronización.
- **Ranking como ledger:** cada evento (partido ganado, torneo, ausencia) inserta una fila en `ranking_points` con la regla aplicada. El ranking es un `SUM` agrupado → auditable y recalculable si cambian las reglas.
- **Bloqueos = reservas** con `type='block'`, misma lógica de colisión.

## 7. Flujos principales

1. **Reserva:** ciudad → complejo → cancha/fecha → grilla de slots → confirmar → se crea `booking(pendiente)` + `match` → link `/partido/{id}` para compartir → 4/4 jugadores = `completa` → jugada → resultado.
2. **Invitación:** el link abre la ficha del partido; si no está logueado, registro rápido y vuelve al partido; se suma si hay cupo y su categoría entra en el rango; si no hay cupo → lista de espera.
3. **Torneo:** complejo elige plantilla (ej. "Suma 13 Mixto") → sistema precarga nombre, reglamento, cupos → publica → parejas se inscriben (valida suma) → cupo lleno → genera zonas y cruces → resultados → campeones → placa + feed + puntos de ranking.
4. **Resultado:** jugador carga sets → estado `pendiente` → complejo valida → impacta ranking + historial + feed.

## 8. Pantallas (MVP = 18 pantallas)

**Público:** Landing, Login, Registro jugador, Ficha de partido (link compartido), Perfil público de complejo.
**Jugador:** Dashboard, Reservar (ciudad→complejo→grilla), Mis partidos, Torneos (lista + inscripción), Ranking, Feed, Entrenamientos, Perfil.
**Complejo:** Login/registro propio, Dashboard (ocupación hoy), Canchas y horarios, Calendario de reservas, Torneos (crear desde plantilla + fixture), Validar resultados, Reglas de ranking.

## 9. Reglas de ranking (valores por defecto, editables por complejo)

| Variable | Puntos default |
|---|---|
| Partido ganado | +10 |
| Partido perdido | +3 (premia jugar) |
| Torneo jugado | +15 |
| Campeón | +100 |
| Finalista | +60 |
| Semifinalista | +35 |
| Diferencia de sets | +2 por set |
| Bonus vs. categoría superior | +5 |
| Bonus participación mensual (≥4 partidos) | +10 |
| Ausencia sin aviso | −15 |

Ranking general = suma de puntos en todos los complejos. Se filtra por complejo, ciudad, categoría y sexo con la misma tabla ledger.

## 10. Reglas de torneos

- **Plantillas:** por categoría (1ra a 8va), por sexo (M/F/Mixto) y por suma (10 a 18). Cada plantilla define nombre sugerido, reglamento base, categorías permitidas, sexo, parejas mín/máx.
- **Suma:** `cat(jugador A) + cat(jugador B)` debe ser **≥ suma del torneo** (una pareja 6+7=13 puede jugar Suma 13; una 5+6=11 no, porque sería superior). Configurable a "exacta" por torneo.
- **Formatos:** eliminación simple (4/8/16 parejas) y zonas de 3-4 + cruces. El fixture se genera al cerrar inscripción; horarios y canchas se asignan desde los slots libres del complejo.
- **Estados:** borrador → inscripción abierta → cupo completo → en juego → finalizado.

## 11. Riesgos

1. **Adopción de complejos** (el admin es señor de 50 años con WhatsApp): el panel debe ser más simple que la planilla. Mitigación: onboarding presencial, carga inicial hecha por vos.
2. **Doble reserva** (canal WhatsApp sigue vivo): el complejo debe poder bloquear/cargar reservas manuales en 2 taps.
3. **Datos truchos en ranking:** validación del complejo obligatoria para que un resultado sume puntos.
4. **Competencia** (Playtomic/Atleta): no competir en reservas, ganar en comunidad local + torneos suma.
5. **Costo cero pero tiempo alto:** limitar el MVP a lo listado; todo lo demás es v2.
6. **Estacionalidad y masa crítica chica** en Monte: medir % de ocupación gestionada, no usuarios totales.

## 12. Validación en San Miguel del Monte (plan 90 días)

- **Semana 1–2:** cerrar 1 complejo ancla (gratis 6 meses a cambio de feedback). Cargarle vos las canchas, horarios y precios.
- **Semana 3–4:** migrar sus reservas de WhatsApp: el complejo responde "reservá acá" con el link. Placas JPG como caballo de Troya viral (cada reserva/resultado compartido en historias trae jugadores).
- **Mes 2:** primer torneo Suma 13 gestionado 100% por la app. Fixture automático como demo pública.
- **Mes 3:** activar ranking del pueblo → pelea de ego local = retención. Sumar 2° complejo con el argumento "tus competidores ya están".
- **Métricas de éxito:** ≥50% de turnos del complejo ancla por la app, ≥100 jugadores registrados (Monte tiene ~25k hab.), 1 torneo completo, ≥30% de partidos con resultado cargado.
- **Luego:** replicar el playbook en ciudades vecinas (Lobos, Cañuelas, Roque Pérez) con un "embajador" local por ciudad.
