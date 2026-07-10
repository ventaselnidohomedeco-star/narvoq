'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { uploadImage } from '@/lib/upload';

export default function ClubPublico() {
  const { id } = useParams<{ id: string }>();
  const [cx, setCx] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    setMe(user?.id ?? null);
    const { data: complex } = await supabase.from('complexes')
      .select('*, courts(*)')
      .eq('id', id).single();
    setCx(complex);
    const { data } = await supabase.from('memberships')
      .select('*, members:membership_members(status, payment_status, player_id, payment_proof_url)')
      .eq('complex_id', id).eq('active', true).order('price');
    setPlans(data ?? []);
  }
  useEffect(() => { if (id) load(); }, [id]);

  async function pedirMembresia(plan: any, file?: File) {
    setMsg('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setMsg('Inicia sesion como jugador para solicitar la membresia.');
    setBusy(plan.id);
    let url: string | null = null;
    if (file) url = await uploadImage(file, 'comprobantes-membresias');
    const { error } = await supabase.from('membership_members').insert({
      membership_id: plan.id,
      player_id: user.id,
      status: 'pendiente',
      payment_status: url ? 'en_revision' : 'pendiente',
      payment_proof_url: url,
      payment_uploaded_at: url ? new Date().toISOString() : null
    });
    setBusy(null);
    if (error) return setMsg('Ya solicitaste o tenes esta membresia.');
    setMsg('Solicitud enviada. El complejo la activa cuando confirma el pago.');
    load();
  }

  async function subirComprobante(plan: any, file: File) {
    if (!me) return setMsg('Inicia sesion para subir el comprobante.');
    setBusy(plan.id);
    const url = await uploadImage(file, 'comprobantes-membresias');
    if (!url) { setBusy(null); return setMsg('No pudimos subir el comprobante.'); }
    await supabase.from('membership_members').update({
      payment_status: 'en_revision',
      payment_proof_url: url,
      payment_uploaded_at: new Date().toISOString()
    }).eq('membership_id', plan.id).eq('player_id', me);
    setBusy(null); setMsg('Comprobante enviado.');
    load();
  }

  if (!cx) return <main className="min-h-dvh bg-courtdark text-white p-8">Cargando...</main>;
  const services = String(cx.services ?? '').split(',').map((s: string) => s.trim()).filter(Boolean);

  return (
    <main className="min-h-dvh bg-courtdark text-white pb-10">
      <section className="px-5 pt-8 max-w-md mx-auto">
        <div className="flex items-center gap-4">
          {cx.logo_url
            ? <img src={cx.logo_url} alt="" className="w-16 h-16 rounded-full object-cover" />
            : <span className="w-16 h-16 rounded-full bg-ball/20 flex items-center justify-center text-2xl">PA</span>}
          <div>
            <h1 className="font-display font-black text-2xl">{cx.name}</h1>
            <p className="text-white/50 text-sm">{cx.address}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link href="/jugador/reservar" className="btn-ball text-center">Reservar cancha</Link>
          {cx.whatsapp && <a href={`https://wa.me/${cx.whatsapp}`} target="_blank" className="text-center py-3 rounded-xl border border-white/20 font-semibold">WhatsApp</a>}
        </div>

        {services.length > 0 && (
          <section className="mt-5">
            <p className="font-display font-bold text-ball text-sm">Servicios</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {services.map((s: string) => <span key={s} className="px-3 py-1 rounded-full bg-white/10 text-sm">{s}</span>)}
            </div>
          </section>
        )}

        <section className="mt-5">
          <p className="font-display font-bold text-ball text-sm">Canchas</p>
          <div className="mt-2 space-y-2">
            {(cx.courts ?? []).filter((c: any) => c.active).map((c: any) => (
              <div key={c.id} className="bg-white/5 rounded-2xl overflow-hidden flex">
                {c.photo_url
                  ? <img src={c.photo_url} alt="" className="w-28 h-24 object-cover" />
                  : <span className="w-28 h-24 bg-court/20 flex items-center justify-center">Cancha</span>}
                <div className="p-3 min-w-0">
                  <p className="font-display font-bold">{c.name}</p>
                  <p className="text-ball font-black">${Number(c.price_per_slot).toLocaleString('es-AR')}</p>
                  <p className="text-white/50 text-xs truncate">{c.surface}{c.covered ? ' techada' : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5">
          <p className="font-display font-bold text-ball text-sm">Membresias</p>
          <div className="mt-2 space-y-3">
            {plans.map(plan => {
              const mine = plan.members?.find((m: any) => m.player_id === me);
              return (
                <div key={plan.id} className="bg-white/5 rounded-2xl p-4">
                  <p className="font-display font-black">{plan.name}</p>
                  <p className="text-ball font-display font-black text-xl">${Number(plan.price).toLocaleString('es-AR')}/mes</p>
                  {plan.benefits && <p className="text-white/60 text-sm mt-1">{plan.benefits}</p>}
                  <div className="mt-3 rounded-xl bg-white/5 p-3 text-sm">
                    <p className="font-bold">Pago por transferencia</p>
                    {cx.payment_alias && <p>Alias: <b>{cx.payment_alias}</b></p>}
                    {cx.payment_cbu && <p>CBU/CVU: <b>{cx.payment_cbu}</b></p>}
                    {cx.payment_holder && <p>Titular: {cx.payment_holder}</p>}
                  </div>
                  {mine ? (
                    <div className="mt-3">
                      <p className={`text-sm font-bold ${mine.status === 'activa' ? 'text-green-400' : 'text-yellow-300'}`}>
                        {mine.status === 'activa' ? 'Membresia activa' : 'Solicitud pendiente'}
                      </p>
                      {mine.status !== 'activa' && (
                        <label className="mt-2 block text-center py-3 rounded-xl bg-ball text-courtdark font-display font-black cursor-pointer">
                          {busy === plan.id ? 'Subiendo...' : mine.payment_proof_url ? 'Cambiar comprobante' : 'Subir comprobante'}
                          <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && subirComprobante(plan, e.target.files[0])} />
                        </label>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 grid gap-2">
                      <label className="block text-center py-3 rounded-xl bg-ball text-courtdark font-display font-black cursor-pointer">
                        {busy === plan.id ? 'Enviando...' : 'Solicitar y subir comprobante'}
                        <input type="file" accept="image/*" className="hidden" onChange={e => pedirMembresia(plan, e.target.files?.[0])} />
                      </label>
                      <button onClick={() => pedirMembresia(plan)} className="text-white/60 text-sm underline">Solicitar sin comprobante</button>
                    </div>
                  )}
                </div>
              );
            })}
            {plans.length === 0 && <p className="text-white/40 text-sm">Este complejo todavia no publico membresias.</p>}
          </div>
        </section>

        {msg && <p className="mt-4 text-sm text-ball font-semibold">{msg}</p>}
      </section>
    </main>
  );
}
