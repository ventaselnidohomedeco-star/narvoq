'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { recommendFormat } from '@/lib/torneos/motor';
import { generateFullTournament, generateKnockoutStage, recordMatchResult, checkAndCloseTournament, propagateAllWinners, validateTournamentBracket, confirmBracket, unfreezeBracket } from '@/lib/torneos/persist';

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
  const [validation, setValidation] = useState<{ ok: boolean; errors: any[]; warnings: any[] } | null>(null);
  const [confirmed, setConfirmed] = useState<boolean>(!!torneo.bracket_confirmed_at);

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
        {knockoutGenerado && (
          <>
            <button
              onClick={async () => {
                setBusy(true); setMsg('');
                try {
                  const n = await propagateAllWinners(torneo.id);
                  setMsg(n > 0 ? `✓ ${n} slot(s) actualizados en la fase siguiente.` : 'Todo al día — nada para actualizar.');
                  load();
                } catch (e: any) { setMsg(e.message); }
                setBusy(false);
              }}
              disabled={busy}
              className="w-full py-3 rounded-xl bg-ball/15 border border-ball/40 text-ball font-black text-sm">
              → Actualizar fase siguiente
            </button>
            <button
              onClick={async () => {
                if (!confirm('¿Regenerar toda la fase eliminatoria? Se borran los partidos eliminatorios actuales y se rearman con los standings finales de los grupos.')) return;
                setBusy(true); setMsg('');
                try {
                  const toDelete = matches.filter((m: any) => !String(m.round).toLowerCase().startsWith('zona'));
                  if (toDelete.length) {
                    await supabase.from('tournament_matches').delete().in('id', toDelete.map((m: any) => m.id));
                  }
                  const r = await generateKnockoutStage(torneo.id);
                  setMsg(`✓ Eliminatoria regenerada con ${r.matches} partidos.`);
                  load();
                } catch (e: any) { setMsg(e.message); }
                setBusy(false);
              }}
              disabled={busy || confirmed}
              className="w-full py-3 rounded-xl bg-yellow-300/15 border border-yellow-300/40 text-yellow-200 font-black text-sm disabled:opacity-40">
              🔄 Regenerar eliminatoria completa (arregla datos viejos)
            </button>

            {/* Validación + confirmación del cuadro */}
            <button
              onClick={async () => {
                setBusy(true); setMsg('');
                try {
                  const r = await validateTournamentBracket(torneo.id);
                  setValidation(r);
                  if (r.ok) setMsg(`✓ Cuadro válido. ${r.warnings.length} advertencia(s).`);
                  else setMsg(`⚠ ${r.errors.length} error(es) bloqueante(s) detectado(s).`);
                } catch (e: any) { setMsg(e.message); }
                setBusy(false);
              }}
              disabled={busy}
              className="w-full py-3 rounded-xl bg-white/5 border border-white/20 text-white font-black text-sm">
              🔍 Validar cuadro
            </button>

            {!confirmed && (
              <button
                onClick={async () => {
                  if (!confirm('¿Confirmar el cuadro? Después no se podrán regenerar los partidos sin des-confirmar.')) return;
                  setBusy(true); setMsg('');
                  try {
                    const r = await confirmBracket(torneo.id);
                    setConfirmed(true);
                    setMsg(`✓ Cuadro CONFIRMADO. ${r.warnings.length} advertencia(s) registrada(s).`);
                    load();
                  } catch (e: any) { setMsg(e.message); }
                  setBusy(false);
                }}
                disabled={busy}
                className="w-full py-3 rounded-xl bg-ball text-courtdark font-black text-sm">
                ✓ Confirmar cuadro (bloquear)
              </button>
            )}

            {confirmed && (
              <div className="w-full py-3 rounded-xl bg-ball/20 border border-ball/40 text-ball text-center text-sm font-black">
                🔒 Cuadro confirmado — regeneración bloqueada
                <button
                  onClick={async () => {
                    if (!confirm('¿Des-confirmar el cuadro? Esto permite editar / regenerar partidos.')) return;
                    setBusy(true); setMsg('');
                    try {
                      await unfreezeBracket(torneo.id);
                      setConfirmed(false);
                      setMsg('Cuadro des-confirmado. Ahora se pueden hacer cambios.');
                    } catch (e: any) { setMsg(e.message); }
                    setBusy(false);
                  }}
                  className="ml-3 text-xs underline text-white/80">Des-confirmar</button>
              </div>
            )}
          </>
        )}
        {msg && <p className="text-sm text-ball">{msg}</p>}

        {/* Lista de errores y advertencias del validador */}
        {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
          <div className="mt-3 space-y-1.5">
            {validation.errors.map((e: any, i: number) => (
              <p key={`e${i}`} className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
                <span className="font-black">✕ ERROR:</span> {e.message}
              </p>
            ))}
            {validation.warnings.map((w: any, i: number) => (
              <p key={`w${i}`} className="text-xs text-yellow-200 bg-yellow-500/10 border border-yellow-500/30 rounded px-3 py-2">
                <span className="font-black">⚠</span> {w.message}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Cargar resultados agrupados por Ronda */}
      {matches.length > 0 && <MatchesByRound matches={matches} pairs={pairs} onSave={guardarResultado} />}
    </section>
  );
}

function AddPairForm({ tournamentId, onAdded }: any) {
  const [tipo, setTipo] = useState<'usuarios' | 'provisional'>('usuarios');
  // Usuarios seleccionados (con búsqueda tipo autocomplete)
  const [pick1, setPick1] = useState<any>(null);
  const [pick2, setPick2] = useState<any>(null);
  // Provisional
  const [n1, setN1] = useState(''); const [n2, setN2] = useState('');
  const [ph1, setPh1] = useState(''); const [ph2, setPh2] = useState('');
  const [msg, setMsg] = useState('');

  async function add() {
    setMsg('');
    let payload: any = { tournament_id: tournamentId, status: 'aprobada' };
    if (tipo === 'usuarios') {
      if (!pick1 || !pick2) return setMsg('Seleccioná los dos jugadores.');
      if (pick1.id === pick2.id) return setMsg('No pueden ser el mismo jugador.');
      payload.player1_id = pick1.id; payload.player2_id = pick2.id;
    } else {
      if (!n1.trim() || !n2.trim()) return setMsg('Cargá los dos nombres.');
      payload.provisional_p1_name = n1.trim();
      payload.provisional_p2_name = n2.trim();
      if (ph1.trim()) payload.provisional_p1_phone = ph1.trim();
      if (ph2.trim()) payload.provisional_p2_phone = ph2.trim();
    }
    const { error } = await supabase.from('tournament_pairs').insert(payload);
    if (error) return setMsg(`${error.message}. ¿Ejecutaste update-18-fix-pairs-rls.sql?`);
    setPick1(null); setPick2(null);
    setN1(''); setN2(''); setPh1(''); setPh2('');
    onAdded();
  }

  return (
    <div className="mt-3 bg-white/5 rounded-xl p-3 space-y-3">
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
          <div>
            <label className="label !text-xs">Jugador 1</label>
            <UserPicker selected={pick1} onSelect={setPick1} otherId={pick2?.id} />
          </div>
          <div>
            <label className="label !text-xs">Jugador 2 (compañero/a)</label>
            <UserPicker selected={pick2} onSelect={setPick2} otherId={pick1?.id} />
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2">
            <input className="input" placeholder="Nombre y apellido jugador 1" value={n1} onChange={e => setN1(e.target.value)} />
            <input className="input" placeholder="Celular jugador 1 (opcional)" inputMode="tel" value={ph1} onChange={e => setPh1(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-2">
            <input className="input" placeholder="Nombre y apellido jugador 2" value={n2} onChange={e => setN2(e.target.value)} />
            <input className="input" placeholder="Celular jugador 2 (opcional)" inputMode="tel" value={ph2} onChange={e => setPh2(e.target.value)} />
          </div>
        </>
      )}
      {msg && <p className="text-red-400 text-xs">{msg}</p>}
      <button onClick={add} className="btn-ball w-full !py-3 text-sm">Agregar pareja</button>
    </div>
  );
}

// Buscador tipo autocomplete de usuarios registrados.
// Filtra por nombre, apellido, "nombre apellido", @usuario o celular.
function UserPicker({ selected, onSelect, otherId }: {
  selected: any; onSelect: (u: any) => void; otherId?: string;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (selected) return;
    const raw = q.trim();
    if (raw.length < 2) { setResults([]); return; }
    const t = `%${raw.replace(/^@/, '')}%`;
    const digits = raw.replace(/\D/g, '');
    const phoneT = digits.length >= 3 ? `%${digits}%` : null;
    const parts = raw.replace(/^@/, '').split(/\s+/);
    let orClauses = [
      `username.ilike.${t}`, `first_name.ilike.${t}`, `last_name.ilike.${t}`
    ];
    if (phoneT) orClauses.push(`phone.ilike.${phoneT}`);
    if (parts.length >= 2) {
      orClauses.push(`and(first_name.ilike.%${parts[0]}%,last_name.ilike.%${parts.slice(1).join(' ')}%)`);
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('profiles')
        .select('id, username, first_name, last_name, avatar_url, category, phone, role')
        .or(orClauses.join(','))
        .limit(8);
      setResults((data ?? []).filter((p: any) => p.id !== otherId));
    }, 200);
    return () => clearTimeout(timer);
  }, [q, otherId, selected]);

  if (selected) {
    return (
      <div className="flex items-center gap-2 bg-ball/10 border border-ball/40 rounded-xl p-3">
        {selected.avatar_url
          ? <img src={selected.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
          : <span className="w-9 h-9 rounded-full bg-grafito text-ball font-black flex items-center justify-center">{selected.first_name?.[0]}</span>}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-white truncate">{selected.first_name} {selected.last_name}</p>
          <p className="text-white/50 text-xs truncate">@{selected.username}{selected.category ? ` · cat. ${selected.category}` : ''}</p>
        </div>
        <button onClick={() => { onSelect(null); setQ(''); }}
          className="text-white/40 text-lg px-1">×</button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input className="input" placeholder="Nombre, apellido, @usuario o celular…"
        value={q} onChange={e => setQ(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 mt-1 bg-[#141A24] border border-white/10 rounded-xl shadow-xl z-20 max-h-64 overflow-y-auto">
          {results.length === 0 && (
            <p className="text-white/50 text-xs p-3">No hay resultados. Probá con nombre, @usuario o celular.</p>
          )}
          {results.map(r => (
            <button key={r.id} onMouseDown={() => { onSelect(r); setQ(''); }}
              className="w-full flex items-center gap-2 p-2.5 hover:bg-white/5 text-left border-b border-white/5 last:border-b-0">
              {r.avatar_url
                ? <img src={r.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                : <span className="w-9 h-9 rounded-full bg-grafito text-ball font-black flex items-center justify-center">{r.first_name?.[0]}</span>}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black truncate">{r.first_name} {r.last_name}</p>
                <p className="text-white/50 text-xs truncate">
                  @{r.username}
                  {r.category ? ` · cat. ${r.category}` : ''}
                  {r.role === 'coach' ? ' · profe' : ''}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Agrupa los partidos por ronda y los muestra en cards por sección.
// Zona A → tabla + partidos; Zona B → …; Octavos, Cuartos, Semi, Final.
function MatchesByRound({ matches, pairs, onSave }: any) {
  const groups: Record<string, any[]> = {};
  matches.forEach((m: any) => {
    const key = m.round;
    (groups[key] ||= []).push(m);
  });
  const rounds = Object.keys(groups).sort((a, b) => {
    const rr = (r: string) => {
      if (/^Zona/i.test(r)) return 0;
      if (/play-?in|32/i.test(r)) return 1;
      if (/16avos|preliminar/i.test(r)) return 2;
      if (/octavos/i.test(r)) return 3;
      if (/cuartos/i.test(r)) return 4;
      if (/semifinal|semi/i.test(r)) return 5;
      if (/final/i.test(r)) return 6;
      return 99;
    };
    if (rr(a) !== rr(b)) return rr(a) - rr(b);
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-4">
      {rounds.map(round => {
        const ms = groups[round];
        const isZona = /^Zona/i.test(round);
        const letra = isZona ? round.replace(/^Zona\s*/i, '').toUpperCase() : '';
        const pending = ms.filter(m => !m.winner_pair_id && !m.special_winner_pair_id).length;
        return (
          <div key={round} className="rounded-2xl overflow-hidden border-2 border-ball/30 bg-[#0F141D]">
            <div className="flex items-center gap-3 bg-ball/10 px-4 py-3 border-b border-ball/20">
              {isZona ? (
                <span className="w-11 h-11 rounded-lg bg-ball text-courtdark font-display font-black text-xl flex items-center justify-center">
                  {letra}
                </span>
              ) : (
                <span className="w-11 h-11 rounded-lg bg-ball text-courtdark flex items-center justify-center text-xl">🏆</span>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white/60 text-[10px] font-black tracking-widest">
                  {isZona ? 'GRUPO' : 'ELIMINATORIA'}
                </p>
                <p className="font-display font-black text-lg leading-none truncate">{round}</p>
                <p className="text-white/50 text-xs mt-0.5">
                  {ms.length} partido{ms.length > 1 ? 's' : ''}
                  {pending > 0 ? ` · ${pending} pendiente${pending > 1 ? 's' : ''}` : ' · ✓ Terminada'}
                </p>
              </div>
            </div>
            <ul className="px-3 py-3 space-y-3">
              {ms.map((m: any) => (
                <MatchRow key={m.id} m={m} pairs={pairs} onSave={onSave} />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function PairChip({ p, big = false }: any) {
  const Avatar = ({ url, name }: any) => url
    ? <img src={url} alt="" className={`${big ? 'w-9 h-9' : 'w-8 h-8'} rounded-full object-cover shrink-0`} />
    : <span className={`${big ? 'w-9 h-9' : 'w-8 h-8'} rounded-full bg-grafito text-ball text-xs font-black flex items-center justify-center shrink-0`}>
        {name?.[0]?.toUpperCase() ?? '?'}
      </span>;
  if (!p) return <span className="text-white/30 text-xs italic">A definir</span>;
  const name1 = p.p1 ? `${p.p1.first_name} ${p.p1.last_name?.[0] ?? ''}.` : p.provisional_p1_name ?? '?';
  const name2 = p.p2 ? `${p.p2.first_name} ${p.p2.last_name?.[0] ?? ''}.` : p.provisional_p2_name ?? '?';
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex -space-x-2 shrink-0">
        <Avatar url={p.p1?.avatar_url} name={p.p1?.first_name ?? p.provisional_p1_name} />
        <Avatar url={p.p2?.avatar_url} name={p.p2?.first_name ?? p.provisional_p2_name} />
      </div>
      <span className={`min-w-0 truncate ${big ? 'text-sm font-black' : 'text-xs font-bold'}`}>
        {name1} &amp; {name2}
      </span>
    </div>
  );
}

function MatchRow({ m, pairs, onSave }: any) {
  const p1 = pairs.find((p: any) => p.id === m.pair1_id);
  const p2 = pairs.find((p: any) => p.id === m.pair2_id);
  const [score, setScore] = useState(m.sets?.length ? m.sets.sort((a: any, b: any) => a.set_number - b.set_number).map((s: any) => `${s.t1_games}-${s.t2_games}`).join(' ') : '');
  const [woMenu, setWoMenu] = useState(false);
  const [pendingWo, setPendingWo] = useState<{ type: string; winnerId: string; winnerName: string; loserName: string } | null>(null);
  const played = !!m.winner_pair_id;

  const shortName = (p: any) => !p ? 'A definir' :
    (p.p1 ? `${p.p1.first_name} ${p.p1.last_name?.[0] ?? ''}.` : p.provisional_p1_name ?? '?') + ' & ' +
    (p.p2 ? `${p.p2.first_name} ${p.p2.last_name?.[0] ?? ''}.` : p.provisional_p2_name ?? '?');
  const fullName = (p: any) => !p ? '?' :
    (p.p1 ? `${p.p1.first_name} ${p.p1.last_name}` : p.provisional_p1_name ?? '?') + ' & ' +
    (p.p2 ? `${p.p2.first_name} ${p.p2.last_name}` : p.provisional_p2_name ?? '?');

  const woLabel: Record<string, string> = {
    walkover: 'Walkover (no se presentó)',
    abandono: 'Abandono (se lesionó / se fue)',
    dq: 'Descalificación'
  };

  return (
    <li className={`rounded-xl p-3 ${played ? 'bg-ball/10 border border-ball/30' : 'bg-white/5 border border-white/5'}`}>
      <div className={`flex items-center gap-2 ${played && m.winner_pair_id === m.pair1_id && !!m.pair1_id ? 'text-ball' : played && m.winner_pair_id === m.pair2_id ? 'text-white/40' : 'text-white/85'}`}>
        <PairChip p={p1} big />
        {played && m.winner_pair_id && m.winner_pair_id === m.pair1_id && (
          <span className="ml-auto text-ball font-black text-xs">GANÓ ✓</span>
        )}
      </div>
      <div className="text-center text-white/40 text-[10px] font-black tracking-widest my-1">— VS —</div>
      <div className={`flex items-center gap-2 ${played && m.winner_pair_id === m.pair2_id && !!m.pair2_id ? 'text-ball' : played && m.winner_pair_id === m.pair1_id ? 'text-white/40' : 'text-white/85'}`}>
        <PairChip p={p2} big />
        {played && m.winner_pair_id && m.winner_pair_id === m.pair2_id && (
          <span className="ml-auto text-ball font-black text-xs">GANÓ ✓</span>
        )}
      </div>
      {m.score && <p className="text-ball font-display font-black text-center text-lg mt-2">{m.score}</p>}

      {p1 && p2 && !played && !woMenu && !pendingWo && (
        <>
          <div className="mt-3 flex gap-2">
            <input className="input !py-2 text-sm flex-1" placeholder="6-4 3-6 6-4"
              value={score} onChange={e => setScore(e.target.value)} />
            <button onClick={() => onSave(m.id, score, '')}
              className="bg-ball text-courtdark text-xs font-black px-3 rounded-lg">Guardar</button>
          </div>
          <button onClick={() => setWoMenu(true)}
            className="mt-2 text-white/50 text-[11px] font-bold underline">
            El partido no se jugó (walkover / abandono / descalificación)
          </button>
        </>
      )}

      {p1 && p2 && !played && woMenu && !pendingWo && (
        <div className="mt-3 bg-black/30 rounded-lg p-3 space-y-3">
          <p className="text-white/80 text-xs font-black uppercase tracking-widest">¿Qué pasó?</p>
          {(['walkover', 'abandono', 'dq'] as const).map(t => (
            <div key={t} className="space-y-1">
              <p className="text-ball text-xs font-black">{woLabel[t]}</p>
              <p className="text-white/50 text-[10px]">¿Quién gana?</p>
              <div className="flex gap-2">
                <button onClick={() => setPendingWo({ type: t, winnerId: m.pair1_id, winnerName: fullName(p1), loserName: fullName(p2) })}
                  className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-ball/20 text-xs font-bold text-left px-3">
                  ✓ {shortName(p1)}
                </button>
                <button onClick={() => setPendingWo({ type: t, winnerId: m.pair2_id, winnerName: fullName(p2), loserName: fullName(p1) })}
                  className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-ball/20 text-xs font-bold text-left px-3">
                  ✓ {shortName(p2)}
                </button>
              </div>
            </div>
          ))}
          <button onClick={() => setWoMenu(false)} className="text-white/50 text-xs">Cancelar</button>
        </div>
      )}

      {pendingWo && (
        <div className="mt-3 bg-yellow-300/10 border border-yellow-300/40 rounded-lg p-3 space-y-2">
          <p className="text-yellow-200 text-xs font-black">¿Confirmás?</p>
          <p className="text-white text-sm">
            <b className="text-ball">{pendingWo.winnerName}</b> gana por <b>{woLabel[pendingWo.type].split(' (')[0].toLowerCase()}</b>.
            <br /><span className="text-white/60 text-xs">{pendingWo.loserName} queda eliminado del partido.</span>
          </p>
          <div className="flex gap-2 pt-1">
            <button onClick={() => { onSave(m.id, '', `${pendingWo.type}:${pendingWo.winnerId}`); setPendingWo(null); setWoMenu(false); }}
              className="flex-1 bg-yellow-300 text-black px-3 py-2 rounded-lg font-black text-xs">
              Sí, confirmar
            </button>
            <button onClick={() => setPendingWo(null)}
              className="flex-1 bg-white/10 text-white px-3 py-2 rounded-lg text-xs">
              Volver
            </button>
          </div>
        </div>
      )}

      {played && !woMenu && (
        <div className="mt-2 flex gap-2 items-center">
          <input className="input !py-2 text-sm flex-1" value={score}
            onChange={e => setScore(e.target.value)} />
          <button onClick={() => onSave(m.id, score, '')}
            className="bg-white/10 text-white/70 text-xs font-black px-3 py-2 rounded-lg">Corregir</button>
        </div>
      )}
    </li>
  );
}
