import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { exchangeCodeForToken } from '@/lib/mp-marketplace';

type CookieToSet = { name: string; value: string; options?: any };

// GET /api/mp/oauth/callback?code=...&state=<complex_id>
// MP nos manda acá al terminar el OAuth. Cambiamos code por tokens y
// los guardamos en el complejo.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const complexId = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  const backTo = new URL('/complejo/perfil?mp=', req.url);

  if (error) return NextResponse.redirect(new URL(`${backTo}error`, req.url));
  if (!code || !complexId) return NextResponse.redirect(new URL(`${backTo}missing`, req.url));

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

  // Verificar que el complejo pertenece al usuario
  const { data: cx } = await supabase.from('complexes')
    .select('id').eq('id', complexId).eq('owner_id', user.id).maybeSingle();
  if (!cx) return NextResponse.redirect(new URL(`${backTo}forbidden`, req.url));

  try {
    const t = await exchangeCodeForToken(code);
    const expiresAt = new Date(Date.now() + t.expires_in * 1000).toISOString();
    const { error: upErr } = await supabase.from('complexes').update({
      mp_user_id: String(t.user_id),
      mp_access_token: t.access_token,
      mp_refresh_token: t.refresh_token,
      mp_public_key: t.public_key,
      mp_expires_at: expiresAt,
      mp_connected_at: new Date().toISOString()
    }).eq('id', complexId);
    if (upErr) throw upErr;
    return NextResponse.redirect(new URL(`${backTo}ok`, req.url));
  } catch (e: any) {
    console.error('MP OAuth callback error:', e.message);
    return NextResponse.redirect(new URL(`${backTo}fail`, req.url));
  }
}
