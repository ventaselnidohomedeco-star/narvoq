import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { geocodeAddress } from '@/lib/geo';

type CookieToSet = { name: string; value: string; options?: any };

// GET /api/admin/geocode-all-complexes
// Solo super_admin. Geocodifica todos los complejos sin lat/lng que tengan
// dirección + provincia + localidad. Respeta el límite de 1req/sec de Nominatim.
export async function GET(req: NextRequest) {
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

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: cxs } = await admin.from('complexes')
    .select('id, name, address, locality, province')
    .is('lat', null);

  let updated = 0, failed = 0;
  const results: any[] = [];

  for (const cx of cxs ?? []) {
    const full = [cx.address, cx.locality, cx.province, 'Argentina'].filter(Boolean).join(', ');
    const coords = await geocodeAddress(full);
    if (coords) {
      await admin.from('complexes').update({ lat: coords.lat, lng: coords.lng }).eq('id', cx.id);
      updated++;
      results.push({ id: cx.id, name: cx.name, status: 'ok', ...coords });
    } else {
      failed++;
      results.push({ id: cx.id, name: cx.name, status: 'fail', address: full });
    }
    // Nominatim usage policy: 1 req/sec
    await new Promise(r => setTimeout(r, 1100));
  }

  return NextResponse.json({ checked: cxs?.length ?? 0, updated, failed, results });
}
