import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

type CookieToSet = { name: string; value: string; options?: any };

// GET /api/admin/users-with-email
// Solo super_admin. Devuelve todos los profiles + email + last_sign_in.
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
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Traer todos los profiles
  const { data: profiles, error: pErr } = await admin.from('profiles')
    .select('id, first_name, last_name, username, phone, avatar_url, category, locality, province, role, created_at, is_premium')
    .order('created_at', { ascending: false });
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  // Traer emails de auth.users (con paginación por si hay muchos)
  const emails: Record<string, { email: string | null; last_sign_in_at: string | null; email_confirmed_at: string | null }> = {};
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) break;
    for (const u of data.users) {
      emails[u.id] = {
        email: u.email ?? null,
        last_sign_in_at: u.last_sign_in_at ?? null,
        email_confirmed_at: u.email_confirmed_at ?? null
      };
    }
    if (data.users.length < perPage) break;
    page++;
    if (page > 30) break; // safety cap 6000 usuarios
  }

  const merged = (profiles ?? []).map((p: any) => ({
    ...p,
    email: emails[p.id]?.email ?? null,
    last_sign_in_at: emails[p.id]?.last_sign_in_at ?? null,
    email_confirmed: !!emails[p.id]?.email_confirmed_at
  }));

  return NextResponse.json({ users: merged });
}
