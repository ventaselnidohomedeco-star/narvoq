import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// GET /api/mp/sync-pending-payments
// Recorre mp_payments con status=pending, busca en MP el pago asociado por
// external_reference, y actualiza el booking si el pago fue aprobado.
// Útil cuando el webhook no llegó por algún motivo.
export async function GET(req: NextRequest) {
  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: pending } = await admin.from('mp_payments')
      .select('id, booking_id, complex_id, kind, amount, complex:complexes(mp_access_token)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!pending || pending.length === 0) {
      return NextResponse.json({ ok: true, checked: 0, updated: 0 });
    }

    let updated = 0;
    const details: any[] = [];

    for (const p of pending) {
      const token = (p.complex as any)?.mp_access_token;
      if (!token) { details.push({ id: p.id, skipped: 'no token' }); continue; }

      const extRef = `${p.booking_id}|${p.kind}`;
      try {
        // Buscar pagos en MP por external_reference
        const searchUrl = `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(extRef)}&sort=date_created&criteria=desc`;
        const res = await fetch(searchUrl, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) { details.push({ id: p.id, error: `search ${res.status}` }); continue; }
        const data = await res.json();
        const results = data.results ?? [];
        // Preferir el más reciente aprobado, sino cualquiera
        const approved = results.find((r: any) => r.status === 'approved');
        const payment = approved || results[0];
        if (!payment) { details.push({ id: p.id, note: 'sin pago en MP' }); continue; }

        // Actualizar mp_payments
        await admin.from('mp_payments').update({
          payment_id: String(payment.id),
          status: payment.status,
          raw_webhook: payment,
          updated_at: new Date().toISOString()
        }).eq('id', p.id);

        // Si fue aprobado, actualizar booking + ledger
        if (payment.status === 'approved') {
          await admin.from('bookings').update({
            status: 'confirmada',
            payment_status: 'pagado',
            payment_confirmed_at: new Date().toISOString()
          }).eq('id', p.booking_id);

          const { data: bookingRow } = await admin.from('bookings')
            .select('player_id').eq('id', p.booking_id).maybeSingle();

          const kind = p.kind === 'total' ? 'restante_paid' : 'seña_paid';

          // Evitar duplicado en ledger
          const { data: existingLedger } = await admin.from('player_ledger')
            .select('id').eq('ref_booking_id', p.booking_id).eq('method', 'mp').eq('kind', kind).maybeSingle();
          if (!existingLedger) {
            await admin.from('player_ledger').insert({
              player_id: bookingRow?.player_id ?? null,
              complex_id: p.complex_id,
              kind,
              amount: payment.transaction_amount,
              method: 'mp',
              description: `Pago por Mercado Pago (${p.kind === 'total' ? 'turno completo' : 'seña'}) — sync manual`,
              ref_booking_id: p.booking_id
            });
          }
          updated++;
        }
        details.push({ id: p.id, status: payment.status });
      } catch (e: any) {
        details.push({ id: p.id, error: e.message });
      }
    }

    return NextResponse.json({ ok: true, checked: pending.length, updated, details });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
