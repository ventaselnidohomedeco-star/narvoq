import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { getPreApproval, searchPreApprovalsByExternalRef } from '@/lib/mercadopago';

type CookieToSet = { name: string; value: string; options?: any };

// POST /api/mp/sync-my-subscription
// Reconcilia la suscripción del usuario logueado consultando a MP.
// Útil cuando el webhook no llegó (o llegó tarde) y el usuario ya pagó.
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: (_all: CookieToSet[]) => { /* no-op */ }
        }
      }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    // Última suscripción pendiente
    const { data: sub } = await supabase.from('subscriptions')
      .select('id, status, mp_preapproval_id')
      .eq('user_id', user.id)
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: false })
      .maybeSingle();

    if (!sub) return NextResponse.json({ error: 'No tenés suscripción para verificar.' }, { status: 404 });
    if (sub.status === 'active') return NextResponse.json({ ok: true, alreadyActive: true });

    // Buscar preapproval en MP: si tenemos ID lo traemos directo; sino search por external_reference
    let pa: any = null;
    if (sub.mp_preapproval_id) {
      pa = await getPreApproval(sub.mp_preapproval_id);
    } else {
      const results = await searchPreApprovalsByExternalRef(sub.id);
      // Nos quedamos con la más reciente authorized si hay
      pa = results.find(r => r.status === 'authorized') ?? results[0] ?? null;
    }

    if (!pa) {
      return NextResponse.json({
        ok: false,
        error: 'Todavía no encontramos tu pago en Mercado Pago. Probá de nuevo en 1-2 minutos.'
      });
    }

    const ourStatus =
      pa.status === 'authorized' ? 'active' :
      pa.status === 'paused' ? 'past_due' :
      pa.status === 'cancelled' ? 'cancelled' :
      'pending';

    // Actualizar con service_role (bypass RLS)
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const updates: any = { status: ourStatus, mp_preapproval_id: pa.id };
    if (pa.next_payment_date) {
      // Nunca acortar la suscripción: max entre nuestra expires_at y la de MP.
      const { data: current } = await admin.from('subscriptions')
        .select('expires_at').eq('id', sub.id).maybeSingle();
      const currentExp = current?.expires_at ? new Date(current.expires_at) : null;
      const mpExp = new Date(pa.next_payment_date);
      updates.expires_at = (currentExp && currentExp > mpExp ? currentExp : mpExp).toISOString();
    }
    if (ourStatus === 'cancelled') updates.cancelled_at = new Date().toISOString();

    const { error } = await admin.from('subscriptions').update(updates).eq('id', sub.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, status: ourStatus, mpStatus: pa.status });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('[MP sync-my-subscription]', e);
    return NextResponse.json({ error: e.message ?? 'Error interno' }, { status: 500 });
  }
}
