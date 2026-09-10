import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

type CookieToSet = { name: string; value: string; options?: any };

// GET /api/push/diagnose — reporta el estado de TODA la cadena de push.
// Solo para el super_admin.
export async function GET(req: NextRequest) {
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

  const report: any = { ok: true, checks: [] };
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. Env vars en Vercel
  report.checks.push({
    check: 'VAPID_PUBLIC_KEY presente',
    ok: !!process.env.VAPID_PUBLIC_KEY,
    detail: process.env.VAPID_PUBLIC_KEY ? process.env.VAPID_PUBLIC_KEY.slice(0, 20) + '...' : 'FALTA'
  });
  report.checks.push({
    check: 'VAPID_PRIVATE_KEY presente',
    ok: !!process.env.VAPID_PRIVATE_KEY,
    detail: process.env.VAPID_PRIVATE_KEY ? 'presente' : 'FALTA'
  });
  report.checks.push({
    check: 'NEXT_PUBLIC_VAPID_PUBLIC_KEY presente',
    ok: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    detail: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY.slice(0, 20) + '...' : 'FALTA'
  });
  report.checks.push({
    check: 'PUSH_WEBHOOK_SECRET presente',
    ok: !!process.env.PUSH_WEBHOOK_SECRET,
    detail: process.env.PUSH_WEBHOOK_SECRET ? 'presente' : 'FALTA'
  });

  // 2. VAPID keys son iguales public y NEXT_PUBLIC
  report.checks.push({
    check: 'VAPID_PUBLIC_KEY = NEXT_PUBLIC_VAPID_PUBLIC_KEY',
    ok: process.env.VAPID_PUBLIC_KEY === process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    detail: 'Deben ser IDÉNTICAS (el cliente firma con la public que ve, el server envía con la misma)'
  });

  // 3. Config en Supabase
  const { data: cfg } = await admin.from('app_config').select('key,value');
  const cfgMap = Object.fromEntries((cfg ?? []).map(c => [c.key, c.value]));
  report.checks.push({
    check: 'app_config.base_url en Supabase',
    ok: !!cfgMap.base_url,
    detail: cfgMap.base_url ?? 'FALTA — corré update-57'
  });
  report.checks.push({
    check: 'app_config.push_secret en Supabase',
    ok: !!cfgMap.push_secret,
    detail: cfgMap.push_secret ? 'presente' : 'FALTA — corré update-57'
  });
  report.checks.push({
    check: 'push_secret DB == PUSH_WEBHOOK_SECRET Vercel',
    ok: cfgMap.push_secret === process.env.PUSH_WEBHOOK_SECRET,
    detail: 'Deben ser IDÉNTICOS. Si no coincide, el /api/push/send devuelve 401 al trigger.'
  });

  // 4. Extensión pg_net habilitada
  const { data: exts } = await admin.rpc('sql_get_extensions').catch(() => ({ data: null }));
  // fallback: intentar detectar de otra forma
  const { data: hasPgNet } = await admin.from('pg_extension' as any)
    .select('extname').eq('extname', 'pg_net').maybeSingle().catch(() => ({ data: null }));

  // 5. Suscripciones del usuario actual
  const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, user_agent, created_at').eq('user_id', user.id);
  report.checks.push({
    check: 'Suscripciones push activas del usuario logueado',
    ok: (subs?.length ?? 0) > 0,
    detail: subs && subs.length > 0
      ? subs.map(s => `${s.user_agent?.slice(0, 40) ?? '?'} · ${s.endpoint.slice(0, 60)}...`).join(' | ')
      : 'FALTA — activá el botón 🔔 Notificaciones en tu perfil'
  });

  // 6. Intentar enviar una push real de prueba y capturar error
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && subs && subs.length > 0) {
    try {
      webpush.setVapidDetails(
        process.env.VAPID_CONTACT ?? 'mailto:ventas.elnidohomedeco@gmail.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      );
      const { data: sub } = await admin.from('push_subscriptions')
        .select('endpoint, p256dh, auth').eq('user_id', user.id).limit(1).single();
      const result = await webpush.sendNotification({
        endpoint: sub!.endpoint, keys: { p256dh: sub!.p256dh, auth: sub!.auth }
      }, JSON.stringify({
        title: '🔬 Diagnóstico push',
        body: 'Si escuchás esto, el push funciona. Si no llega, revisá los checks de arriba.',
        link: '/notificaciones', kind: 'diagnose', silent: false
      }));
      report.checks.push({
        check: 'Envío directo de push a este device',
        ok: true,
        detail: `HTTP ${result.statusCode} — el sistema envió la push correctamente. Si no la ves llegar, es problema del navegador/OS (permisos, DND, Battery Optimizer, etc.)`
      });
    } catch (e: any) {
      report.checks.push({
        check: 'Envío directo de push a este device',
        ok: false,
        detail: `❌ ${e.statusCode ?? ''} ${e.message ?? e}`
      });
    }
  }

  report.ok = report.checks.every((c: any) => c.ok);
  return NextResponse.json(report, { status: 200 });
}
