import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

type CookieToSet = { name: string; value: string; options?: any };

// POST /api/mp/create-subscription
// Body: { planId: string }
//
// NUEVO FLOW (Preapproval Plans, agosto 2026):
// En vez de crear un preapproval con payer_email fijo (que MP verifica),
// creamos una fila 'pending' en `subscriptions` y redirigimos al usuario
// al init_point del plan de MP (que es global, reutilizable, y NO valida el
// email del pagador). Al pagar, MP crea el preapproval y nos avisa por
// webhook usando el `external_reference` = subscription.id.
//
// Ventaja: cualquier cuenta MP puede pagar, sin importar el email de NarvoQ.
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
          setAll: (all: CookieToSet[]) => all.forEach(({ name, value }) => {
            req.cookies.set(name, value);
          })
        }
      }
    );

    // 1) Usuario autenticado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    // 2) Plan
    const { data: plan } = await supabase.from('subscription_plans')
      .select('*').eq('id', planId).maybeSingle();
    if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 });
    if (!plan.active) return NextResponse.json({ error: 'Plan no está activo' }, { status: 400 });
    if (!plan.mp_init_point) {
      return NextResponse.json({
        error: 'Este plan no está sincronizado con Mercado Pago. Pedile al admin que abra /admin/planes y lo guarde para sincronizar.'
      }, { status: 400 });
    }

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

    // 5) Crear la fila 'pending' en subscriptions
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

    // 6) URL de checkout del plan + external_reference = subscription.id
    // MP va a crear el preapproval con ese external_reference cuando el user pague,
    // y el webhook lo va a matchear con nuestra fila subscriptions.
    const initPointUrl = new URL(plan.mp_init_point);
    initPointUrl.searchParams.set('external_reference', sub.id);

    return NextResponse.json({
      subscriptionId: sub.id,
      init_point: initPointUrl.toString()
    });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('[MP create-subscription]', e);
    return NextResponse.json({ error: e.message ?? 'Error interno' }, { status: 500 });
  }
}
