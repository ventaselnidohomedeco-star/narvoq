import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

type CookieToSet = { name: string; value: string; options?: any };

// POST /api/admin/create-precargado
// Solo super_admin. Crea un complejo sin owner + N canchas.
export async function POST(req: NextRequest) {
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
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== 'super_admin') return NextResponse.json({ error: 'solo super_admin' }, { status: 403 });

  try {
    const body = await req.json();
    const { courts, price_per_slot, deposit_amount, ...cxData } = body;

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1) Crear complejo con owner_id = user (super_admin) para que no rompa el FK.
    //    Marcamos is_precargado=true así se puede reclamar después.
    // Email/phone son NOT NULL en complexes; usamos placeholders si están vacíos
    const { data: cx, error: cxErr } = await admin.from('complexes').insert({
      ...cxData,
      email: cxData.email || 'precargado@narvoq.com.ar',
      phone: cxData.phone || '0',
      responsible: cxData.responsible || 'Complejo cargado por Narvoq',
      owner_id: user.id,   // temporal — el super_admin es el "owner" hasta que alguien lo reclame
      active: true,
      status: 'active'
    }).select('id').single();
    if (cxErr) return NextResponse.json({ error: cxErr.message }, { status: 500 });

    // 2) Crear las canchas
    const rows = Array.from({ length: Number(courts) || 1 }, (_, i) => ({
      complex_id: cx.id,
      name: `Cancha ${i + 1}`,
      price_per_slot: Number(price_per_slot) || 0,
      deposit_amount: deposit_amount ? Number(deposit_amount) : null,
      active: true,
      surface: 'sintetico',
      covered: true
    }));
    await admin.from('courts').insert(rows);

    return NextResponse.json({ id: cx.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
