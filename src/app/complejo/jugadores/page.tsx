'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

// Observar y ascender: ranking interno + candidatos + ascenso con un clic
export default function Jugadores() {
  const [cx, setCx] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [watch, setWatch] = useState<string[]>([]);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: complex } = await supabase.from('complexes').select('*').eq('owner_id', user!.id).single();
    setCx(complex);
    const { data: r } = await supabase.from('v_ranking').select('*')
      .eq('complex_id', complex.id).order('points', { ascending: false }).limit(60);
    setRows(r ?? []);
    const { data: w } = await supabase.from('watchlist').select('player_id').eq('complex_id', complex.id);
    setWatch((w ?? []).map(x => x.player_id));
  }
  useEffect(() => { load(); }, []);

  async function toggleWatch(pid: string) {
    if (watch.includes(pid)) {
      await supabase.from('watchlist').delete().eq('complex_id', cx.id).eq('player_id', pid);
      setWatch(watch.filter(x => x !== pid));
    } else {
      await supabase.from('watchlist').insert({ complex_id: cx.id, player_id: pid });
      setWatch([...watch, pid]);
    }
  }

  async function ascender(p: any) {
    if (p.category <= 1) return alert('Ya está en la máxima categoría.');
    const nueva = p.category - 1;
    if (!confirm(`¿Ascender a ${p.first_name} ${p.last_name} de categoría ${p.category} a ${nueva}?`)) return;
    const { error } = await supabase.rpc('promote_player', { pid: p.player_id, new_cat: nueva });
    if (error) return alert(`No se pudo: ${error.message}. ¿Ejecutaste update-06-pro.sql?`);
    await supabase.from('posts').insert({
      author_complex_id: cx.id, kind: 'manual',
      text_content: `📈 ¡Ascenso! ${p.first_name} ${p.last_name} sube a categoría ${nueva}. ¡Felicitaciones!`
    });
    load();
  }

  const Row = ({ p, i }: any) => (
    <div className="bg-white/5 rounded-2xl p-3 flex items-center gap-3">
      <span className="font-display font-black text-ball w-6 text-center">{i + 1}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{p.first_name} {p.last_name}</p>
        <p className="text-white/40 text-xs">@{p.username} · cat. {p.category} · {p.points} pts torneo</p>
      </div>
      <button onClick={() => toggleWatch(p.player_id)} title="Observar"
        className={`text-xl ${watch.includes(p.player_id) ? '' : 'grayscale opacity-40'}`}>⭐</button>
      <button onClick={() => ascender(p)}
        className="btn-ball !py-1.5 !px-3 text-xs shrink-0">↑ Ascender</button>
    </div>
  );

  if (!cx) return <main className="p-8 text-white/70">Cargando…</main>;
  const candidatos = rows.filter(r => watch.includes(r.player_id));

  return (
    <main className="px-5 py-6">
      <h1 className="font-display font-black text-xl">Jugadores del complejo</h1>
      <p className="text-white/50 text-sm mt-1">⭐ Marcá candidatos a ascenso · ↑ Ascendé con un clic (baja el número de categoría). El ascenso se anuncia en el feed.</p>

      {candidatos.length > 0 && (
        <section className="mt-4">
          <p className="font-display font-bold text-ball text-sm">⭐ En observación ({candidatos.length})</p>
          <div className="mt-2 space-y-2">
            {candidatos.map((p, i) => <Row key={p.player_id} p={p} i={rows.indexOf(p)} />)}
          </div>
        </section>
      )}

      <section className="mt-4">
        <p className="font-display font-bold text-ball text-sm">Ranking interno (puntos de torneos acá)</p>
        <div className="mt-2 space-y-2">
          {rows.map((p, i) => <Row key={p.player_id} p={p} i={i} />)}
          {rows.length === 0 && <p className="text-white/40 text-sm">Todavía nadie sumó puntos de torneo en tu complejo.</p>}
        </div>
      </section>
    </main>
  );
}
