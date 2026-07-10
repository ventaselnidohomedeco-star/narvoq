# Narvoq

**Elevate your game. Elevate your life.**

Plataforma web mobile-first para jugadores, complejos y profes de pádel.

## Stack
- **Next.js 14** (App Router) + **TypeScript** + **Tailwind**
- **Supabase**: Postgres + Auth + RLS + Storage
- Placas JPG generadas en el navegador con Canvas (sin servidor)
- PWA-ready (manifest incluido)

## Roles
- **Jugador** — reservas, torneos, ranking, entrenamientos, feed social.
- **Complejo** — canchas, calendario, torneos, membresías, dashboard.
- **Profe / Training** — dashboard por alumno + del grupo, entrenamientos compartibles.
- **Super admin** — panel `/admin`: banners linkeables, promos globales, métricas.

## Variables de entorno
```
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU_ANON_KEY
```

## Correr local
```bash
npm install
npm run dev            # solo tu PC
npm run dev:mobile     # accesible desde otros dispositivos de la LAN
```

## Correr las migraciones en Supabase
Ejecutar en el SQL Editor, en este orden (una única vez cada uno):
```
supabase/schema.sql
supabase/seed.sql
supabase/update-01-fotos.sql
supabase/update-02-panel.sql
supabase/update-03-social.sql
supabase/update-04-completo.sql
supabase/update-05-ranking.sql
supabase/update-06-pro.sql
supabase/update-07-banners.sql
supabase/update-08-pagos-entrenamientos.sql
supabase/update-09-training.sql
```

## Deploy
- **Vercel**: importá el repo, cargá las dos variables de entorno, deploy.
- Cada `git push` reconstruye la app en producción automáticamente.

## Assets de marca
Guardar los archivos de logo en:
- `public/brand/logo.png` — imagotipo completo (paleta + wordmark)
- `public/brand/isotipo.png` — solo la paleta (usado como favicon PWA)
