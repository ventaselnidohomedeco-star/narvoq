'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import PlacaButton from '@/components/PlacaButton';
import CourtLayout from '@/components/CourtLayout';
import BackButton from '@/components/BackButton';
import { sharePlaca } from '@/lib/placas';

export default function Partido() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [match, setMatch] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [waitlist, setWaitlist] = useState<any[]>([]);
  const [result, setResult] = useState<any>(null);
  const [me, setMe] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // formulario de resultado
  const [sets, setSets] = useState([{ t1: '', t2: '' }, { t1: '', t2: '' }, { t1: '', t2: '' }]);
  const [error, setError] = useState('');
  const [amigos, setAmigos] = useState<any[]>([]);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    setMe(user?.id ?? null);
    const { data: m } = await supabase.from('matches')
      .select('*, booking:bookings(id, starts_at, ends_at, price, court:courts(name, complex:complexes(name, address)))')
      .eq('id', id).single();
    setMatch(m);
    const { data: mp } = await supabase.from('match_players')
      .select('player_id, team, profile:profiles!player_id(username, first_name, last_name, category, avatar_url)')
      .eq('match_id', id);
    setPlayers(mp ?? []);
    const { data: wl } = await supabase.from('waitlist')
      .select('player_id, profile:profiles!player_id(username, first_name)').eq('match_id', id);
    setWaitlist(wl ?? []);
    const { data: r } = await supabase.from('results').select('*').eq('match_id', id).maybeSingle();
    setResult(r);

    // Amigos recurrentes: los que seguís, para agregarlos con un toque
    if (user) {
      const { data: f } = await supabase.from('follows')
        .select('followed:profiles!followed_id(id, username, first_name, last_name, avatar_url, category)')
        .eq('follower_id', user.id).limit(20);
      setAmigos((f ?? []).map((x: any) => x.followed));
    }
  }
  useEffect(() => { load(); }, [id]);

  const inMatch = players.some(p => p.player_id === me);
  const spots = 4 - players.length;
  const avg = players.length
    ? (players.reduce((a, p) => a + p.profile.category, 0) / players.length).toFixed(1) : '-';
  const when = match?.booking ? new Date(match.booking.starts_at) : null;
  const ended = match?.booking ? new Date(match.booking.ends_at ?? match.booking.starts_at) < new Date() : false;
  const team1 = players.filter(p => p.team === 1);
  const team2 = players.filter(p => p.team === 2);

  async function sumarme() {
    if (!me) return router.push(`/registro?next=/partido/${id}`);
    setBusy(true);
    if (spots > 0) {
      await supabase.from('match_players').insert({ match_id: id, player_id: me, team: players.length < 2 ? 1 : 2 });
      if (spots === 1) {
        await supabase.from('matches').update({ status: 'completa' }).eq('id', id);
        await supabase.from('bookings').update({ status: 'completa' }).eq('id', match.booking.id);
      }
    } else {
      await supabase.from('waitlist').insert({ match_id: id, player_id: me });
    }
    await load(); setBusy(false);
  }

  function invitarWhatsApp() {
    const url = `${location.origin}/partido/${id}`;
    const texto = `🎾 ¡Sumate a mi partido de pádel!\n📍 ${match.booking?.court.complex.name} · ${match.booking?.court.name}\n🗓 ${when?.toLocaleString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} hs\n👉 Anotate acá: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  }

  async function copiarLink() {
    const url = `${location.origin}/partido/${id}`;
    if (navigator.share) await navigator.share({ title: 'Sumate a mi partido de pádel', url });
    else { await navigator.clipboard.writeText(url); alert('Link copiado 📋'); }
  }

  async function agregarAmigo(a: any) {
    const { error: err } = await supabase.from('match_players')
      .insert({ match_id: id, player_id: a.id, team: players.length < 2 ? 1 : 2 });
    if (err) return alert(`No se pudo agregar: ${err.message}. ¿Ejecutaste update-06-pro.sql?`);
    if (players.length + 1 === 4) {
      await supabase.from('matches').update({ status: 'completa' }).eq('id', id);
      await supabase.from('bookings').update({ status: 'completa' }).eq('id', match.booking.id);
    }
    load();
  }

  async function cargarResultado() {
    setError('');
    const played = sets.filter(s => s.t1 !== '' && s.t2 !== '')
      .map(s => ({ t1: Number(s.t1), t2: Number(s.t2) }));
    if (played.length === 0) return setError('Cargá al menos un set.');
    let w1 = 0, w2 = 0;
    played.forEach(s => s.t1 > s.t2 ? w1++ : w2++);
    if (w1 === w2) return setError('Los sets están empatados: revisá el resultado.');
    // Los amistosos (sin tournament_match_id) se autovalidan y NO suman puntos
    // al ranking. Solo los torneos requieren validación del complejo y dan puntos.
    const esAmistoso = !match.tournament_match_id;
    const { error: err } = await supabase.from('results').insert({
      match_id: id, reported_by: me, sets: played, winner_team: w1 > w2 ? 1 : 2,
      status: esAmistoso ? 'validado' : 'pendiente'
    });
    if (err) return setError(`No se pudo guardar: ${err.message}`);
    if (esAmistoso) {
      await supabase.from('matches').update({ status: 'jugada' }).eq('id', id);
    }
    await supabase.from('posts').insert({
      author_profile_id: me, kind: 'resultado', ref_match_id: id,
      text_content: `🎾 Resultado en ${match.booking.court.complex.name}: ${played.map(s => `${s.t1}-${s.t2}`).join(' / ')}`
    });
    load();
  }

  if (!match) return <main className="p-8 text-white/50">Cargando partido…</main>;

  return (
    <main className="min-h-dvh max-w-md mx-auto px-5 pt-6 pb-16">
      <BackButton fallbackHref="/jugador/reservas" label="Mis reservas" />
      <span className="block font-display font-black text-ball text-sm tracking-widest mt-3">
        {result ? (result.status === 'validado' ? 'PARTIDO JUGADO ✓' : 'RESULTADO EN REVISIÓN')
          : ended ? 'PARTIDO FINALIZADO' 
          : spots > 0 ? `FALTAN ${spots} JUGADOR${spots > 1 ? 'ES' : ''}` : 'PARTIDO COMPLETO'}
      </span>
      <h1 className="font-display font-black text-2xl mt-1">
        {match.booking?.court.complex.name} · {match.booking?.court.name}
      </h1>
      <p className="text-white/50">
        {when?.toLocaleString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} hs
        {match.booking?.price ? ` · $${Number(match.booking.price).toLocaleString('es-AR')} la cancha` : ''}
      </p>

      {/* Cancha visual con equipos */}
      <div className="mt-5">
        <CourtLayout
          players={players}
          meId={me}
          canSwap={match.creator_id === me}
          onSwap={async (playerId, newTeam) => {
            await supabase.from('match_players').update({ team: newTeam })
              .eq('match_id', id).eq('player_id', playerId);
            load();
          }}
        />
        <div className="mt-3 flex justify-between text-xs font-semibold text-white/60">
          <span>Nivel promedio <b className="text-ball">{avg}</b></span>
          <span>Cat. sugerida <b className="text-ball">{match.suggested_category ?? '-'}</b></span>
        </div>
        {waitlist.length > 0 && (
          <p className="mt-2 text-xs text-white/50">Suplentes: {waitlist.map(w => w.profile.first_name).join(', ')}</p>
        )}
      </div>

      {/* Resultado */}
      {result ? (
        <div className="card mt-4 text-center">
          <p className="font-display font-black text-ball text-3xl">
            {result.sets.map((s: any) => `${s.t1}-${s.t2}`).join('  /  ')}
          </p>
          <p className="text-white/50 text-sm mt-1">
            Ganó el equipo {result.winner_team}
            {result.status === 'pendiente' ? ' · esperando validación del complejo' : ' · validado ✓'}
          </p>
          <div className="mt-3 flex justify-center">
            <PlacaButton data={{
              kind: 'resultado', title: 'Resultado final',
              main: `${match.booking.court.complex.name}`,
              detail: `${team1.map(p => p.profile.first_name).join(' y ')} vs ${team2.map(p => p.profile.first_name).join(' y ')}`,
              score: result.sets.map((s: any) => `${s.t1}-${s.t2}`).join(' / ')
            }} />
          </div>
        </div>
      ) : ended && inMatch ? (
        <div className="card mt-4">
          <p className="font-display font-bold">🏆 Cargar resultado</p>
          <p className="text-white/50 text-xs mt-1">
            Equipo 1: {team1.map(p => p.profile.first_name).join(' y ') || '-'} ·
            Equipo 2: {team2.map(p => p.profile.first_name).join(' y ') || '-'}
          </p>
          <div className="mt-3 space-y-2">
            {sets.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-white/50 text-xs font-bold w-12">Set {i + 1}</span>
                <input className="input !w-20 text-center" type="number" min={0} max={7} placeholder="Eq 1"
                  value={s.t1} onChange={e => setSets(sets.map((x, j) => j === i ? { ...x, t1: e.target.value } : x))} />
                <span className="text-white/50 font-black">–</span>
                <input className="input !w-20 text-center" type="number" min={0} max={7} placeholder="Eq 2"
                  value={s.t2} onChange={e => setSets(sets.map((x, j) => j === i ? { ...x, t2: e.target.value } : x))} />
              </div>
            ))}
          </div>
          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
          <button onClick={cargarResultado} className="btn-ball w-full mt-3">Guardar resultado</button>
          <p className="text-white/50 text-xs mt-2">El complejo lo valida y suma puntos al ranking de los 4 jugadores.</p>
        </div>
      ) : null}

      {/* Acciones */}
      {!ended && (
        <div className="mt-5 flex flex-col gap-3">
          {!inMatch && (
            <button onClick={sumarme} disabled={busy} className="btn-ball text-lg">
              {spots > 0 ? 'Sumarme al partido' : 'Anotarme como suplente'}
            </button>
          )}
          {inMatch && (
            <>
              <button onClick={invitarWhatsApp}
                className="text-lg font-display font-bold rounded-xl px-5 py-3 bg-[#25D366] text-white active:scale-95 transition">
                💬 Invitar por WhatsApp
              </button>
              <button onClick={copiarLink} className="btn-court">Compartir link del partido</button>
            </>
          )}
          {inMatch && spots > 0 && amigos.length > 0 && (
            <div className="card">
              <p className="font-display font-bold text-sm">👥 Agregar amigos al partido</p>
              <div className="mt-2 space-y-2 max-h-56 overflow-y-auto">
                {amigos.filter(a => !players.some(pl => pl.player_id === a.id)).map(a => (
                  <div key={a.id} className="flex items-center gap-2">
                    {a.avatar_url
                      ? <img src={a.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                      : <span className="w-8 h-8 rounded-full bg-grafito text-white text-xs font-display font-black flex items-center justify-center">{a.first_name[0]}</span>}
                    <span className="flex-1 text-sm font-semibold truncate">{a.first_name} {a.last_name} <span className="text-white/50 font-normal">cat. {a.category}</span></span>
                    <button onClick={() => agregarAmigo(a)} className="btn-ball !py-1.5 !px-3 text-xs">+ Agregar</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button onClick={() => sharePlaca({
            kind: spots > 0 ? 'busco_jugadores' : 'partido_completo',
            title: spots > 0 ? `Falta${spots > 1 ? 'n' : ''} ${spots}` : 'Partido completo',
            main: `${match.booking?.court.complex.name} · ${match.booking?.court.name}`,
            detail: `${when?.toLocaleString('es-AR', { weekday: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} hs · Nivel promedio ${avg}`
          })} className="self-start inline-flex items-center gap-1 bg-white/5 border border-white/10 text-white/60 text-xs font-bold rounded-lg px-3 py-1.5 active:scale-95 transition">📸 Compartir placa</button>
        </div>
      )}
    </main>
  );
}
