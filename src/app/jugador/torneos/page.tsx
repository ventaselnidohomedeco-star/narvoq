'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { validatePair } from '@/lib/torneos/plantillas';
import PhotoPicker from '@/components/PhotoPicker';

export default function TorneosJugador() {
  const [torneos, setTorneos] = useState<any[]>([]);
  const [circuitos, setCircuitos] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [partnerUser, setPartnerUser] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [myPair, setMyPair] = useState<any>(null);
  const [filtro, setFiltro] = useState<'abiertos' | 'finalizados'>('abiertos');

  useEffect(() => {
    supabase.from('circuits').select('*, complex:complexes(name, logo_url), tournaments:tournaments(id, status)')
      .order('year', { ascending: false })
      .then(({ data }) => setCircuitos(data ?? []));
  }, []);

  useEffect(() => {
    (async () => {
      if (!sel) return setMyPair(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('tournament_pairs').select('*')
        .eq('tournament_id', sel.id)
        .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`).maybeSingle();
      setMyPair(data);
    })();
  }, [sel]);

  useEffect(() => {
    const statuses = filtro === 'abiertos'
      ? ['inscripcion', 'completo', 'en_juego']
      : ['finalizado'];
    supabase.from('tournaments')
      .select('*, complex:complexes(name, city:cities(name)), pairs:tournament_pairs(id)')
      .in('status', statuses)
      .order('starts_on', { ascending: false })
      .then(({ data }) => setTorneos(data ?? []));
  }, [filtro]);

  async function inscribirse() {
    setMsg(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: me } = await supabase.from('profiles').select('id,category,sex').eq('id', user.id).single();
    const { data: partner } = await supabase.from('profiles')
      .select('id,category,sex').eq('username', partnerUser.toLowerCase().trim()).single();
    if (!partner) return setMsg({ ok: false, text: 'No encontramos ese usuario. Tu compañero debe estar registrado.' });

    const check = validatePair(
      { sum_target: sel.sum_target, sum_exact: sel.sum_exact, categories: sel.categories ?? [], sex: sel.sex },
      me!, partner
    );
    if (!check.ok) return setMsg({ ok: false, text: check.error! });

    const { error } = await supabase.from('tournament_pairs').insert({
      tournament_id: sel.id, player1_id: me!.id, player2_id: partner.id
    });
    if (error) return setMsg({ ok: false, text: 'Alguno de los dos ya está inscripto en este torneo.' });

    await supabase.from('posts').insert({
      author_profile_id: me!.id, kind: 'inscripcion', ref_tournament_id: sel.id,
      text_content: `Nos anotamos en ${sel.name} 🏆`
    });
    setMsg({ ok: true, text: '¡Pareja inscripta! Los esperamos en la cancha.' });
  }

  return (
    <main className="px-5 pt-6">
      <h1 className="h-hero">Torneos</h1>

      {/* Circuitos / ligas anuales */}
      {circuitos.length > 0 && (
        <section className="mt-4">
          <p className="font-display font-black text-ball text-xs tracking-widest mb-2">CIRCUITOS ANUALES</p>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {circuitos.map(c => (
              <Link key={c.id} href={`/circuito/${c.id}`}
                className="shrink-0 card !p-4 min-w-[220px] flex items-center gap-3">
                {c.complex?.logo_url
                  ? <img src={c.complex.logo_url} alt="" className="w-11 h-11 rounded-full object-cover" />
                  : <span className="w-11 h-11 rounded-full bg-grafito flex items-center justify-center text-ball">🏆</span>}
                <div className="min-w-0">
                  <p className="font-display font-black truncate">{c.name}</p>
                  <p className="text-white/60 text-xs truncate">{c.complex?.name} · {c.year}</p>
                  <p className="text-ball text-xs font-bold">{c.tournaments?.length ?? 0} torneos →</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mt-4 flex gap-2">
        {(['abiertos', 'finalizados'] as const).map(k => (
          <button key={k} onClick={() => { setFiltro(k); setSel(null); }}
            className={`rounded-full px-5 py-3 text-sm font-black min-h-[48px]
              ${filtro === k ? 'bg-ball text-courtdark' : 'bg-white/5 text-white/70 border border-white/10'}`}>
            {k === 'abiertos' ? 'Abiertos ahora' : 'Finalizados'}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {torneos.map(t => (
          <div key={t.id} className={`card ${sel?.id === t.id ? 'ring-2 ring-ball' : ''}`}>
            <button onClick={() => { setSel(t); setMsg(null); }} className="w-full text-left">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <p className="font-display font-black text-lg leading-tight truncate">{t.name}</p>
                  <p className="text-white/60 text-sm truncate">
                    {t.complex?.name ?? (t.owner_coach_id ? '🎾 Torneo de profe' : 'Organizador')}
                    {t.complex?.city?.name ? ` · ${t.complex.city.name}` : ''}
                  </p>
                </div>
                <span className={`shrink-0 text-[10px] font-black uppercase px-2 py-1 rounded ${
                  t.status === 'finalizado' ? 'bg-white/10 text-white/60'
                  : t.status === 'inscripcion' ? 'bg-ball/20 text-ball'
                  : 'bg-yellow-300/20 text-yellow-200'}`}>
                  {t.status === 'inscripcion' ? 'Inscripción'
                    : t.status === 'en_juego' ? 'En juego'
                    : t.status === 'finalizado' ? 'Finalizado'
                    : 'Completo'}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {t.sum_target && <Chip>Suma {t.sum_target}</Chip>}
                {t.sex && <Chip>{t.sex === 'X' ? 'Mixto' : t.sex === 'F' ? 'Femenino' : 'Masculino'}</Chip>}
                <Chip>{t.pairs.length}/{t.max_pairs} parejas</Chip>
                {Number(t.price) > 0 && <Chip>${Number(t.price).toLocaleString('es-AR')}</Chip>}
                {Number(t.price) === 0 && <Chip>Gratis</Chip>}
              </div>
            </button>
            <Link href={`/torneo/${t.id}`} className="mt-3 inline-block text-ball font-black text-sm">
              Ver fixture y resultados →
            </Link>
          </div>
        ))}
        {torneos.length === 0 && (
          <div className="card text-center py-8">
            <p className="text-3xl">🏆</p>
            <p className="text-white/60 mt-2">
              {filtro === 'abiertos' ? 'No hay torneos abiertos ahora.' : 'Aún no hay torneos finalizados.'}
            </p>
          </div>
        )}
      </div>

      {sel && myPair && (
        <div className="card mt-5">
          <h2 className="font-display font-bold">Mi inscripción en {sel.name}</h2>
          <p className={`text-sm font-bold mt-1 ${myPair.status === 'aprobada' ? 'text-green-400' : myPair.status === 'rechazada' ? 'text-red-400' : 'text-yellow-400'}`}>
            Estado: {myPair.status === 'aprobada' ? '✓ Aprobada' : myPair.status === 'rechazada' ? '✕ Rechazada' : '⏳ Pendiente de aprobación'}
          </p>
          {Number(sel.price) > 0 && myPair.status === 'pendiente' && (
            <div className="mt-3">
              <p className="text-white/50 text-sm">
                Transferí ${Number(sel.price).toLocaleString('es-AR')} al complejo y subí el comprobante para que aprueben tu inscripción:
              </p>
              <div className="mt-2">
                <PhotoPicker folder="payments" current={myPair.payment_proof_url} shape="wide"
                  label="Comprobante de pago" onUploaded={async url => {
                    await supabase.from('tournament_pairs').update({ payment_proof_url: url }).eq('id', myPair.id);
                    setMyPair({ ...myPair, payment_proof_url: url });
                  }} />
              </div>
              {myPair.payment_proof_url && <p className="text-green-400 text-xs font-bold mt-1">✓ Comprobante enviado, esperá la aprobación del complejo.</p>}
            </div>
          )}
        </div>
      )}

      {/* Helper Chip inline via JSX return */}
      {sel?.status === 'inscripcion' && !myPair && (
        <div className="card mt-5">
          <h2 className="font-display font-bold">Anotarme en {sel.name}</h2>
          {sel.rules && <p className="text-xs text-white/50 mt-1 whitespace-pre-line">{sel.rules}</p>}
          <label className="label mt-3">Usuario de tu compañero/a</label>
          <input className="input" value={partnerUser} onChange={e => setPartnerUser(e.target.value)} placeholder="ej: juanperez" />
          {msg && <p className={`text-sm mt-2 ${msg.ok ? 'text-green-600' : 'text-red-600'}`}>{msg.text}</p>}
          <button onClick={inscribirse} className="btn-ball w-full mt-3">Inscribir pareja</button>
        </div>
      )}
    </main>
  );
}

function Chip({ children }: any) {
  return (
    <span className="inline-block bg-white/10 text-white/80 text-[11px] font-black uppercase rounded-full px-2.5 py-1">
      {children}
    </span>
  );
}
