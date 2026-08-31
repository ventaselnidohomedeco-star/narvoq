'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import ProvinciaLocalidadSelect from '@/components/ProvinciaLocalidadSelect';
import { geocodeAddress } from '@/lib/geo';

// Admin crea un complejo PRECARGADO (sin dueño). Aparece en el buscador
// como cualquier complejo real. Cuando el dueño real llega, lo reclama.
export default function NuevoComplejoPrecargado() {
  const router = useRouter();
  const [ok, setOk] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [f, setF] = useState({
    name: '', responsible: '', phone: '', email: '',
    address: '', province: '', locality: '',
    open_time: '08:00', close_time: '00:00', slot_minutes: '90',
    courts: '4', price: '10000', deposit: '3000',
    whatsapp: '', instagram: '', logo_url: '', notes: ''
  });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setOk(false);
      const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      setOk(me?.role === 'super_admin');
    })();
  }, []);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name || !f.address || !f.province || !f.locality) {
      return setMsg('Completá nombre, dirección, provincia y localidad.');
    }
    setSaving(true); setMsg('Creando complejo...');

    // 1) Geocodificar
    const coords = await geocodeAddress({
      address: f.address, locality: f.locality, province: f.province
    });

    // 2) Owner = null (precargado). Cuando alguien lo reclame, se lo asignamos.
    const claim_key = crypto.randomUUID();

    // 3) Insertar complejo con service_role via API (para bypass RLS)
    const res = await fetch('/api/admin/create-precargado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: f.name.trim(),
        responsible: f.responsible.trim() || 'Complejo cargado por Narvoq',
        phone: f.phone.trim() || null,
        email: f.email.trim() || null,
        address: f.address.trim(),
        province: f.province, locality: f.locality,
        open_time: f.open_time + ':00', close_time: f.close_time + ':00',
        slot_minutes: Number(f.slot_minutes),
        whatsapp: f.whatsapp.trim() || null,
        instagram: f.instagram.trim() || null,
        logo_url: f.logo_url.trim() || null,
        payment_notes: f.notes.trim() || null,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        is_precargado: true,
        claim_key,
        courts: Number(f.courts),
        price_per_slot: Number(f.price),
        deposit_amount: Number(f.deposit) || null
      })
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) return setMsg('❌ ' + (json.error ?? 'Error creando complejo'));
    setMsg(`✓ Complejo "${f.name}" creado ${coords ? 'con GPS' : 'SIN GPS'}. Ver: /club/${json.id}`);
    setTimeout(() => router.push(`/club/${json.id}`), 2000);
  }

  if (ok === null) return <main className="p-8 text-white/60">Verificando acceso…</main>;
  if (!ok) return <main className="p-8 text-red-400">Solo super_admin.</main>;

  return (
    <main className="min-h-dvh max-w-2xl mx-auto px-5 py-8">
      <Link href="/admin/complejos" className="text-white/60 text-sm">← Volver</Link>
      <h1 className="font-display font-black text-3xl mt-3">Precargar complejo</h1>
      <p className="text-white/50 text-sm mt-1">
        El complejo aparece en el buscador. Cuando el dueño real llegue a Narvoq,
        podrá reclamar la titularidad desde el perfil público.
      </p>

      <form onSubmit={crear} className="mt-6 space-y-4">
        <div className="card space-y-3">
          <p className="font-display font-bold text-ball text-sm">Datos básicos</p>
          <div><label className="label">Nombre del complejo *</label>
            <input className="input" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Responsable</label>
              <input className="input" value={f.responsible} onChange={e => setF({ ...f, responsible: e.target.value })} /></div>
            <div><label className="label">Teléfono</label>
              <input className="input" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} inputMode="tel" /></div>
          </div>
          <div><label className="label">Email</label>
            <input className="input" type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></div>
        </div>

        <div className="card space-y-3">
          <p className="font-display font-bold text-ball text-sm">📍 Ubicación</p>
          <div><label className="label">Dirección (calle + altura) *</label>
            <input className="input" placeholder="Av. Corrientes 1234"
              value={f.address} onChange={e => setF({ ...f, address: e.target.value })} required /></div>
          <ProvinciaLocalidadSelect
            provincia={f.province} localidad={f.locality}
            onChange={({ provincia, localidad }) => setF({ ...f, province: provincia, locality: localidad })}
            required
          />
        </div>

        <div className="card space-y-3">
          <p className="font-display font-bold text-ball text-sm">🎾 Canchas y horarios</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Apertura</label>
              <input className="input" type="time" value={f.open_time} onChange={e => setF({ ...f, open_time: e.target.value })} /></div>
            <div><label className="label">Cierre</label>
              <input className="input" type="time" value={f.close_time} onChange={e => setF({ ...f, close_time: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Duración turno</label>
              <select className="input" value={f.slot_minutes} onChange={e => setF({ ...f, slot_minutes: e.target.value })}>
                <option value="60">60 min</option>
                <option value="90">90 min</option>
                <option value="120">120 min</option>
              </select></div>
            <div><label className="label"># de canchas</label>
              <input className="input" type="number" min={1} max={20} value={f.courts} onChange={e => setF({ ...f, courts: e.target.value })} /></div>
            <div><label className="label">Precio turno</label>
              <input className="input" type="number" value={f.price} onChange={e => setF({ ...f, price: e.target.value })} /></div>
          </div>
          <div><label className="label">Seña sugerida (opcional)</label>
            <input className="input" type="number" value={f.deposit} onChange={e => setF({ ...f, deposit: e.target.value })} /></div>
        </div>

        <div className="card space-y-3">
          <p className="font-display font-bold text-ball text-sm">🌐 Redes y contacto (opcional)</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">WhatsApp</label>
              <input className="input" placeholder="5491122334455" value={f.whatsapp} onChange={e => setF({ ...f, whatsapp: e.target.value })} /></div>
            <div><label className="label">Instagram (sin @)</label>
              <input className="input" placeholder="micomplejo" value={f.instagram} onChange={e => setF({ ...f, instagram: e.target.value })} /></div>
          </div>
          <div><label className="label">URL del logo (opcional)</label>
            <input className="input" placeholder="https://..." value={f.logo_url} onChange={e => setF({ ...f, logo_url: e.target.value })} /></div>
          <div><label className="label">Notas internas</label>
            <textarea className="input resize-none" rows={2} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></div>
        </div>

        <button type="submit" disabled={saving} className="btn-ball w-full">
          {saving ? 'Creando…' : '➕ Crear complejo precargado'}
        </button>
        {msg && <p className={`text-sm ${msg.startsWith('✓') ? 'text-ball' : msg.startsWith('❌') ? 'text-red-400' : 'text-white/60'}`}>{msg}</p>}
      </form>
    </main>
  );
}
