import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPreApproval } from '@/lib/mercadopago';

// POST /api/mp/webhook
// MP nos avisa acá cuando cambia el estado de una PreApproval o cuando
// se cobra una cuota. Actualizamos la fila en `subscriptions`.
//
// IMPORTANTE: Este endpoint NO usa la sesión del usuario. MP no manda
// cookies. Usamos service_role key para poder escribir sin RLS.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const url = new URL(req.url);

    // MP envía dos formatos según el tipo de notificación:
    //  - Query params: ?topic=preapproval&id=xxx
    //  - Body JSON: { type: "preapproval" | "authorized_payment", data: { id } }
    const topic = url.searchParams.get('topic') ?? url.searchParams.get('type') ?? body.type;
    const resourceId = url.searchParams.get('id') ?? body.data?.id ?? body.resource;

    // eslint-disable-next-line no-console
    console.log('[MP webhook]', { topic, resourceId });

    if (!topic || !resourceId) {
      return NextResponse.json({ ok: true, ignored: 'sin topic o id' });
    }

    // Si es un pago normal (checkout preferences → reservas), delegamos al handler de bookings
    if (topic === 'payment' || topic === 'payments') {
      const base = new URL(req.url).origin;
      try {
        await fetch(`${base}/api/mp/webhook-booking`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'payment', data: { id: resourceId } })
        });
      } catch (e: any) {
        console.error('[MP webhook] delegar a booking falló:', e.message);
      }
      return NextResponse.json({ ok: true, delegated_to: 'webhook-booking' });
    }

    // Solo nos importan preapprovals (suscripciones). authorized_payment es cada cobro periódico.
    if (topic !== 'preapproval' && topic !== 'subscription_preapproval') {
      return NextResponse.json({ ok: true, ignored: `topic ${topic} no manejado` });
    }

    // Traer datos frescos de MP
    const pa = await getPreApproval(String(resourceId));
    if (!pa) return NextResponse.json({ error: 'preapproval no encontrado en MP' }, { status: 404 });

    const externalRef = pa.external_reference;  // = subscription.id
    const status = pa.status;   // pending | authorized | paused | cancelled

    if (!externalRef) {
      return NextResponse.json({ ok: true, ignored: 'sin external_reference' });
    }

    // Mapeo status MP → status nuestro
    const ourStatus =
      status === 'authorized' ? 'active' :
      status === 'paused' ? 'past_due' :
      status === 'cancelled' ? 'cancelled' :
      'pending';

    // Cliente admin (bypass RLS)
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Actualizar suscripción
    const updates: any = {
      status: ourStatus,
      mp_preapproval_id: pa.id
    };
    if (ourStatus === 'cancelled') {
      updates.cancelled_at = new Date().toISOString();
    }
    if (pa.next_payment_date) {
      // MP a veces devuelve next_payment_date antes del período completo (prorrateo
      // del primer cobro). Usamos el MÁXIMO entre nuestra fecha original y la de MP
      // para no acortar la suscripción del usuario.
      const { data: current } = await admin.from('subscriptions')
        .select('expires_at').eq('id', externalRef).maybeSingle();
      const currentExp = current?.expires_at ? new Date(current.expires_at) : null;
      const mpExp = new Date(pa.next_payment_date);
      updates.expires_at = (currentExp && currentExp > mpExp ? currentExp : mpExp).toISOString();
    }

    const { error } = await admin.from('subscriptions').update(updates).eq('id', externalRef);
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[MP webhook] update error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, status: ourStatus });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('[MP webhook] exception', e);
    // Devolvemos 200 para que MP no siga reintentando por errores nuestros
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 });
  }
}

// GET para que MP pueda hacer health-check al configurar el webhook
export async function GET() {
  return NextResponse.json({ ok: true, service: 'NarvoQ MP webhook' });
}
