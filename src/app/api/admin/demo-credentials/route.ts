import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

type CookieToSet = { name: string; value: string; options?: any };

// GET /api/admin/demo-credentials?center_slug=xxx
// Solo super_admin. Devuelve emails de los usuarios demo del centro
// (los que terminan en @odpro.test) para que el super admin pueda loguearse como ellos y probar
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
  const { data: meProf } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (meProf?.role !== 'super_admin') return NextResponse.json({ error: 'solo super_admin' }, { status: 403 });

  const slug = req.nextUrl.searchParams.get('center_slug');
  if (!slug) return NextResponse.json({ error: 'falta center_slug' }, { status: 400 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: centro } = await admin.from('training_centers').select('id').eq('slug', slug).maybeSingle();
  if (!centro) return NextResponse.json({ error: 'centro no encontrado' }, { status: 404 });

  const { data: members } = await admin.from('center_members')
    .select('role, title, specialty, profile:profiles!profile_id(id, first_name, last_name, category)')
    .eq('center_id', centro.id).eq('active', true);

  // Enriquecer con email de auth.users
  const results = [];
  for (const m of (members ?? [])) {
    const prof = m.profile as any;
    if (!prof?.id) continue;
    try {
      const { data: u } = await admin.auth.admin.getUserById(prof.id);
      const email = u?.user?.email;
      if (!email || !email.endsWith('@odpro.test')) continue;
      results.push({
        role: m.role,
        title: m.title,
        specialty: m.specialty,
        first_name: prof.first_name,
        last_name: prof.last_name,
        category: prof.category,
        email
      });
    } catch {}
  }

  // Ordenar: master → coaches → assistants → students
  const order: Record<string, number> = { master: 0, coach: 1, assistant: 2, student: 3 };
  results.sort((a: any, b: any) => (order[a.role] ?? 9) - (order[b.role] ?? 9));

  return NextResponse.json({
    password: 'demoODpro2026!',
    count: results.length,
    users: results
  });
}
