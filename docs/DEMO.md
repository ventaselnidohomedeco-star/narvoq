# 🧪 Modo Demo — Simulación de 6 meses en San Miguel del Monte

Ejecutá `supabase/demo-data.sql` en el SQL Editor (tarda 1-2 minutos).
Al final muestra una tabla resumen con todo lo creado.

## Qué genera
- **6 complejos** con canchas (2 a 4 c/u), precios, horarios, logo y servicios:
  Monte Pádel Club · El Muro Pádel · La Cantera Pádel · Pádel del Parque · X3 Pádel Monte · Las Palmeras Pádel
- **40 jugadores** con categoría (2 a 8), sexo, edad, paleta, lado, bio y avatar.
- **~3.000 reservas** repartidas en 180 días + reservas futuras (próximos 6 días).
- **~1.500 partidos con resultado validado** → el ranking se calculó de verdad, con el trigger real.
- **8 torneos** (6 finalizados con campeones y puntos, 2 con inscripción abierta).
- **Feed vivo**: posts de jugadores y complejos, likes, comentarios, campeones, promos.
- **Cientos de entrenamientos** con profesor y objetivos.

## Cuentas de prueba (contraseña de todas: `demo123`)
| Rol | Email | Entra por |
|---|---|---|
| Jugador | jugador01@demo.com … jugador40@demo.com | /login |
| Complejo | complejo1@demo.com … complejo6@demo.com | /complejo/login |

## Recorrido de prueba sugerido (15 min)
1. **complejo1@demo.com** → Dashboard: ocupación e ingresos reales · Calendario con reservas y fotos · Clientes: facturación por mes y jugadores frecuentes.
2. **jugador01@demo.com** → Dashboard con stats reales · Ranking (filtrá por categoría y sexo) · Feed con 6 meses de actividad · Reservas → Próximas y Cargar resultado.
3. Inscribí una pareja en un torneo abierto y generá el fixture desde el complejo.
4. Compartí una placa JPG de resultado o ranking.

## Para borrar la demo y arrancar limpio
```sql
delete from complexes;  -- borra en cascada canchas, reservas, torneos...
delete from profiles where username like 'jugador%' or username like 'complejo%';
delete from auth.users where email like '%@demo.com';
```
