'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { buildTournamentConfig, generateZonesFixture, generateKnockoutFixture } from '@/lib/torneos/plantillas';
import { sharePlaca } from '@/lib/placas';
import type { Sex } from '@/lib/types';

const pairName = (p: any) =>
  `${p.player1.first_name} ${p.player1.last_name} / ${p.player2.first_name} ${p.player2.last_name}`;

export default function TorneosComplejo() {
  const [cx, setCx] = useState<any>(null);
  const [torneos, setTorneos] = useState<any[]>([]);
  const [circuits, setCircuits] = useState<any[]>([]);
  // creación
  const [tipo, setTipo] = useState<'libre' | 'cat' | 'suma'>('suma');
  const [cat, setCat] = useState(4);
  const [suma, setSuma] = useState(13);
  const [sexo, setSexo] = useState<Sex | null>(null);
  const [name, setName] = useState('');
  const [maxPairs, setMaxPairs] = useState('8');
  const [format, setFormat] = useState<'zonas' | 'eliminacion'>('zonas');
  const [price, setPrice] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [circuitId, setCircuitId] = useState('');
  const [newCircuit, setNewCircuit] = useState('');
  const [msg, setMsg] = useState('');
  // resultados y cierre
  const [scores, setScores] = useState<Record<string, { score: string; winner: string }>>({});
  const [finish, setFinish] = useState<Record<string, { champ: string; final: string }>>({});
  const [standings, setStandings] = useState<Record<string, any[]>>({});

  const cfg = buildTournamentConfig({ tipo, cat, suma, sexo });

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: complex } = await supabase.from('complexes').select('*').eq('owner_id', user!.id).single();
    setCx(complex);
    const { data } = await supabase.from('tournaments')
      .select(`*, pairs:tournament_pairs(id, status, payment_proof_url,
          player1:profiles!tournament_pairs_player1_id_fkey(id, first_name, last_name),
          player2:profiles!tournament_pairs_player2_id_fkey(id, first_name, last_name)),
        tmatches:tournament_matches(id, round, score, winner_pair_id, pair1_id, pair2_id, order_index)`)
      .eq('complex_id', complex.id).order('created_at', { ascending: false });
    setTorneos(data ?? []);
    const { data: circs } = await supabase.from('circuits').select('*').eq('complex_id', complex.id).order('year', { ascending: false });
    setCircuits(circs ?? []);
  }
  useEffect(() => { load(); }, []);

  async function crearCircuito() {
    if (!newCircuit.trim()) return;
    const { data, error } = await supabase.from('circuits')
      .insert({ complex_id: cx.id, name: newCircuit.trim() }).select().single();
    if (error) return setMsg(error.message);
    setCircuits([data, ...circuits]); setCircuitId(data.id); setNewCircuit('');
  }

  async function crear() {
    setMsg('');
    const { error } = await supabase.from('tournaments').insert({
      complex_id: cx.id,
      template_key: `${tipo}${tipo === 'cat' ? `_${cat}` : tipo === 'suma' ? `_${suma}` : ''}${sexo ? `_${sexo}` : ''}`,
      name: name.trim() || cfg.name, rules: cfg.rules,
      format, sex: cfg.sex, categories: cfg.categories,
      sum_target: cfg.sumTarget, max_pairs: Number(maxPairs), status: 'inscripcion',
      price: Number(price || 0),
      starts_on: startsOn || null, ends_on: endsOn || null,
      circuit_id: circuitId || null
    });
    if (error) return setMsg(`No se pudo crear: ${error.message}`);
    await supabase.from('posts').insert({
      author_complex_id: cx.id, kind: 'torneo_abierto',
      text_content: `🏆 Abrimos la inscripción: ${name.trim() || cfg.name}.${Number(price) > 0 ? ` Inscripción $${Number(price).toLocaleString('es-AR')} por pareja.` : ''} ¡Anotate desde la app!`
    });
    setName(''); setPrice(''); load();
  }

  async function setPairStatus(pair: any, status: string) {
    await supabase.from('tournament_pairs').update({ status }).eq('id', pair.id);
    load();
  }

  async function eliminar(t: any) {
    if (!confirm(`¿Eliminar "${t.name}"? Se borran sus ${t.pairs.length} parejas y su fixture.`)) return;
    const { error } = await supabase.from('tournaments').delete().eq('id', t.id);
    if (error) alert(error.message);
    load();
  }

  async function generarFixture(t: any) {
    const pairIds = t.pairs.filter((p: any) => p.status !== 'rechazada'
      && (Number(t.price) === 0 || p.status === 'aprobada')).map((p: any) => p.id);
    if (pairIds.length < 3) return alert('Se necesitan al menos 3 parejas aprobadas para generar el fixture.');
    let matches;
    if (t.format === 'eliminacion') matches = generateKnockoutFixture(pairIds);
    else {
      const gen = generateZonesFixture(pairIds);
      for (const [z, ids] of Object.entries(gen.zones))
        for (const id of ids) await supabase.from('tournament_pairs').update({ zone: z }).eq('id', id);
      matches = gen.matches;
    }
    await supabase.from('tournament_matches').insert(matches.map(m => ({ ...m, tournament_id: t.id })));
    await supabase.from('tournaments').update({ status: 'en_juego' }).eq('id', t.id);
    await supabase.from('posts').insert({
      author_complex_id: cx.id, kind: 'fixture', ref_tournament_id: t.id,
      text_content: `📋 ¡Fixture publicado para ${t.name}! ${pairIds.length} parejas confirmadas.`
    });
    load();
  }

  async function guardarResultado(t: any, m: any) {
    const s = scores[m.id];
    if (!s?.winner) return;
    await supabase.from('tournament_matches')
      .update({ score: s.score || null, winner_pair_id: s.winner }).eq('id', m.id);
    load();
  }

  // Puntos automáticos al finalizar: campeón, finalista y participación
  async function finalizar(t: any) {
    const f = finish[t.id];
    if (!f?.champ) return alert('Elegí la pareja campeona.');
    const getRule = async (key: string, def: number) => {
      const { data } = await supabase.from('ranking_rules').select('points')
        .eq('rule_key', key).or(`complex_id.eq.${cx.id},complex_id.is.null`)
        .order('complex_id', { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
      return data?.points ?? def;
    };
    const [ptsChamp, ptsFinal, ptsPlayed] = await Promise.all([
      getRule('champion', 100), getRule('finalist', 60), getRule('tournament_played', 15)
    ]);
    const rows: any[] = [];
    for (const pair of t.pairs.filter((p: any) => p.status !== 'rechazada')) {
      for (const pl of [pair.player1, pair.player2]) {
        rows.push({ player_id: pl.id, complex_id: cx.id, rule_key: 'tournament_played', points: ptsPlayed, ref_tournament_id: t.id });
        if (pair.id === f.champ)
          rows.push({ player_id: pl.id, complex_id: cx.id, rule_key: 'champion', points: ptsChamp, ref_tournament_id: t.id });
        if (pair.id === f.final)
          rows.push({ player_id: pl.id, complex_id: cx.id, rule_key: 'finalist', points: ptsFinal, ref_tournament_id: t.id });
      }
    }
    // Insert vía función del complejo: usamos el service del propio trigger no disponible,
    // así que insertamos con la sesión del complejo (permitido para super_admin; para
    // complejos usamos la función segura de abajo)
    const { error } = await supabase.rpc('award_tournament_points', {
      t_id: t.id, rows_json: rows
    });
    if (error) return alert(`No se pudieron cargar los puntos: ${error.message}. ¿Ejecutaste update-06-pro.sql?`);
    const champ = t.pairs.find((p: any) => p.id === f.champ);
    await supabase.from('tournaments').update({ status: 'finalizado' }).eq('id', t.id);
    await supabase.from('posts').insert({
      author_complex_id: cx.id, kind: 'campeones', ref_tournament_id: t.id,
      text_content: `🥇 ¡Campeones de ${t.name}! ${champ ? pairName(champ) : ''}. Los puntos ya suman al ranking.`
    });
    load();
  }

  async function verCircuito(c: any) {
    const { data: ts } = await supabase.from('tournaments').select('id').eq('circuit_id', c.id);
    const ids = (ts ?? []).map(t => t.id);
    if (!ids.length) return setStandings({ ...standings, [c.id]: [] });
    const { data: pts } = await supabase.from('ranking_points')
      .select('points, player:profiles!player_id(first_name, last_name, username)')
      .in('ref_tournament_id', ids);
    const map = new Map<string, any>();
    (pts ?? []).forEach((r: any) => {
      const k = r.player.username;
      const prev = map.get(k);
      map.set(k, prev ? { ...prev, points: prev.points + r.points } : { ...r.player, points: r.points });
    });
    setStandings({ ...standings, [c.id]: Array.from(map.values()).sort((a, b) => b.points - a.points).slice(0, 10) });
  }

  const Chip = ({ active, onClick, children }: any) => (
    <button onClick={onClick}
      className={`px-3 py-2 rounded-xl text-sm font-bold transition ${active ? 'bg-ball text-courtdark' : 'bg-white/10 text-white/60'}`}>
      {children}
    </button>
  );

  const STATUS_CHIP: Record<string, string> = {
    pendiente: 'bg-yellow-400/20 text-yellow-300', aprobada: 'bg-green-400/20 text-green-300', rechazada: 'bg-red-400/20 text-red-300'
  };

  if (!cx) return <main className="p-8 text-white/70">Cargando…</main>;

  return (
    <main className="px-5 py-6">
      <h1 className="font-display font-black text-xl">Torneos</h1>

      {/* ---- Crear ---- */}
      <section className="mt-4 bg-white/5 rounded-2xl p-4">
        <p className="font-display font-bold text-ball text-sm">1 · Tipo</p>
        <div className="flex gap-2 mt-2">
          <Chip active={tipo === 'cat'} onClick={() => setTipo('cat')}>Por categoría</Chip>
          <Chip active={tipo === 'suma'} onClick={() => setTipo('suma')}>Suma</Chip>
          <Chip active={tipo === 'libre'} onClick={() => setTipo('libre')}>Abierto</Chip>
        </div>
        {tipo === 'cat' && <div className="flex gap-2 mt-2 flex-wrap">
          {[1,2,3,4,5,6,7,8].map(c => <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c}ª</Chip>)}</div>}
        {tipo === 'suma' && <div className="flex gap-2 mt-2 flex-wrap">
          {[10,11,12,13,14,15,16,17,18].map(s => <Chip key={s} active={suma === s} onClick={() => setSuma(s)}>{s}</Chip>)}</div>}

        <p className="font-display font-bold text-ball text-sm mt-4">2 · Género</p>
        <div className="flex gap-2 mt-2">
          <Chip active={sexo === 'M'} onClick={() => setSexo('M')}>Masculino</Chip>
          <Chip active={sexo === 'F'} onClick={() => setSexo('F')}>Femenino</Chip>
          <Chip active={sexo === 'X'} onClick={() => setSexo('X')}>Mixto</Chip>
          <Chip active={sexo === null} onClick={() => setSexo(null)}>Todos</Chip>
        </div>

        <p className="font-display font-bold text-ball text-sm mt-4">3 · Detalles</p>
        <input className="input mt-2" placeholder={`Nombre sugerido: ${cfg.name}`}
          value={name} onChange={e => setName(e.target.value)} />
        <div className="grid grid-cols-3 gap-2 mt-2">
          <div><label className="label text-white/60">Inscripción $</label>
            <input className="input" type="number" placeholder="0"
              value={price} onChange={e => setPrice(e.target.value)} /></div>
          <div><label className="label text-white/60">Parejas</label>
            <select className="input" value={maxPairs} onChange={e => setMaxPairs(e.target.value)}>
              {[4, 8, 12, 16, 24, 32].map(n => <option key={n}>{n}</option>)}
            </select></div>
          <div><label className="label text-white/60">Formato</label>
            <select className="input" value={format} onChange={e => setFormat(e.target.value as any)}>
              <option value="zonas">Zonas</option><option value="eliminacion">Eliminación</option>
            </select></div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div><label className="label text-white/60">Empieza</label>
            <input type="date" className="input" value={startsOn} onChange={e => setStartsOn(e.target.value)} /></div>
          <div><label className="label text-white/60">Termina</label>
            <input type="date" className="input" value={endsOn} onChange={e => setEndsOn(e.target.value)} /></div>
        </div>
        <div className="mt-2"><label className="label text-white/60">Circuito anual (opcional)</label>
          <div className="flex gap-2">
            <select className="input" value={circuitId} onChange={e => setCircuitId(e.target.value)}>
              <option value="">Sin circuito</option>
              {circuits.map(c => <option key={c.id} value={c.id}>{c.name} {c.year}</option>)}
            </select>
          </div>
          <div className="flex gap-2 mt-2">
            <input className="input !py-2 text-sm" placeholder="Crear circuito (ej: Circuito Monte 2026)"
              value={newCircuit} onChange={e => setNewCircuit(e.target.value)} />
            <button onClick={crearCircuito} className="btn-ball !py-2 text-sm shrink-0">+ Crear</button>
          </div>
        </div>
        {msg && <p className="text-red-400 text-sm mt-2">{msg}</p>}
        <button onClick={crear} className="btn-ball w-full mt-3">Publicar «{name.trim() || cfg.name}»</button>
      </section>

      {/* ---- Torneos ---- */}
      <section className="mt-6 space-y-3">
        {torneos.map(t => {
          const fixture = [...(t.tmatches ?? [])].sort((a, b) => a.order_index - b.order_index);
          const findPair = (pid: string) => t.pairs.find((p: any) => p.id === pid);
          return (
            <div key={t.id} className="bg-white/5 rounded-2xl p-4">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="font-display font-black">{t.name}</p>
                  <p className="text-white/50 text-sm">
                    {t.pairs.length}/{t.max_pairs} parejas
                    {Number(t.price) > 0 ? ` · $${Number(t.price).toLocaleString('es-AR')}` : ' · gratis'}
                    {t.starts_on ? ` · ${new Date(t.starts_on + 'T00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}` : ''}
                  </p>
                </div>
                <span className="text-xs font-bold uppercase text-ball shrink-0">{t.status}</span>
              </div>

              {/* Inscriptos con comprobante y aprobación */}
              {t.pairs.length > 0 && (
                <div className="mt-3 space-y-2">
                  {t.pairs.map((p: any) => (
                    <div key={p.id} className="bg-white/5 rounded-xl p-2.5 flex items-center gap-2">
                      <span className="flex-1 text-sm font-semibold truncate">{pairName(p)}</span>
                      {p.payment_proof_url && (
                        <a href={p.payment_proof_url} target="_blank"
                          className="text-xs font-bold text-ball underline shrink-0">🧾 Ver pago</a>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase shrink-0 ${STATUS_CHIP[p.status]}`}>
                        {p.status}
                      </span>
                      {t.status === 'inscripcion' && p.status === 'pendiente' && (
                        <span className="flex gap-1 shrink-0">
                          <button onClick={() => setPairStatus(p, 'aprobada')} className="bg-green-500/80 rounded-lg w-8 h-8 font-bold">✓</button>
                          <button onClick={() => setPairStatus(p, 'rechazada')} className="bg-red-500/70 rounded-lg w-8 h-8 font-bold">✕</button>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Cargar resultados del fixture */}
              {t.status === 'en_juego' && fixture.length > 0 && (
                <div className="mt-3">
                  <p className="text-white/40 text-xs font-bold uppercase">Cargar resultados</p>
                  <div className="mt-1 space-y-2">
                    {fixture.filter(m => m.pair1_id && m.pair2_id).map(m => (
                      <div key={m.id} className="bg-white/5 rounded-xl p-2.5">
                        <p className="text-xs font-bold text-ball">{m.round}</p>
                        <p className="text-sm">{findPair(m.pair1_id) ? pairName(findPair(m.pair1_id)) : '?'} <span className="text-white/40">vs</span> {findPair(m.pair2_id) ? pairName(findPair(m.pair2_id)) : '?'}</p>
                        {m.winner_pair_id ? (
                          <p className="text-green-300 text-xs font-bold mt-1">✓ {m.score ?? ''} · ganó {findPair(m.winner_pair_id) ? pairName(findPair(m.winner_pair_id)) : ''}</p>
                        ) : (
                          <div className="flex gap-2 mt-1.5">
                            <input className="input !py-1.5 !w-28 text-sm" placeholder="6-4 6-3"
                              value={scores[m.id]?.score ?? ''}
                              onChange={e => setScores({ ...scores, [m.id]: { ...(scores[m.id] ?? { winner: '' }), score: e.target.value } })} />
                            <select className="input !py-1.5 text-sm"
                              value={scores[m.id]?.winner ?? ''}
                              onChange={e => setScores({ ...scores, [m.id]: { ...(scores[m.id] ?? { score: '' }), winner: e.target.value } })}>
                              <option value="">Ganador…</option>
                              <option value={m.pair1_id}>{findPair(m.pair1_id) ? pairName(findPair(m.pair1_id)) : ''}</option>
                              <option value={m.pair2_id}>{findPair(m.pair2_id) ? pairName(findPair(m.pair2_id)) : ''}</option>
                            </select>
                            <button onClick={() => guardarResultado(t, m)} className="btn-ball !py-1.5 !px-3 text-xs shrink-0">✓</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Finalizar con puntos automáticos */}
                  <div className="mt-3 bg-white/5 rounded-xl p-3">
                    <p className="text-xs font-bold text-ball uppercase">Finalizar torneo (los puntos se cargan solos)</p>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <select className="input !py-2 text-sm"
                        value={finish[t.id]?.champ ?? ''}
                        onChange={e => setFinish({ ...finish, [t.id]: { ...(finish[t.id] ?? { final: '' }), champ: e.target.value } })}>
                        <option value="">🥇 Campeón…</option>
                        {t.pairs.map((p: any) => <option key={p.id} value={p.id}>{pairName(p)}</option>)}
                      </select>
                      <select className="input !py-2 text-sm"
                        value={finish[t.id]?.final ?? ''}
                        onChange={e => setFinish({ ...finish, [t.id]: { ...(finish[t.id] ?? { champ: '' }), final: e.target.value } })}>
                        <option value="">🥈 Finalista…</option>
                        {t.pairs.map((p: any) => <option key={p.id} value={p.id}>{pairName(p)}</option>)}
                      </select>
                    </div>
                    <button onClick={() => finalizar(t)} className="btn-ball w-full mt-2 text-sm">🏁 Finalizar y repartir puntos</button>
                  </div>
                </div>
              )}

              <div className="flex gap-2 mt-3 flex-wrap">
                {t.status === 'inscripcion' && (
                  <button onClick={() => generarFixture(t)} className="btn-ball text-sm">Cerrar inscripción y generar fixture</button>
                )}
                <button onClick={() => sharePlaca({
                  kind: 'torneo_abierto', title: t.name, main: cx?.name,
                  detail: `${t.sum_target ? `Suma ${t.sum_target} · ` : ''}${Number(t.price) > 0 ? `$${Number(t.price).toLocaleString('es-AR')} · ` : ''}${t.max_pairs} parejas`,
                  footer: 'Inscribite por Narvoq'
                })} className="px-3 py-2 rounded-xl bg-white/10 text-sm font-semibold">📸 Placa</button>
                <button onClick={() => eliminar(t)}
                  className="px-3 py-2 rounded-xl border border-red-400/40 text-red-400 text-sm font-semibold ml-auto">🗑️</button>
              </div>
            </div>
          );
        })}
      </section>

      {/* ---- Circuitos ---- */}
      {circuits.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display font-bold text-ball">Circuitos anuales</h2>
          <div className="mt-2 space-y-2">
            {circuits.map(c => (
              <div key={c.id} className="bg-white/5 rounded-2xl p-4">
                <div className="flex justify-between items-center">
                  <p className="font-display font-bold">{c.name} · {c.year}</p>
                  <button onClick={() => verCircuito(c)} className="text-ball text-sm font-semibold">Ver acumulado →</button>
                </div>
                {standings[c.id] && (
                  <ol className="mt-2 space-y-1 text-sm">
                    {standings[c.id].map((r: any, i: number) => (
                      <li key={r.username} className="flex justify-between">
                        <span>{i + 1}. {r.first_name} {r.last_name}</span>
                        <span className="font-bold text-ball">{r.points} pts</span>
                      </li>
                    ))}
                    {standings[c.id].length === 0 && <p className="text-white/40">Todavía sin puntos en este circuito.</p>}
                  </ol>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
