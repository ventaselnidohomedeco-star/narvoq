'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import TorneosManager from '@/components/TorneosManager';

export default function TorneosTraining() {
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('profiles').select('id, first_name, last_name').eq('id', user.id).single();
      setMe(data);
    })();
  }, []);

  if (!me) return <main className="p-8 text-white/60">Cargando…</main>;

  return <TorneosManager owner={{ type: 'coach', id: me.id, name: `${me.first_name} ${me.last_name}` }} />;
}
