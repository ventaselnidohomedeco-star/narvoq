import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cancelPreApproval } from '@/lib/mercadopago';

type CookieToSet = { name: string; value: string; options?: any };

// POST /api/mp/cancel
// Body: { subscriptionId: string }
// Cancela la PreApproval en MP y marca la suscripción como cancelled.
// El usuario mantiene premium hasta la fecha de vencimiento.
export async function POST(req: NextRequest) {
  try {
    const { subscriptionId } = await req.json();
    if (!subscriptionId) return NextResponse.json({ error: 'subscriptionId requerido' }, { status: 400 });

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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    // Traer la suscripción y verificar que pertenezca al usuario
    const { data: sub } = await supabase.from('subscriptions')
      .select('id, user_id, mp_preapproval_id, status')
      .eq('id', subscriptionId).maybeSingle();
    if (!sub) return NextResponse.json({ error: 'Suscripción no encontrada' }, { status: 404 });
    if (sub.user_id !== user.id) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    // Cancelar en MP (si tenemos preapproval id)
    if (sub.mp_preapproval_id) {
      try {
        await cancelPreApproval(sub.mp_preapproval_id);
      } catch (e: any) {
        // Si MP ya la tiene cancelada, seguimos. Solo logueamos.
        // eslint-disable-next-line no-console
        console.warn('[MP cancel] MP dijo:', e.message);
      }
    }

    // Marcar cancelled en la DB (el trigger deja is_premium=true hasta expires_at)
    await supabase.from('subscriptions').update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString()
    }).eq('id', sub.id);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Error interno' }, { status: 500 });
  }
}
