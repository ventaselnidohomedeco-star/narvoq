'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

/**
 * Si el usuario logueado NO tiene fila en "profiles" (por ejemplo si el
 * registro se cortó a la mitad, o si entró por Google y algo falló),
 * lo mandamos a /completar-perfil que se encarga de crear/completar.
 */
export default function ProfileGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<'checking' | 'ok'>('checking');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setState('ok'); // el middleware ya maneja no-logueado
      const { data } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
      if (!data) {
        router.push('/completar-perfil');
        return;
      }
      setState('ok');
    })();
  }, [router]);

  if (state === 'checking') return null;
  return <>{children}</>;
}
