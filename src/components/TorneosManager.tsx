'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { recommendFormat } from '@/lib/torneos/motor';
import { generateFullTournament, generateKnockoutStage, recordMatchResult, checkAndCloseTournament } from '@/lib/torneos/persist';

// Manager de torneos usable por complejos Y por entrenadores.
// Se pasa `owner: { type: 'complex'|'coach', id: uuid }`.
export default function TorneosManager({ owner }: { owner: { type: 'complex' | 'coach'; id: string; name?: string } }) {
  const [torneos, setTorneos] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [step, setStep] = useState<'lista' | 'nuevo' | 'gestionar'>('lista');
  const [msg, setMsg] = useState('');

  // form nuevo torneo
  const [f, setF] = useState({
    name: '', tipo: 'suma' as 'libre' | 'cat' | 'suma',
    cat: '4', suma: '13', sexo: 'X' as 'M' | 'F' | 'X' | '',
    match_format: 'best_of_3_super_tb',
    points_win: '3', points_loss: '0',
    starts_on: '', price: '0'
  });

  async function load() {
    let q = supabase.from('tournaments')
      .select('*, pairs:tournament_pairs(id, status)')
      .order('created_at', { ascending: false });
    if (owner.type === 'complex') q = q.eq('complex_id', owner.id);
    else q = q.eq('owner_coach_id', owner.id);
    const { data } = await q;
    setTorneos(data ?? []);
  }
  useEffect(() => { load(); }, [owner.id, owner.type]);

  async function crear() {
    setMsg('');
    const config = {
      name: f.name.trim() || nombreDefecto(f),
      tipo: f.tipo, cat: Number(f.cat), suma: Number(f.suma), sexo: f.sexo || null
    };
    const payload: any = {
      name: config.name,
      rules: 'Formato configurable. Partidos según configuración del torneo.',
      format: 'zonas',
      sex: config.sexo,
      categories: f.tipo === 'cat' ? [config.cat, Math.min(config.cat + 1, 8)] : [1,2,3,4,5,6,7,8],
      sum_target: f.tipo === 'suma' ? config.suma : null,
      max_pairs: 32,
      status: 'inscripcion',
      starts_on: f.starts_on || null,
      price: Number(f.price) || 0,
      engine: 'v2',
      owner_type: owner.type,
      match_format: f.match_format,
      points_win: Number(f.points_win),
      points_loss: Number(f.points_loss),
      group_size: 4,
      template_key: `v2_${f.tipo}${f.tipo==='cat'?`_${f.cat}`:f.tipo==='suma'?`_${f.suma}`:''}`
    };
    if (owner.type === 'complex') payload.complex_id = owner.id;
    else payload.owner_coach_id = owner.id;

    const { data, error } = await supabase.from('tournaments').insert(payload).select().single();
    if (error) return setMsg(`No se pudo crear: ${error.message}. ¿Ejecutaste update-17-tournaments-pro.sql?`);
    setSel(data);
    setStep('gestionar');
    load();
  }

  function nombreDefecto(fx: typeof f) {
    const sexLabel = fx.sexo === 'M' ? 'Masculino' : fx.sexo === 'F' ? 'Femenino' : fx.sexo === 'X' ? 'Mixto' : 'Abierto';
    if (fx.tipo === 'cat') return `Torneo Cat. ${fx.cat} ${sexLabel}`;
    if (fx.tipo === 'suma') return `Torneo Suma ${fx.suma} ${sexLabel}`;
    return `Torneo Abierto ${sexLabel}`;
  }

  return (
    <main className="px-5 py-6 pb-24">
      <h1 className="h-hero">Torneos</h1>
      <p className="text-white/60 text-sm mt-1">
        Motor automático: generá grupos, cargá resultados y la app arma la fase eliminatoria sola.
      </p>

      {step === 'lista' && (
        <>
          <button onClick={() => setStep('nuevo')} className="btn-ball w-full mt-5">
            + Nuevo torneo
          </button>

          <section className="mt-5 space-y-3">
            {torneos.map(t => (
              <button key={t.id} onClick={() => { setSel(t); setStep('gestionar'); }}
                className="w-full card text-left flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-display font-black">{t.name}</p>
                  <p className="text-white/50 text-xs">
                    {t.pairs?.length ?? 0}/{t.max_pairs} parejas · {t.status}
                    {t.engine === 'v2' && ' · Motor v2'}
                  </p>
                </div>
                <span className="text-ball">→</span>
              </button>
            ))}
            {torneos.length === 0 && (
              <p className="text-white/50 text-sm">Todavía no creaste torneos.</p>
            )}
          </section>
        </>
      )}

      {step === 'nuevo' && (
        <NuevoTorneo f={f} setF={setF} onCancelar={() => setStep('lista')} onCrear={crear} msg={msg} />
      )}

      {step === 'gestionar' && sel && (
        <Gestionar torneo={sel} onVolver={() => { setStep('lista'); setSel(null); load(); }} />
      )}
    </main>
  );
}

