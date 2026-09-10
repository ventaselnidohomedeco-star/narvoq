import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

type CookieToSet = { name: string; value: string; options?: any };

// GET /api/push/resend?id=<notification_id> — reenvía una notif específica.
// Sirve para diagnosticar por qué el trigger de la DB no la disparó.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'falta ?id=<notification_id>' }, { status: 400 });

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

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: notif } = await admin.from('notifications').select('*').eq('id', id).maybeSingle();
  if (!notif) return NextResponse.json({ error: 'notif no encontrada' }, { status: 404 });
  if (notif.user_id !== user.id) return NextResponse.json({ error: 'esta notif es para otro user' }, { status: 403 });

  const { data: subs } = await admin.from('push_subscriptions')
    .select('id, endpoint, p256dh, auth').eq('user_id', notif.user_id);

  if (!subs || subs.length === 0) {
    return NextResponse.json({ error: 'sin suscripciones push activas', notif });
  }

  webpush.setVapidDetails(
    process.env.VAPID_CONTACT ?? 'mailto:ventas.elnidohomedeco@gmail.com',
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const results: any[] = [];
  for (const s of subs) {
    try {
      const r = await webpush.sendNotification({
        endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth }
      }, JSON.stringify({
        title: notif.title, body: notif.body ?? '', link: notif.link ?? '/',
        kind: notif.kind, ref_id: notif.id, silent: false
      }));
      results.push({ subId: s.id.slice(0, 8), status: r.statusCode });
    } catch (e: any) {
      results.push({ subId: s.id.slice(0, 8), error: e.statusCode + ' ' + e.message });
    }
  }

  return NextResponse.json({ ok: true, notif: { kind: notif.kind, title: notif.title }, results });
}
