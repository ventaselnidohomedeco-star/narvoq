'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

const CATS = ['Todas', '1', '2', '3', '4', '5', '6', '7', '8'];

const MEDAL = ['🥇', '🥈', '🥉'];

const Avatar = ({ url, name, size = 'w-12 h-12' }: { url?: string | null; name: string; size?: string }) => url
  ? <img src={url} alt="" className={`${size} rounded-full object-cover shrink-0`} />
  : <span className={`${size} rounded-full bg-grafito text-ball font-display font-black flex items-center justify-center shrink-0`}>
      {name?.[0]?.toUpperCase() ?? '?'}
    </span>;

// Chip pill grande, estilo Padelero
function Chip({ active, onClick, children }: any) {
  return (
    <button onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-black transition min-h-[42px]
        ${active
          ? 'bg-ball text-courtdark'
          : 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10'}`}>
      {children}
    </button>
  );
}

export default function Ranking() {
  const [rows, setRows] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [cityId, setCityId] = useState('');
  const [complexes, setComplexes] = useState<any[]>([]);
  const [complexId, setComplexId] = useState('');
  const [cat, setCat] = useState('Todas');
  const [sex, setSex] = useState<'Todos' | 'M' | 'F'>('Todos');

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
      if (sex !== 'Todos') q = q.eq('sex', sex);
      const { data } = await q;
      const agg = new Map<string, any>();
      (data ?? []).forEach(r => {
        const prev = agg.get(r.player_id);
        agg.set(r.player_id, prev ? { ...prev, points: prev.points + r.points } : { ...r });
      });
      const list = Array.from(agg.values()).sort((a, b) => b.points - a.points).slice(0, 50);
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

  const filtrosActivos = complexId || (cityId && cities.length) || cat !== 'Todas' || sex !== 'Todos';

  return (
    <main className="px-5 pt-6 pb-8">
      <p className="text-ball text-xs font-black tracking-widest">CLASIFICACIÓN</p>
      <h1 className="h-hero mt-1">Ranking</h1>
      <p className="text-white/60 text-sm mt-1">Solo suman puntos los torneos. Elegí tu localidad y categoría.</p>

      {/* Sexo: pill grupo grande */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {(['Todos', 'M', 'F'] as const).map(s => (
          <button key={s} onClick={() => setSex(s)}
            className={`py-3 rounded-2xl font-display font-black text-sm min-h-[52px]
              ${sex === s ? 'bg-ball text-courtdark' : 'bg-white/5 text-white/70 border border-white/10'}`}>
            {s === 'Todos' ? '⚧ Todos' : s === 'M' ? '♂ Masculino' : '♀ Femenino'}
          </button>
        ))}
      </div>

      {/* Categorías como chips scrollables */}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {CATS.map(c => (
          <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
            {c === 'Todas' ? 'Todas' : `${c}ma`}
          </Chip>
        ))}
        {filtrosActivos && (
          <Chip onClick={() => { setCat('Todas'); setSex('Todos'); setComplexId(''); }}>
            × Limpiar
          </Chip>
        )}
      </div>

      {/* Filtros de ciudad/complejo (secundarios) */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <select className="input !py-3" value={cityId} onChange={e => { setCityId(e.target.value); setComplexId(''); }}>
          <option value="">🌎 Todas las ciudades</option>
          {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input !py-3" value={complexId} onChange={e => setComplexId(e.target.value)}>
          <option value="">🏟 Todos los complejos</option>
          {complexes.filter(c => !cityId || c.city_id === cityId).map(c =>
            <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="mt-6">
        <p className="text-white/50 text-sm font-black uppercase tracking-widest mb-3">
          {rows.length} jugador{rows.length !== 1 ? 'es' : ''}
        </p>

        {rows.length === 0 && (
          <div className="card text-center py-10">
            <p className="text-3xl">🎾</p>
            <p className="text-white/60 mt-2">
              Todavía no hay puntos con estos filtros.
            </p>
          </div>
        )}

        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.player_id}>
              <Link href={`/u/${r.username}`}
                className="flex items-center gap-3 bg-grafito rounded-2xl p-3 active:scale-[0.98] transition">
                <span className={`w-12 text-center shrink-0 ${i < 3 ? 'text-2xl' : 'text-white/50 font-black text-sm'}`}>
                  {i < 3 ? MEDAL[i] : `#${i + 1}`}
                </span>
                <Avatar url={r.avatar_url} name={r.first_name} />
                <div className="flex-1 min-w-0">
                  <p className="font-display font-black text-base truncate leading-tight">
                    {r.first_name} {r.last_name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="bg-white/10 text-white/70 text-[10px] font-black rounded-md px-1.5 py-0.5">
                      cat. {r.category}
                    </span>
                    <span className="text-white/50 text-xs truncate">@{r.username}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display font-black text-ball text-2xl leading-none">{r.points}</p>
                  <p className="text-white/40 text-[10px] font-bold">pts</p>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
