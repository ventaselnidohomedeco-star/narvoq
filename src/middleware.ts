import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse['cookies']['set']>[2];
};

// Protege rutas por rol Y refresca el token de Supabase.
//
// Bug histórico: cuando el middleware hacía `NextResponse.redirect(url)`,
// se descartaba el `res` que contenía las cookies refrescadas → el token
// nunca se persistía → la sesión "expiraba sola". Fix: usar `redirect(res, url)`
// que copia las cookies del response actualizado al redirect.
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (all: CookieToSet[]) => {
          // Propaga las cookies actualizadas TANTO al request como al response.
          all.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          all.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        }
      }
    }
  );

  // IMPORTANT: getUser() puede refrescar el token y llamar a setAll — por eso `res`
  // se muta. Cualquier redirect POSTERIOR debe copiar las cookies del `res` actual.
  const { data: { user } } = await supabase.auth.getUser();
  const path = req.nextUrl.pathname;
  const isComplexAuth = path === '/complejo/login' || path === '/complejo/registro';
  const isTrainingAuth = path === '/training/login' || path === '/training/registro';

  if (path.startsWith('/admin')) {
    if (!user) return redirect(res, req, '/login');
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'super_admin')
      return redirect(res, req, '/jugador/dashboard');
  }

  if (path.startsWith('/jugador') && !user)
    return redirect(res, req, '/login');

  if (path.startsWith('/training') && !isTrainingAuth) {
    if (!user) return redirect(res, req, '/training/login');
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'coach' && profile?.role !== 'super_admin')
      return redirect(res, req, '/jugador/dashboard');
  }

  if (path.startsWith('/complejo') && !isComplexAuth) {
    if (!user) return redirect(res, req, '/complejo/login');
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single();
    const isAdmin = profile?.role === 'complex_admin' || profile?.role === 'super_admin';
    if (!isAdmin) {
      const { data: emp } = await supabase.from('complex_employees')
        .select('complex_id').eq('user_id', user.id).eq('active', true).limit(1);
      if (!emp || emp.length === 0)
        return redirect(res, req, '/jugador/dashboard');
    }
  }

  // Perfil incompleto — SI el usuario está logueado y el perfil no tiene los
  // campos críticos (ciudad, celular, categoría, edad), forzamos a completarlo.
  // Excepciones: /admin (super_admin puede seguir sin completar) y la propia
  // página /completar-perfil.
  if (user && !path.startsWith('/admin') && path !== '/completar-perfil') {
    const { data: profile } = await supabase
      .from('profiles').select('phone, city_id, category, age, role')
      .eq('id', user.id).maybeSingle();
    if (profile) {
      // Complex_admin no necesita categoría ni edad personal — solo teléfono
      const isComplex = profile.role === 'complex_admin';
      const incomplete = !profile.phone || profile.phone === '-' ||
        (!isComplex && (!profile.city_id || !profile.category || !profile.age));
      if (incomplete) return redirect(res, req, '/completar-perfil');
    }
  }

  return res;
}

// Crea un redirect preservando TODAS las cookies que Supabase pudo haber
// refrescado en el response actual. Sin esto, el token de acceso vuelve al
// valor viejo (o desaparece) y la próxima navegación te desloguea.
function redirect(res: NextResponse, req: NextRequest, to: string): NextResponse {
  const redirected = NextResponse.redirect(new URL(to, req.url));
  res.cookies.getAll().forEach(c => {
    redirected.cookies.set(c);
  });
  return redirected;
}

export const config = { matcher: ['/jugador/:path*', '/complejo/:path*', '/admin/:path*', '/training/:path*'] };
