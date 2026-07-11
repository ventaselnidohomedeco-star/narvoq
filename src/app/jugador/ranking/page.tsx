'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

const CATS = ['Todas', '1', '2', '3', '4', '5', '6', '7', '8'];

const Avatar = ({ url, name }: { url?: string | null; name: string }) => url
  ? <img src={url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
  : <span className="w-10 h-10 rounded-full bg-court text-white font-display font-black flex items-center justify-center shrink-0">
      {name?.[0]?.toUpperCase() ?? '?'}
    </span>;

export default function Ranking() {
  const [rows, setRows] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [cityId, setCityId] = useState('');
  const [complexes, setComplexes] = useState<any[]>([]);
  const [complexId, setComplexId] = useState('');
  const [cat, setCat] = useState('Todas');
  const [sex, setSex] = useState('Todos');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('cities').select('id,name');
      setCities(data ?? []);
      const { data: cxs } = await supabase.from('complexes').select('id,name,city_id').eq('active', true);
      setComplexes(cxs ?? []);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: me } = await supabase.from('profiles').select('city_id').eq('id', user.id).maybeSingle();
        if (me?.city_id) setCityId(me.city_id);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      let q = supabase.from('v_ranking').select('*');
      if (complexId) q = q.eq('complex_id', complexId);
      else if (cityId) q = q.eq('city_id', cityId);
      if (cat !== 'Todas') q = q.eq('category', Number(cat));
      if (sex !== 'Todos') q = q.eq('sex', sex === 'Masc' ? 'M' : 'F');
      const { data } = await q;
      const agg = new Map<string, any>();
      (data ?? []).forEach(r => {
        const prev = agg.get(r.player_id);
        agg.set(r.player_id, prev ? { ...prev, points: prev.points + r.points } : { ...r });
      });
      const list = Array.from(agg.values()).sort((a, b) => b.points - a.points).slice(0, 50);
      // Traemos avatars aparte (v_ranking no los expone)
      if (list.length) {
        const ids = list.map(r => r.player_id);
        const { data: avs } = await supabase.from('profiles')
          .select('id, avatar_url').in('id', ids);
        const map = new Map((avs ?? []).map((p: any) => [p.id, p.avatar_url]));
        list.forEach(r => { r.avatar_url = map.get(r.player_id) ?? null; });
      }
      setRows(list);
    })();
  }, [cityId, cat, sex, complexId]);

  return (
    <main className="px-5 pt-8">
      <h1 className="font-display font-black text-2xl">Ranking</h1>
      <p className="text-white/50 text-sm mt-1">🏆 Solo suman puntos los torneos. Es por localidad: elegí la tuya.</p>
      <div className="mt-3">
        <select className="input" value={complexId} onChange={e => setComplexId(e.target.value)}>
          <option value="">🌎 Ranking zonal (todos los complejos)</option>
          {complexes.filter(c => !cityId || c.city_id === cityId).map(c =>
            <option key={c.id} value={c.id}>🏟 {c.name}</option>)}
        </select>
      </div>
      <div className="mt-2 flex gap-2">
        <select className="input" value={cityId} onChange={e => { setCityId(e.target.value); setComplexId(''); }}>
          <option value="">Todas las ciudades</option>
          {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input !w-24" value={cat} onChange={e => setCat(e.target.value)}>
          {CATS.map(c => <option key={c}>{c}</option>)}
        </select>
        <select className="input !w-28" value={sex} onChange={e => setSex(e.target.value)}>
          {['Todos', 'Masc', 'Fem'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <ol className="mt-5 space-y-2">
        {rows.map((r, i) => (
          <li key={r.player_id}>
            <Link href={`/u/${r.username}`} className="card flex items-center gap-3">
              <span className={`font-display font-black text-xl w-8 text-center shrink-0
                ${i === 0 ? 'text-ball bg-courtdark rounded-lg py-1'
                : i === 1 ? 'text-white/80'
                : i === 2 ? 'text-white/60'
                : 'text-court'}`}>{i + 1}</span>
              <Avatar url={r.avatar_url} name={r.first_name} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{r.first_name} {r.last_name}</p>
                <p className="text-white/50 text-xs truncate">@{r.username} · cat. {r.category}</p>
              </div>
              <span className="font-display font-black text-ball shrink-0">{r.points} pts</span>
            </Link>
          </li>
        ))}
        {rows.length === 0 && <p className="text-white/50 mt-6">Todavía no hay puntos cargados. Jugá y validá resultados para aparecer acá.</p>}
      </ol>
    </main>
  );
}
