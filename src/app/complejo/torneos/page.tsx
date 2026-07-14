'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import TorneosManager from '@/components/TorneosManager';

export default function TorneosComplejo() {
  const [cx, setCx] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('complexes').select('id, name').eq('owner_id', user.id).maybeSingle();
      setCx(data);
    })();
  }, []);

  if (!cx) return <main className="p-8 text-white/60">Cargando complejo…</main>;

  return <TorneosManager owner={{ type: 'complex', id: cx.id, name: cx.name }} />;
}
