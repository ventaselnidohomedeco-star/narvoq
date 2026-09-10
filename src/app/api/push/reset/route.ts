import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

type CookieToSet = { name: string; value: string; options?: any };

// POST /api/push/reset — borra TODAS las suscripciones push del usuario logueado.
// Sirve cuando cambiaron las VAPID keys y la suscripción vieja está muerta (410).
export async function POST(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (all: CookieToSet[]) => all.forEach(({ name, value }) => req.cookies.set(name, value))
      }
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });

  const { error, count } = await supabase.from('push_subscriptions')
    .delete({ count: 'exact' }).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    deleted: count ?? 0,
    hint: 'Suscripciones borradas. Ahora andá a Perfil → Desactivar y volver a Activar notificaciones. La nueva suscripción se creará con las VAPID keys actuales.'
  });
}
