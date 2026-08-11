import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createPreApproval } from '@/lib/mercadopago';

type CookieToSet = { name: string; value: string; options?: any };

// POST /api/mp/create-subscription
// Body: { planId: string }
// Crea un registro pending en `subscriptions` + un PreApproval en MP.
// Devuelve la URL de checkout (init_point) para redirigir al usuario.
export async function POST(req: NextRequest) {
  try {
    const { planId } = await req.json();
    if (!planId) return NextResponse.json({ error: 'planId requerido' }, { status: 400 });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: (all: CookieToSet[]) => all.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
          })
        }
      }
    );

    // 1) Usuario autenticado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    if (!user.email) return NextResponse.json({ error: 'Usuario sin email' }, { status: 400 });

    // 2) Plan
    const { data: plan } = await supabase.from('subscription_plans')
      .select('*').eq('id', planId).maybeSingle();
    if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 });
    if (!plan.active) return NextResponse.json({ error: 'Plan no está activo' }, { status: 400 });

    // 3) ¿Ya tiene suscripción activa? Evitar duplicados.
    const { data: existing } = await supabase.from('subscriptions')
      .select('id, status')
      .eq('user_id', user.id)
      .in('status', ['active', 'trial', 'pending'])
      .maybeSingle();
    if (existing) {
      return NextResponse.json({
        error: 'Ya tenés una suscripción activa o pendiente. Cancelala antes de crear otra.'
      }, { status: 400 });
    }

    // 4) Determinar complex_id (si el plan es para complejo)
    let complexId: string | null = null;
    if (plan.role === 'complex_admin') {
      const { data: cx } = await supabase.from('complexes')
        .select('id').eq('owner_id', user.id).maybeSingle();
      if (!cx) return NextResponse.json({
        error: 'No sos dueño de ningún complejo. Registrá tu complejo primero.'
      }, { status: 400 });
      complexId = cx.id;
    }

    // 5) Crear el registro en 'subscriptions' con status='pending'.
    //    Cuando MP nos avise que se aprobó, el webhook lo pasa a 'active'.
    const periodMonths = plan.billing_period === 'yearly' ? 12 : 1;
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + periodMonths);

    const { data: sub, error: subErr } = await supabase.from('subscriptions').insert({
      user_id: user.id,
      complex_id: complexId,
      plan_id: plan.id,
      status: 'pending',
      starts_at: now.toISOString(),
      expires_at: expiresAt.toISOString()
    }).select().single();

    if (subErr || !sub) {
      return NextResponse.json({ error: `No pude crear la suscripción: ${subErr?.message}` }, { status: 500 });
    }

    // 6) Crear PreApproval en MP
    const origin = new URL(req.url).origin;
    const roleLabel = plan.role === 'player' ? 'Jugador' : plan.role === 'coach' ? 'Entrenador' : 'Complejo';
    const periodLabel = plan.billing_period === 'yearly' ? 'Anual' : 'Mensual';

    let mp;
    try {
      mp = await createPreApproval({
        payerEmail: user.email,
        amount: plan.price_ars,
        periodMonths,
        reason: `NarvoQ Verificado - ${roleLabel} ${periodLabel}`,
        externalReference: sub.id,
        backUrl: `${origin}/mi-suscripcion?ref=${sub.id}`
      });
    } catch (e: any) {
      // Si falla MP, borramos el pending para no dejar basura
      await supabase.from('subscriptions').delete().eq('id', sub.id);
      return NextResponse.json({ error: `MP: ${e.message ?? 'error desconocido'}` }, { status: 500 });
    }

    // 7) Guardar mp_preapproval_id en la suscripción
    await supabase.from('subscriptions').update({
      mp_preapproval_id: mp.id
    }).eq('id', sub.id);

    // 8) Devolver URL de checkout
    return NextResponse.json({
      subscriptionId: sub.id,
      init_point: mp.init_point,
      mp_id: mp.id
    });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('[MP create-subscription]', e);
    return NextResponse.json({ error: e.message ?? 'Error interno' }, { status: 500 });
  }
}
