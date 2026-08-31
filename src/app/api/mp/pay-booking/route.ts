import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createPreferenceForComplex } from '@/lib/mp-marketplace';

type CookieToSet = { name: string; value: string; options?: any };

// POST /api/mp/pay-booking
// Body: { bookingId: string, kind: 'seña' | 'total' }
// Crea la preference de MP en la cuenta del complejo (con split si hay fee)
// y devuelve init_point para redirigir al jugador.
export async function POST(req: NextRequest) {
  try {
    const { bookingId, kind } = await req.json();
    if (!bookingId || !['seña', 'total'].includes(kind))
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });

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
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    // 1) Traer booking básico (evitando joins anidados que fallan por RLS)
    const { data: b, error: bErr } = await supabase.from('bookings')
      .select('id, player_id, court_id, price, starts_at')
      .eq('id', bookingId).maybeSingle();
    if (bErr) {
      console.error('pay-booking: error trayendo booking', bErr);
      return NextResponse.json({ error: `Error DB: ${bErr.message}` }, { status: 500 });
    }
    if (!b) return NextResponse.json({ error: 'Reserva no encontrada (id: ' + bookingId + ')' }, { status: 404 });
    if (b.player_id !== user.id) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    // 2) Traer cancha
    const { data: court, error: cErr } = await supabase.from('courts')
      .select('id, name, price_per_slot, deposit_amount, complex_id')
      .eq('id', b.court_id).maybeSingle();
    if (cErr || !court) return NextResponse.json({ error: 'Cancha no encontrada' }, { status: 404 });

    // 3) Traer complejo con tokens MP + preferencias
    const { data: cx, error: xErr } = await supabase.from('complexes')
      .select('id, name, mp_access_token, mp_exclude_credit, mp_only_deposit')
      .eq('id', court.complex_id).maybeSingle();
    if (xErr || !cx) return NextResponse.json({ error: 'Complejo no encontrado' }, { status: 404 });

    if (!cx.mp_access_token)
      return NextResponse.json({ error: 'Este complejo todavía no conectó Mercado Pago' }, { status: 400 });

    // Si el complejo bloqueó pagar el total por MP, rechazar
    if (cx.mp_only_deposit && kind === 'total') {
      return NextResponse.json({ error: 'Este complejo solo acepta la seña por MP. El resto se paga en cancha.' }, { status: 400 });
    }

    // Definir monto según kind
    const priceTotal = Number(court.price_per_slot ?? 0);
    const deposit = court.deposit_amount != null ? Number(court.deposit_amount) : priceTotal;
    const amount = kind === 'total' ? priceTotal : deposit;
    if (!amount || amount <= 0) return NextResponse.json({ error: 'Monto inválido' }, { status: 400 });

    // Fee marketplace (global, editable desde admin)
    const { data: feeSetting } = await supabase.from('app_settings')
      .select('value_num').eq('key', 'marketplace_fee_pct').maybeSingle();
    const feePct = Number(feeSetting?.value_num ?? 0);
    const marketplace_fee = Number((amount * feePct / 100).toFixed(2));

    // Correo del pagador (para pre-cargar en MP)
    const payerEmail = user.email ?? undefined;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
    const backUrl = `${appUrl}/jugador/reservas?mp=ok&booking=${b.id}`;
    const notificationUrl = `${appUrl}/api/mp/webhook-booking`;

    const pref = await createPreferenceForComplex({
      complexAccessToken: cx.mp_access_token,
      amount,
      title: `${kind === 'total' ? 'Turno completo' : 'Seña'} · ${cx.name} · ${court.name}`,
      externalReference: `${b.id}|${kind}`,
      payerEmail,
      backUrl,
      notificationUrl,
      feePct,
      excludeCredit: !!cx.mp_exclude_credit
    });

    // Registrar el intento
    await supabase.from('mp_payments').insert({
      booking_id: b.id,
      complex_id: cx.id,
      player_id: user.id,
      preference_id: pref.id,
      amount,
      marketplace_fee,
      kind,
      status: 'pending'
    });

    return NextResponse.json({ init_point: pref.init_point });
  } catch (e: any) {
    console.error('pay-booking error:', e.message);
    return NextResponse.json({ error: e.message ?? 'Error interno' }, { status: 500 });
  }
}
