import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse['cookies']['set']>[2];
};

// Callback OAuth (Google, etc.). Intercambia el code por sesión, crea el
// profile si es la primera vez que entra este usuario, y redirige al
// dashboard del rol correcto.
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const roleParam = searchParams.get('role');   // 'player' | 'coach' | 'complex'

  const role: 'player' | 'coach' | 'complex_admin' =
    roleParam === 'coach' ? 'coach'
    : roleParam === 'complex' ? 'complex_admin'
    : 'player';

  // Destino DEFAULT (si el perfil está completo). Si falta info, mandamos a completar-perfil.
  const dashDest = role === 'coach' ? '/training/dashboard'
    : role === 'complex_admin' ? '/complejo/dashboard'
    : '/jugador/dashboard';

  if (!code) return NextResponse.redirect(`${origin}/login?error=no_code`);

  const res = NextResponse.redirect(`${origin}${dashDest}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (all: CookieToSet[]) => {
          all.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        }
      }
    }
  );

  const { data: session, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  // Primera vez: crear profile básico con los datos que devuelve Google.
  const user = session?.user;
  if (user) {
    const { data: existing } = await supabase.from('profiles').select('id, role, phone, city_id, category, age').eq('id', user.id).maybeSingle();

    if (!existing) {
      const meta = user.user_metadata ?? {};
      const fullName: string = meta.full_name ?? meta.name ?? '';
      const [firstName, ...rest] = fullName.split(' ');
      const lastName = rest.join(' ');
      const baseUsername = (user.email ?? 'user').split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
      const username = `${baseUsername}${Math.floor(Math.random() * 900 + 100)}`;

      await supabase.from('profiles').insert({
        id: user.id,
        role,
        username,
        first_name: firstName || 'Usuario',
        last_name: lastName || '',
        avatar_url: meta.avatar_url ?? meta.picture ?? null
      });
      // Perfil recién creado → obligatoriamente falta completar
      return redirectPreservingCookies(res, origin, '/completar-perfil');
    }

    // Perfil ya existía: si le faltan campos críticos, mandarlo a completar
    if (!existing.phone || existing.phone === '-' || !existing.city_id || !existing.category || !existing.age) {
      return redirectPreservingCookies(res, origin, '/completar-perfil');
    }
  }

  return res;
}

// Crea un nuevo redirect copiando las cookies que Supabase seteó en `res`.
// Sin esto, la sesión recién creada se pierde y el usuario queda no-logueado.
function redirectPreservingCookies(res: NextResponse, origin: string, path: string): NextResponse {
  const redirected = NextResponse.redirect(`${origin}${path}`);
  res.cookies.getAll().forEach(c => redirected.cookies.set(c));
  return redirected;
}
