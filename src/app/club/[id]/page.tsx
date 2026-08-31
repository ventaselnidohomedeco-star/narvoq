'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { uploadImage } from '@/lib/upload';
import { notify } from '@/lib/notify';

export default function ClubPublico() {
  const { id } = useParams<{ id: string }>();
  const [cx, setCx] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [claimOpen, setClaimOpen] = useState(false);
  const [claim, setClaim] = useState({ name: '', email: '', phone: '', message: '' });
  const [claimSent, setClaimSent] = useState(false);

  async function enviarReclamo() {
    if (!claim.name || !claim.email) { alert('Nombre y email son obligatorios'); return; }
    const { error } = await supabase.from('complex_claim_requests').insert({
      complex_id: cx.id,
      name: claim.name.trim(),
      email: claim.email.trim().toLowerCase(),
      phone: claim.phone.trim() || null,
      message: claim.message.trim() || null
    });
    if (error) return alert('Error: ' + error.message);
    setClaimSent(true);
    setTimeout(() => { setClaimOpen(false); setClaimSent(false); }, 3000);
  }

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    setMe(user?.id ?? null);
    const { data: complex } = await supabase.from('complexes')
      .select('*, courts(*)')
      .eq('id', id).single();
    // Solo mostrar públicamente si está APROBADO por admin.
    // Los dueños ven su propio complejo desde /complejo/* (otro flujo).
    if (complex && complex.status !== 'active') {
      setCx({ _notActive: true, status: complex.status });
      return;
    }
    setCx(complex);
    const { data } = await supabase.from('memberships')
      .select('*, members:membership_members(status, payment_status, player_id, payment_proof_url)')
      .eq('complex_id', id).eq('active', true).order('price');
    setPlans(data ?? []);

    // Torneos: activos + últimos 3 finalizados
    const { data: torneos } = await supabase.from('tournaments')
      .select('id, name, category, sex, status, starts_at, entry_fee')
      .eq('complex_id', id)
      .in('status', ['inscripcion_abierta', 'inscripcion_cerrada', 'en_curso', 'finalizado'])
      .order('starts_at', { ascending: false }).limit(6);
    setTournaments(torneos ?? []);
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

    // Avisar al complejo que hay una solicitud nueva
    if (cx?.owner_id) {
      const { data: prof } = await supabase.from('profiles')
        .select('first_name, last_name').eq('id', user.id).maybeSingle();
      const nombre = prof ? `${prof.first_name} ${prof.last_name ?? ''}`.trim() : 'Un jugador';
      await notify({
        user_id: cx.owner_id, kind: 'membresia_ok',
        title: '📝 Nueva solicitud de membresía',
        body: `${nombre} pidió "${plan.name}"${url ? ' + comprobante' : ''}.`,
        link: '/complejo/socios',
        ref_id: plan.id
      });
    }

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

    // Avisar al dueño del complejo que hay un comprobante para revisar
    if (cx?.owner_id) {
      const { data: prof } = await supabase.from('profiles')
        .select('first_name, last_name').eq('id', me).maybeSingle();
      const nombre = prof ? `${prof.first_name} ${prof.last_name ?? ''}`.trim() : 'Un jugador';
      await notify({
        user_id: cx.owner_id, kind: 'membresia_ok',
        title: '💳 Comprobante de membresía',
        body: `${nombre} subió el comprobante de "${plan.name}". Revisalo para activarla.`,
        link: '/complejo/socios',
        ref_id: plan.id
      });
    }

    setBusy(null); setMsg('Comprobante enviado.');
    load();
  }

  if (!cx) return <main className="min-h-dvh bg-courtdark text-white p-8">Cargando...</main>;
  if (cx._notActive) return (
    <main className="min-h-dvh bg-courtdark text-white flex flex-col items-center justify-center p-8 text-center">
      <p className="text-6xl mb-4">🔒</p>
      <p className="font-display font-black text-2xl">Complejo no disponible</p>
      <p className="text-white/60 mt-2 max-w-md">
        {cx.status === 'pending_review'
          ? 'Este complejo está en revisión por nuestro equipo. Volvé pronto.'
          : cx.status === 'suspended'
          ? 'Este complejo está temporalmente fuera de servicio.'
          : 'Este complejo no está disponible en NarvoQ.'}
      </p>
      <Link href="/jugador/dashboard" className="mt-6 bg-ball text-courtdark font-black rounded-2xl px-5 py-3">
        Ir al inicio
      </Link>
    </main>
  );
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

        {/* Banner reclamar — solo si es complejo precargado */}
        {cx.is_precargado && (
          <button onClick={() => setClaimOpen(true)}
            className="mt-3 w-full py-3 rounded-xl bg-yellow-500/10 border-2 border-yellow-500/50 text-yellow-300 font-black text-sm animate-pulse">
            👋 ¿Sos dueño de este complejo? Reclamalo →
          </button>
        )}

        {/* Ubicación con Google Maps */}
        {cx.address && (
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cx.address)}`}
            target="_blank" rel="noopener"
            className="mt-3 flex items-center gap-2 bg-white/5 rounded-xl p-3 hover:bg-white/10">
            <span className="text-2xl">📍</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/50 font-black uppercase">Cómo llegar</p>
              <p className="text-sm font-bold truncate">{cx.address}</p>
            </div>
            <span className="text-ball text-sm font-bold">Mapa ↗</span>
          </a>
        )}

        {/* Horario de atención */}
        {(cx.open_time || cx.close_time) && (
          <section className="mt-4 bg-white/5 rounded-2xl p-3">
            <p className="text-xs text-white/50 font-black uppercase">🕐 Horario de atención</p>
            <p className="text-lg font-display font-black mt-1">
              {cx.open_time?.slice(0, 5) ?? '?'} — {cx.close_time?.slice(0, 5) ?? '?'} hs
            </p>
          </section>
        )}

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

        {/* Torneos del club */}
        {tournaments.length > 0 && (
          <section className="mt-5">
            <p className="font-display font-bold text-ball text-sm">🏆 Torneos</p>
            <div className="mt-2 space-y-2">
              {tournaments.map(t => {
                const isActive = ['inscripcion_abierta', 'inscripcion_cerrada', 'en_curso'].includes(t.status);
                const label = t.status === 'inscripcion_abierta' ? 'Inscripción abierta'
                  : t.status === 'inscripcion_cerrada' ? 'Inscripción cerrada'
                  : t.status === 'en_curso' ? 'En curso'
                  : 'Finalizado';
                return (
                  <Link key={t.id} href={`/torneo/${t.id}`}
                    className="block bg-white/5 rounded-xl p-3 hover:bg-white/10">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-display font-bold truncate flex-1">{t.name}</p>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${isActive ? 'bg-ball/20 text-ball' : 'bg-white/10 text-white/50'}`}>
                        {label}
                      </span>
                    </div>
                    <p className="text-white/50 text-xs mt-1">
                      Cat. {t.category} · {t.sex === 'M' ? 'Masc.' : t.sex === 'F' ? 'Fem.' : 'Mixto'} · {new Date(t.starts_at).toLocaleDateString('es-AR')}
                      {t.entry_fee > 0 && ` · $${Number(t.entry_fee).toLocaleString('es-AR')}`}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

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
                  {/* Datos de pago: solo visibles si el jugador ya solicitó la membresía */}
                  {mine && (
                    <div className="mt-3 rounded-xl bg-white/5 p-3 text-sm">
                      <p className="font-bold">Pago por transferencia</p>
                      {cx.payment_alias && <p>Alias: <b>{cx.payment_alias}</b></p>}
                      {cx.payment_cbu && <p>CBU/CVU: <b>{cx.payment_cbu}</b></p>}
                      {cx.payment_holder && <p>Titular: {cx.payment_holder}</p>}
                    </div>
                  )}
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

      {/* Modal reclamar complejo */}
      {claimOpen && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-end lg:items-center overflow-y-auto"
          onClick={() => setClaimOpen(false)}>
          <div className="bg-[#0B0F16] border-2 border-ball/40 rounded-t-3xl lg:rounded-2xl w-full max-w-md mx-auto p-5 pb-10"
            onClick={e => e.stopPropagation()}>
            {claimSent ? (
              <div className="text-center py-8">
                <p className="text-5xl">✓</p>
                <p className="font-display font-black text-xl mt-3 text-ball">Solicitud enviada</p>
                <p className="text-white/60 text-sm mt-2">Te vamos a contactar por email o WhatsApp para verificar y transferirte el complejo.</p>
              </div>
            ) : (
              <>
                <p className="font-display font-black text-lg">Reclamar {cx.name}</p>
                <p className="text-white/60 text-sm mt-1">
                  Dejanos tus datos y te contactamos para verificarte y darte acceso al panel de tu complejo.
                </p>
                <div className="mt-4 space-y-3">
                  <div><label className="label">Tu nombre completo *</label>
                    <input className="input" value={claim.name} onChange={e => setClaim({ ...claim, name: e.target.value })} required /></div>
                  <div><label className="label">Email *</label>
                    <input className="input" type="email" value={claim.email} onChange={e => setClaim({ ...claim, email: e.target.value })} required /></div>
                  <div><label className="label">WhatsApp (recomendado)</label>
                    <input className="input" inputMode="tel" value={claim.phone} onChange={e => setClaim({ ...claim, phone: e.target.value })} /></div>
                  <div><label className="label">Mensaje (opcional)</label>
                    <textarea className="input resize-none" rows={2} value={claim.message} onChange={e => setClaim({ ...claim, message: e.target.value })} /></div>
                  <button onClick={enviarReclamo} className="btn-ball w-full">
                    📩 Enviar solicitud
                  </button>
                  <button onClick={() => setClaimOpen(false)}
                    className="w-full py-2 text-white/50 text-sm">Cancelar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
