import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse['cookies']['set']>[2];
};

// Protege rutas por rol: /jugador/* requiere sesión, /complejo/* (salvo login/registro)
// requiere rol complex_admin.
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (all: CookieToSet[]) => {
          all.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          all.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        }
      }
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = req.nextUrl.pathname;
  const isComplexAuth = path === '/complejo/login' || path === '/complejo/registro';
  const isTrainingAuth = path === '/training/login' || path === '/training/registro';

  if (path.startsWith('/admin')) {
    if (!user) return NextResponse.redirect(new URL('/login', req.url));
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'super_admin')
      return NextResponse.redirect(new URL('/jugador/dashboard', req.url));
  }

  if (path.startsWith('/jugador') && !user)
    return NextResponse.redirect(new URL('/login', req.url));

  if (path.startsWith('/training') && !isTrainingAuth) {
    if (!user) return NextResponse.redirect(new URL('/training/login', req.url));
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'coach' && profile?.role !== 'super_admin')
      return NextResponse.redirect(new URL('/jugador/dashboard', req.url));
  }

  if (path.startsWith('/complejo') && !isComplexAuth) {
    if (!user) return NextResponse.redirect(new URL('/complejo/login', req.url));
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'complex_admin' && profile?.role !== 'super_admin')
      return NextResponse.redirect(new URL('/jugador/dashboard', req.url));
  }
  return res;
}

export const config = { matcher: ['/jugador/:path*', '/complejo/:path*', '/admin/:path*', '/training/:path*'] };
