import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPayment } from '@/lib/mp-marketplace';

// POST /api/mp/webhook-booking
// MP nos notifica cambios de pagos. Body típico:
//   { action: 'payment.updated', data: { id: '<payment_id>' } }
// o { type: 'payment', data: { id: '...' } }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const paymentId: string | undefined = body?.data?.id;
    const kindEvent: string | undefined = body?.type || body?.action;
    if (!paymentId || (kindEvent && !String(kindEvent).includes('payment'))) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    // Cliente con service_role (bypasea RLS — solo server)
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Buscar el pago pending por preference_id no sirve — MP nos da payment_id.
    // Solucion: primero traer el payment usando el token del complejo. Como
    // no sabemos qué complejo, guardamos el payment_id vs external_reference,
    // y con el external_reference ubicamos booking + complex.
    // Estrategia: intentar con cada mp_access_token que tenga un preference activo,
    // pero es costoso. Alternativa robusta: MP incluye external_reference en el
    // payment; podemos consultarlo con nuestro token de PLATFORM (MP_ACCESS_TOKEN
    // del owner que autorizó) — pero cross-account no siempre funciona.
    //
    // Enfoque práctico: buscar en mp_payments pending y probar con el token del
    // complejo asociado.
    const { data: candidates } = await admin.from('mp_payments')
      .select('id, booking_id, complex_id, status, kind, complex:complexes(mp_access_token)')
      .eq('status', 'pending').order('created_at', { ascending: false }).limit(50);

    let matched: any = null;
    let paymentData: any = null;

    for (const p of candidates ?? []) {
      const token = (p.complex as any)?.mp_access_token;
      if (!token) continue;
      try {
        const pay = await getPayment(paymentId, token);
        // Si external_reference matchea alguno de los pending
        const ref = String(pay?.external_reference ?? '');
        const target = candidates?.find(c => ref.startsWith(String(c.booking_id) + '|'));
        if (target) {
          matched = target;
          paymentData = pay;
          break;
        }
      } catch { /* token del complejo no autoriza este payment, seguir */ }
    }

    if (!matched || !paymentData)
      return NextResponse.json({ ok: true, note: 'no match' });

    const status = paymentData.status; // approved | rejected | in_process | refunded ...
    await admin.from('mp_payments').update({
      payment_id: paymentId,
      status,
      raw_webhook: paymentData,
      updated_at: new Date().toISOString()
    }).eq('id', matched.id);

    // Si fue aprobado, actualizar booking + ledger del jugador
    if (status === 'approved') {
      await admin.from('bookings').update({
        status: 'confirmada',
        payment_status: 'pagado'
      }).eq('id', matched.booking_id);

      const kind = matched.kind === 'total' ? 'seña_paid' : 'seña_paid'; // el ledger no distingue; contamos como cobro
      await admin.from('player_ledger').insert({
        player_id: paymentData.payer?.id ? undefined : undefined, // player desde booking
        complex_id: matched.complex_id,
        kind,
        amount: paymentData.transaction_amount,
        method: 'mp',
        description: `Pago por Mercado Pago (${matched.kind})`,
        ref_booking_id: matched.booking_id
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('webhook-booking error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
