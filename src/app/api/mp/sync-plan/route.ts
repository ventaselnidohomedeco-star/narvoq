import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { createPlan, updatePlan } from '@/lib/mercadopago';

type CookieToSet = { name: string; value: string; options?: any };

// POST /api/mp/sync-plan
// Body: { planId: string }
// Crea el plan en MP (si no existe) o lo actualiza (si ya tiene mp_plan_id).
// Solo super_admin puede llamarlo.
// Se llama automáticamente cuando el admin edita un plan en /admin/planes.
export async function POST(req: NextRequest) {
  try {
    const { planId } = await req.json();
    if (!planId) return NextResponse.json({ error: 'planId requerido' }, { status: 400 });

    // Validar que el caller sea super_admin
    const supabaseUser = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: (_all: CookieToSet[]) => { /* no-op */ }
        }
      }
    );
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const { data: prof } = await supabaseUser.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (prof?.role !== 'super_admin') return NextResponse.json({ error: 'Solo super_admin' }, { status: 403 });

    // Cliente admin para bypass RLS al actualizar el plan
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: plan } = await admin.from('subscription_plans').select('*').eq('id', planId).maybeSingle();
    if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 });

    const origin = new URL(req.url).origin;
    const roleLabel = plan.role === 'player' ? 'Jugador' : plan.role === 'coach' ? 'Entrenador' : 'Complejo';
    const periodLabel = plan.billing_period === 'yearly' ? 'Anual' : 'Mensual';
    const reason = `NarvoQ Verificado - ${roleLabel} ${periodLabel}`;
    const periodMonths = plan.billing_period === 'yearly' ? 12 : 1;
    const backUrl = `${origin}/mi-suscripcion`;

    let mp;
    if (plan.mp_plan_id) {
      // Ya existía → actualizar
      try {
        mp = await updatePlan(plan.mp_plan_id, {
          reason, amount: plan.price_ars, periodMonths
        });
      } catch (e: any) {
        // Si MP dice que no existe, lo creamos de nuevo
        mp = await createPlan({ reason, amount: plan.price_ars, periodMonths, backUrl });
      }
    } else {
      // Primera vez → crear
      mp = await createPlan({ reason, amount: plan.price_ars, periodMonths, backUrl });
    }

    // Guardar los IDs en el plan
    await admin.from('subscription_plans').update({
      mp_plan_id: mp.id,
      mp_init_point: mp.init_point || plan.mp_init_point,
      mp_synced_at: new Date().toISOString()
    }).eq('id', plan.id);

    return NextResponse.json({ ok: true, mp_plan_id: mp.id, mp_init_point: mp.init_point });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('[MP sync-plan]', e);
    return NextResponse.json({ error: e.message ?? 'Error interno' }, { status: 500 });
  }
}