// -------- Sub-componentes --------

function NuevoTorneo({ f, setF, onCancelar, onCrear, msg }: any) {
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <section className="mt-5 card space-y-4">
      <p className="font-display font-black text-ball text-sm">1. DATOS DEL TORNEO</p>

      <div><label className="label">Nombre (opcional)</label>
        <input className="input" placeholder="Ej: Torneo Suma 13 · Marzo"
          value={f.name} onChange={set('name')} /></div>

      <div className="grid grid-cols-3 gap-2">
        {[['suma','Suma X'],['cat','Categoría'],['libre','Abierto']].map(([k, l]) => (
          <button key={k} onClick={() => setF({ ...f, tipo: k })}
            className={`py-3 rounded-xl text-sm font-black ${f.tipo === k ? 'bg-ball text-courtdark' : 'bg-white/5 text-white/60'}`}>
            {l}
          </button>
        ))}
      </div>

      {f.tipo === 'cat' && (
        <div><label className="label">Categoría</label>
          <select className="input" value={f.cat} onChange={set('cat')}>
            {[1,2,3,4,5,6,7,8].map(c => <option key={c} value={c}>{c}</option>)}
          </select></div>
      )}
      {f.tipo === 'suma' && (
        <div><label className="label">Suma</label>
          <select className="input" value={f.suma} onChange={set('suma')}>
            {Array.from({length: 9}, (_, i) => 10 + i).map(s => <option key={s} value={s}>{s}</option>)}
          </select></div>
      )}

      <div><label className="label">Modalidad</label>
        <div className="grid grid-cols-4 gap-2">
          {[['','Abierto'],['M','Masc'],['F','Fem'],['X','Mixto']].map(([k, l]) => (
            <button key={k} onClick={() => setF({ ...f, sexo: k })}
              className={`py-3 rounded-xl text-sm font-black ${f.sexo === k ? 'bg-ball text-courtdark' : 'bg-white/5 text-white/60'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-3 border-t border-white/10">
        <p className="font-display font-black text-ball text-sm mb-2">2. CONFIGURACIÓN DEL MOTOR</p>
        <div><label className="label">Formato de partido</label>
          <select className="input" value={f.match_format} onChange={set('match_format')}>
            <option value="best_of_3_super_tb">Al mejor de 3 sets (super TB en el 3°)</option>
            <option value="best_of_3_full">Al mejor de 3 sets completos</option>
            <option value="single_set">Un set único</option>
            <option value="super_tiebreak">Solo super tiebreak</option>
          </select></div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div><label className="label">Puntos por victoria</label>
            <input className="input text-center" type="number" min={1} max={5} value={f.points_win} onChange={set('points_win')} /></div>
          <div><label className="label">Puntos por derrota</label>
            <input className="input text-center" type="number" min={0} max={2} value={f.points_loss} onChange={set('points_loss')} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div><label className="label">Fecha inicio</label>
            <input className="input" type="date" value={f.starts_on} onChange={set('starts_on')} /></div>
          <div><label className="label">Inscripción $</label>
            <input className="input" type="number" min={0} value={f.price} onChange={set('price')} /></div>
        </div>
      </div>

      {msg && <p className="text-red-500 text-sm">{msg}</p>}
      <div className="flex gap-2 pt-2">
        <button onClick={onCancelar} className="flex-1 btn-ghost">Cancelar</button>
        <button onClick={onCrear} className="flex-1 btn-ball">Crear torneo</button>
      </div>
    </section>
  );
}

function Gestionar({ torneo, onVolver }: any) {
  const [pairs, setPairs] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    const { data: ps } = await supabase.from('tournament_pairs')
      .select(`*,
        p1:profiles!player1_id(id, first_name, last_name, avatar_url, category),
        p2:profiles!player2_id(id, first_name, last_name, avatar_url, category)`)
      .eq('tournament_id', torneo.id).order('created_at');
    setPairs(ps ?? []);
    const { data: ms } = await supabase.from('tournament_matches')
      .select('*, sets:match_sets(t1_games,t2_games,set_number,is_super_tiebreak)')
      .eq('tournament_id', torneo.id).order('order_index');
    setMatches(ms ?? []);
    const { data: gs } = await supabase.from('tournament_groups')
      .select('*, members:group_memberships(pair_id, final_position)')
      .eq('tournament_id', torneo.id).order('order_index');
    setGroups(gs ?? []);
  }
  useEffect(() => { load(); }, [torneo.id]);

  const aprobadas = pairs.filter(p => p.status === 'aprobada');
  const preview = useMemo(() => recommendFormat(aprobadas.length), [aprobadas.length]);
  const grupoGenerado = groups.length > 0;
  const knockoutGenerado = matches.some(m => !String(m.round).toLowerCase().startsWith('zona'));
  const zonaTerminada = grupoGenerado && matches
    .filter(m => String(m.round).toLowerCase().startsWith('zona'))
    .every(m => m.winner_pair_id || m.special_winner_pair_id);

  async function togglePairStatus(p: any, next: 'aprobada' | 'rechazada' | 'pendiente') {
    await supabase.from('tournament_pairs').update({ status: next }).eq('id', p.id);
    load();
  }
  async function delPair(p: any) {
    if (!confirm('¿Eliminar esta pareja?')) return;
    await supabase.from('tournament_pairs').delete().eq('id', p.id);
    load();
  }

  async function generar() {
    setBusy(true); setMsg('');
    try {
      const r = await generateFullTournament(torneo.id);
      setMsg(`✓ Generados ${r.groups} grupos y ${r.matches} partidos de fase de grupos.`);
      load();
    } catch (e: any) { setMsg(e.message); }
    setBusy(false);
  }

  async function generarKO() {
    setBusy(true); setMsg('');
    try {
      const r = await generateKnockoutStage(torneo.id);
      setMsg(`✓ Fase eliminatoria generada con ${r.matches} partidos.`);
      load();
    } catch (e: any) { setMsg(e.message); }
    setBusy(false);
  }

  async function guardarResultado(matchId: string, setsInput: string, walkover: string) {
    setMsg('');
    try {
      if (walkover) {
        // Formato: "walkover:pairId"
        const [type, pairId] = walkover.split(':');
        await recordMatchResult(matchId, null, { type: type as any, winnerPairId: pairId });
      } else {
        const sets = setsInput.trim().split(/\s+/).map(s => {
          const [a, b] = s.split('-').map(Number);
          return { t1: a, t2: b };
        }).filter(s => !isNaN(s.t1) && !isNaN(s.t2));
        if (!sets.length) { setMsg('Formato de score inválido. Ej: 6-4 3-6 6-4'); return; }
        await recordMatchResult(matchId, sets, undefined);
      }
      await checkAndCloseTournament(torneo.id);
      load();
    } catch (e: any) { setMsg(e.message); }
  }

  return (
    <section className="mt-5 space-y-4">
      <button onClick={onVolver} className="text-white/60 text-sm font-bold">← Volver a torneos</button>

      <div className="card">
        <p className="font-display font-black text-xl">{torneo.name}</p>
        <p className="text-white/50 text-sm">Estado: {torneo.status} · {aprobadas.length} parejas aprobadas</p>
        <Link href={`/torneo/${torneo.id}`} className="text-ball text-sm font-bold mt-2 inline-block">
          Ver vista pública del torneo →
        </Link>
      </div>

      {/* Preview del formato */}
      <div className="card">
        <p className="font-display font-black text-ball text-sm">RECOMENDACIÓN DEL MOTOR</p>
        <p className="mt-2 text-white text-sm">
          Con <b className="text-ball">{aprobadas.length} parejas</b> aprobadas:
        </p>
        <ul className="mt-2 space-y-1 text-sm text-white/70">
          {preview.notes.map((n, i) => <li key={i}>• {n}</li>)}
        </ul>
      </div>

      {/* Inscriptos */}
      <div className="card">
        <div className="flex items-center justify-between">
          <p className="font-display font-black text-ball text-sm">INSCRIPTOS ({pairs.length})</p>
          <button onClick={() => setShowAdd(v => !v)} className="text-ball text-xs font-black">
            {showAdd ? 'Cancelar' : '+ Agregar pareja'}
          </button>
        </div>
        {showAdd && (
          <AddPairForm tournamentId={torneo.id} onAdded={() => { setShowAdd(false); load(); }} />
        )}
        <ul className="mt-3 space-y-2">
          {pairs.map(p => (
            <li key={p.id} className="bg-white/5 rounded-xl p-3">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {p.p1?.avatar_url ? <img src={p.p1.avatar_url} className="w-8 h-8 rounded-full" /> :
                    <span className="w-8 h-8 rounded-full bg-grafito text-ball text-xs font-black flex items-center justify-center">{(p.p1?.first_name ?? p.provisional_p1_name ?? '?')[0]}</span>}
                  {p.p2?.avatar_url ? <img src={p.p2.avatar_url} className="w-8 h-8 rounded-full" /> :
                    <span className="w-8 h-8 rounded-full bg-grafito text-ball text-xs font-black flex items-center justify-center">{(p.p2?.first_name ?? p.provisional_p2_name ?? '?')[0]}</span>}
                </div>
                <div className="flex-1 min-w-0 text-sm">
                  <p className="truncate font-semibold">
                    {p.p1 ? `${p.p1.first_name} ${p.p1.last_name}` : p.provisional_p1_name ?? '?'} & {p.p2 ? `${p.p2.first_name} ${p.p2.last_name}` : p.provisional_p2_name ?? '?'}
                  </p>
                  <p className={`text-xs font-black ${p.status === 'aprobada' ? 'text-ball' : p.status === 'rechazada' ? 'text-red-400' : 'text-yellow-300'}`}>
                    {p.status.toUpperCase()}
                    {p.provisional_p1_name && ' · provisional'}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {p.status !== 'aprobada' && (
                    <button onClick={() => togglePairStatus(p, 'aprobada')}
                      className="bg-ball text-courtdark text-xs font-black px-2 py-1.5 rounded">✓</button>
                  )}
                  {p.status !== 'rechazada' && (
                    <button onClick={() => togglePairStatus(p, 'rechazada')}
                      className="bg-white/10 text-xs px-2 py-1.5 rounded">✕</button>
                  )}
                  <button onClick={() => delPair(p)} className="text-white/40 px-1">🗑</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Acciones del motor */}
      <div className="card space-y-2">
        <p className="font-display font-black text-ball text-sm">MOTOR</p>
        {!grupoGenerado && aprobadas.length >= 3 && (
          <button onClick={generar} disabled={busy}
            className="btn-ball w-full">
            {busy ? 'Generando…' : 'Generar fase de grupos'}
          </button>
        )}
        {grupoGenerado && !knockoutGenerado && (
          <button onClick={generarKO} disabled={busy || !zonaTerminada}
            className="btn-ball w-full disabled:opacity-40">
            {busy ? 'Generando…' : zonaTerminada ? 'Generar fase eliminatoria' : 'Cargá todos los resultados de grupos primero'}
          </button>
        )}
        {msg && <p className="text-sm text-ball">{msg}</p>}
      </div>

      {/* Cargar resultados */}
      {matches.length > 0 && (
        <div className="card">
          <p className="font-display font-black text-ball text-sm mb-3">CARGAR RESULTADOS</p>
          <ul className="space-y-3">
            {matches.map(m => (
              <MatchRow key={m.id} m={m} pairs={pairs} onSave={guardarResultado} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function AddPairForm({ tournamentId, onAdded }: any) {
  const [tipo, setTipo] = useState<'usuarios' | 'provisional'>('usuarios');
  const [u1, setU1] = useState(''); const [u2, setU2] = useState('');
  const [n1, setN1] = useState(''); const [n2, setN2] = useState('');
  const [msg, setMsg] = useState('');

  async function add() {
    setMsg('');
    let payload: any = { tournament_id: tournamentId, status: 'aprobada' };
    if (tipo === 'usuarios') {
      const { data: p1 } = await supabase.from('profiles').select('id').eq('username', u1.toLowerCase().trim()).maybeSingle();
      const { data: p2 } = await supabase.from('profiles').select('id').eq('username', u2.toLowerCase().trim()).maybeSingle();
      if (!p1 || !p2) return setMsg('Alguno de los usuarios no existe.');
      if (p1.id === p2.id) return setMsg('No pueden ser el mismo jugador.');
      payload.player1_id = p1.id; payload.player2_id = p2.id;
    } else {
      if (!n1.trim() || !n2.trim()) return setMsg('Cargá los dos nombres.');
      payload.provisional_p1_name = n1.trim();
      payload.provisional_p2_name = n2.trim();
    }
    const { error } = await supabase.from('tournament_pairs').insert(payload);
    if (error) return setMsg(error.message);
    setU1(''); setU2(''); setN1(''); setN2('');
    onAdded();
  }

  return (
    <div className="mt-3 bg-white/5 rounded-xl p-3 space-y-2">
      <div className="flex gap-2">
        {[['usuarios','Usuarios de la app'],['provisional','Jugadores sin cuenta']].map(([k, l]) => (
          <button key={k} onClick={() => setTipo(k as any)}
            className={`flex-1 py-2 rounded-lg text-xs font-black ${tipo === k ? 'bg-ball text-courtdark' : 'bg-white/10 text-white/60'}`}>
            {l}
          </button>
        ))}
      </div>
      {tipo === 'usuarios' ? (
        <>
          <input className="input" placeholder="@usuario del jugador 1" value={u1} onChange={e => setU1(e.target.value)} />
          <input className="input" placeholder="@usuario del jugador 2" value={u2} onChange={e => setU2(e.target.value)} />
        </>
      ) : (
        <>
          <input className="input" placeholder="Nombre y apellido jugador 1" value={n1} onChange={e => setN1(e.target.value)} />
          <input className="input" placeholder="Nombre y apellido jugador 2" value={n2} onChange={e => setN2(e.target.value)} />
        </>
      )}
      {msg && <p className="text-red-400 text-xs">{msg}</p>}
      <button onClick={add} className="btn-ball w-full !py-3 text-sm">Agregar pareja</button>
    </div>
  );
}

function MatchRow({ m, pairs, onSave }: any) {
  const p1 = pairs.find((p: any) => p.id === m.pair1_id);
  const p2 = pairs.find((p: any) => p.id === m.pair2_id);
  const [score, setScore] = useState(m.sets?.length ? m.sets.sort((a: any, b: any) => a.set_number - b.set_number).map((s: any) => `${s.t1_games}-${s.t2_games}`).join(' ') : '');
  const [wo, setWo] = useState('');
  const played = !!m.winner_pair_id;

  const name = (p: any) => !p ? 'A definir' :
    (p.p1 ? `${p.p1.first_name} ${p.p1.last_name?.[0] ?? ''}.` : p.provisional_p1_name ?? '?') + ' & ' +
    (p.p2 ? `${p.p2.first_name} ${p.p2.last_name?.[0] ?? ''}.` : p.provisional_p2_name ?? '?');

  return (
    <li className={`rounded-xl p-3 ${played ? 'bg-ball/10 border border-ball/30' : 'bg-white/5'}`}>
      <p className="text-white/50 text-[10px] font-black uppercase tracking-widest">{m.round}</p>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center mt-2 text-sm">
        <span className={m.winner_pair_id === m.pair1_id ? 'text-ball font-black' : 'text-white/70'}>{name(p1)}</span>
        <span className="text-white/40 text-xs">vs</span>
        <span className={`text-right ${m.winner_pair_id === m.pair2_id ? 'text-ball font-black' : 'text-white/70'}`}>{name(p2)}</span>
      </div>
      {p1 && p2 && (
        <div className="mt-2 flex gap-2">
          <input className="input !py-2 text-sm flex-1" placeholder="6-4 3-6 6-4"
            value={score} onChange={e => setScore(e.target.value)} />
          <button onClick={() => onSave(m.id, score, wo)}
            className="bg-ball text-courtdark text-xs font-black px-3 rounded-lg">Guardar</button>
        </div>
      )}
      {p1 && p2 && !played && (
        <div className="mt-2 flex gap-1 text-[10px]">
          {(['walkover', 'abandono', 'dq'] as const).map(t => (
            <button key={t} onClick={() => setWo(`${t}:${m.pair1_id}`) }
              className="flex-1 py-1 rounded bg-white/10 text-white/60">{t} p1</button>
          ))}
          {(['walkover', 'abandono', 'dq'] as const).map(t => (
            <button key={t + '2'} onClick={() => setWo(`${t}:${m.pair2_id}`)}
              className="flex-1 py-1 rounded bg-white/10 text-white/60">{t} p2</button>
          ))}
        </div>
      )}
      {wo && (
        <div className="mt-2 flex gap-2 items-center text-xs">
          <span className="text-yellow-300">→ {wo}</span>
          <button onClick={() => onSave(m.id, '', wo)} className="bg-yellow-300 text-black px-2 py-1 rounded font-black">Confirmar</button>
          <button onClick={() => setWo('')} className="text-white/40">×</button>
        </div>
      )}
    </li>
  );
}
