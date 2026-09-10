import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

type CookieToSet = { name: string; value: string; options?: any };

// POST /api/push/test — el usuario logueado se envía una push a sí mismo.
// Sirve para diagnosticar: si esto llega, todo funciona. Si no, ver logs Vercel.
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

  const { data: notif, error } = await supabase.from('notifications').insert({
    user_id: user.id,
    kind: 'test',
    title: '🔔 Prueba de notificación',
    body: 'Si ves esto en tu celular con sonido, todo anda ✅',
    link: '/jugador/dashboard'
  }).select('id').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: subs } = await supabase.from('push_subscriptions')
    .select('id').eq('user_id', user.id);

  return NextResponse.json({
    ok: true,
    notification_id: notif.id,
    subscriptions_count: subs?.length ?? 0,
    hint: subs && subs.length > 0
      ? 'Notificación insertada. El trigger debería disparar el push. Revisá los logs de /api/push/send en Vercel si no llega.'
      : '⚠️ No hay suscripciones push activas para este usuario. Activá el botón "🔔 Notificaciones" en tu perfil primero.'
  });
}
