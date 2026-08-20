import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getOAuthAuthorizeUrl } from '@/lib/mp-marketplace';

type CookieToSet = { name: string; value: string; options?: any };

// GET /api/mp/oauth/authorize
// Redirige al dueño del complejo a MP para autorizar la app.
// state = complex_id (así el callback sabe a qué complejo asociar los tokens).
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
  if (!user) return NextResponse.redirect(new URL('/login', req.url));

  const { data: cx } = await supabase.from('complexes')
    .select('id').eq('owner_id', user.id).maybeSingle();
  if (!cx) return NextResponse.json({ error: 'No sos dueño de un complejo' }, { status: 403 });

  return NextResponse.redirect(getOAuthAuthorizeUrl(cx.id));
}
