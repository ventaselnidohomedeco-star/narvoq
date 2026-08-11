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

  const dest = role === 'coach' ? '/training/dashboard'
    : role === 'complex_admin' ? '/complejo/dashboard'
    : '/jugador/dashboard';

  if (!code) return NextResponse.redirect(`${origin}/login?error=no_code`);

  const res = NextResponse.redirect(`${origin}${dest}`);

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
    const { data: existing } = await supabase.from('profiles').select('id, role').eq('id', user.id).maybeSingle();
    if (!existing) {
      const meta = user.user_metadata ?? {};
      const fullName: string = meta.full_name ?? meta.name ?? '';
      const [firstName, ...rest] = fullName.split(' ');
      const lastName = rest.join(' ');
      // Username tentativo: parte antes del @, sanitizado, con sufijo random para evitar colisiones
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
    }
  }

  return res;
}
