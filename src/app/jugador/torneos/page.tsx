'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { validatePair } from '@/lib/torneos/plantillas';
import PhotoPicker from '@/components/PhotoPicker';

export default function TorneosJugador() {
  const [torneos, setTorneos] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [partnerUser, setPartnerUser] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [myPair, setMyPair] = useState<any>(null);

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
    supabase.from('tournaments')
      .select('*, complex:complexes(name, city:cities(name)), pairs:tournament_pairs(id)')
      .in('status', ['inscripcion', 'completo', 'en_juego'])
      .order('created_at', { ascending: false })
      .then(({ data }) => setTorneos(data ?? []));
  }, []);

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
    <main className="px-5 pt-8">
      <h1 className="font-display font-black text-2xl">Torneos</h1>
      <div className="mt-4 space-y-3">
        {torneos.map(t => (
          <button key={t.id} onClick={() => { setSel(t); setMsg(null); }}
            className={`card w-full text-left ${sel?.id === t.id ? 'ring-2 ring-court' : ''}`}>
            <div className="flex justify-between">
              <p className="font-display font-black">{t.name}</p>
              <span className="text-xs font-bold text-court uppercase">{t.status}</span>
            </div>
            <p className="text-white/50 text-sm">{t.complex.name} · {t.complex.city.name}</p>
            <p className="text-white/50 text-sm">
              {t.pairs.length}/{t.max_pairs} parejas
              {t.sum_target ? ` · Suma ${t.sum_target}` : ''}
              {t.sex === 'X' ? ' · Mixto' : t.sex === 'F' ? ' · Femenino' : t.sex === 'M' ? ' · Masculino' : ''}
              {Number(t.price) > 0 ? ` · 💵 $${Number(t.price).toLocaleString('es-AR')} por pareja` : ' · Gratis'}
            </p>
          </button>
        ))}
        {torneos.length === 0 && <p className="text-white/50">No hay torneos abiertos por ahora.</p>}
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
