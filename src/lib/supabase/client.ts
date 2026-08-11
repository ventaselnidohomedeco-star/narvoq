'use client';
import { createBrowserClient } from '@supabase/ssr';

// Cookies de auth: duración explícita larga para que persistan aunque el
// navegador cierre. Por default @supabase/ssr suele hacerlo bien, pero en
// algunos móviles / PWAs las cookies "sin maxAge" se tratan como session-only
// y se borran al cerrar la app. Con esto forzamos persistencia real.
const ONE_YEAR = 60 * 60 * 24 * 365;

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookieOptions: {
      maxAge: ONE_YEAR,
      sameSite: 'lax',
      secure: true,
      path: '/'
    }
  }
);
