import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

// POST /api/push/send
// Body: { notification_id: string }
// Llamado por el trigger de la DB cuando se inserta una notificación.
// Envía la push a todas las suscripciones del usuario destinatario.
export async function POST(req: NextRequest) {
  try {
    // Validación básica (el trigger manda un secret compartido)
    const secret = req.headers.get('x-webhook-secret');
    if (process.env.PUSH_WEBHOOK_SECRET && secret !== process.env.PUSH_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const { notification_id } = await req.json();
    if (!notification_id) return NextResponse.json({ error: 'notification_id requerido' }, { status: 400 });

    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const contact = process.env.VAPID_CONTACT ?? 'mailto:ventas.elnidohomedeco@gmail.com';
    if (!publicKey || !privateKey) return NextResponse.json({ error: 'VAPID keys no configuradas' }, { status: 500 });
    webpush.setVapidDetails(contact, publicKey, privateKey);

    // Cliente con service_role (bypasea RLS)
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Traer la notificación
    const { data: notif } = await admin.from('notifications')
      .select('id, user_id, kind, title, body, link')
      .eq('id', notification_id).maybeSingle();
    if (!notif) return NextResponse.json({ error: 'notif no encontrada' }, { status: 404 });

    // Traer suscripciones del usuario
    const { data: subs } = await admin.from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', notif.user_id);
    if (!subs || subs.length === 0) return NextResponse.json({ ok: true, sent: 0 });

    const payload = JSON.stringify({
      title: notif.title,
      body: notif.body ?? '',
      link: notif.link ?? '/',
      kind: notif.kind,
      ref_id: notif.id
    });

    let sent = 0, failed = 0;
    const stale: string[] = [];

    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification({
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth }
        }, payload);
        sent++;
      } catch (err: any) {
        failed++;
        // 404 / 410 = suscripción muerta, la borramos
        if (err.statusCode === 404 || err.statusCode === 410) stale.push(s.id);
      }
    }));

    if (stale.length > 0) {
      await admin.from('push_subscriptions').delete().in('id', stale);
    }

    return NextResponse.json({ ok: true, sent, failed, stale: stale.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
