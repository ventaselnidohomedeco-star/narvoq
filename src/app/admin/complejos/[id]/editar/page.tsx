'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import ProvinciaLocalidadSelect from '@/components/ProvinciaLocalidadSelect';
import { geocodeAddress } from '@/lib/geo';
import { uploadImage } from '@/lib/upload';

// Editar cualquier complejo (útil sobre todo para los precargados).
// Solo super_admin.
export default function EditarComplejo() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [ok, setOk] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [regeoing, setRegeoing] = useState(false);
  const [msg, setMsg] = useState('');
  const [f, setF] = useState({
    name: '', responsible: '', phone: '', email: '',
    address: '', province: '', locality: '',
    open_time: '08:00', close_time: '00:00', slot_minutes: '90',
    whatsapp: '', instagram: '', logo_url: '', payment_notes: '',
    lat: null as number | null, lng: null as number | null
  });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setOk(false);
      const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      const admin = me?.role === 'super_admin';
      setOk(admin);
      if (!admin) return;

      const { data: cx } = await supabase.from('complexes').select('*').eq('id', id).maybeSingle();
      if (cx) {
        setF({
          name: cx.name ?? '', responsible: cx.responsible ?? '',
          phone: cx.phone ?? '', email: cx.email ?? '',
          address: cx.address ?? '', province: cx.province ?? '', locality: cx.locality ?? '',
          open_time: (cx.open_time ?? '08:00:00').slice(0, 5),
          close_time: (cx.close_time ?? '00:00:00').slice(0, 5),
          slot_minutes: String(cx.slot_minutes ?? 90),
          whatsapp: cx.whatsapp ?? '', instagram: cx.instagram ?? '',
          logo_url: cx.logo_url ?? '', payment_notes: cx.payment_notes ?? '',
          lat: cx.lat, lng: cx.lng
        });
      }
      setLoading(false);
    })();
  }, [id]);

  async function regeocode() {
    if (!f.address || !f.locality) { setMsg('Necesitás dirección y localidad.'); return; }
    setRegeoing(true); setMsg('Recalculando GPS…');
    const coords = await geocodeAddress({ address: f.address, locality: f.locality, province: f.province });
    setRegeoing(false);
    if (coords) { setF({ ...f, lat: coords.lat, lng: coords.lng }); setMsg('✓ GPS actualizado (recordá guardar).'); }
    else setMsg('❌ No se pudo geocodificar');
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg('Guardando…');
    const res = await fetch('/api/admin/update-precargado', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        name: f.name.trim(),
        responsible: f.responsible.trim() || null,
        phone: f.phone.trim() || null,
        email: f.email.trim() || null,
        address: f.address.trim(),
        province: f.province, locality: f.locality,
        open_time: f.open_time + ':00', close_time: f.close_time + ':00',
        slot_minutes: Number(f.slot_minutes),
        whatsapp: f.whatsapp.trim() || null,
        instagram: f.instagram.trim() || null,
        logo_url: f.logo_url.trim() || null,
        payment_notes: f.payment_notes.trim() || null,
        lat: f.lat, lng: f.lng
      })
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) return setMsg('❌ ' + (json.error ?? 'Error guardando'));
    setMsg('✓ Guardado');
  }

  if (ok === null || loading) return <main className="p-8 text-white/60">Cargando…</main>;
  if (!ok) return <main className="p-8 text-red-400">Solo super_admin.</main>;

  return (
    <main className="min-h-dvh max-w-2xl mx-auto px-5 py-8">
      <Link href="/admin/complejos" className="text-white/60 text-sm">← Volver</Link>
      <div className="mt-3 flex items-center justify-between gap-3">
        <h1 className="font-display font-black text-3xl">Editar complejo</h1>
        <Link href={`/club/${id}`} target="_blank" className="text-ball text-xs font-bold underline">
          Ver perfil ↗
        </Link>
      </div>

      <form onSubmit={guardar} className="mt-6 space-y-4">
        <div className="card space-y-3">
          <p className="font-display font-bold text-ball text-sm">Datos básicos</p>
          <div><label className="label">Nombre *</label>
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
          <div><label className="label">Dirección *</label>
            <input className="input" value={f.address} onChange={e => setF({ ...f, address: e.target.value })} required /></div>
          <ProvinciaLocalidadSelect
            provincia={f.province} localidad={f.locality}
            onChange={({ provincia, localidad }) => setF({ ...f, province: provincia, locality: localidad })}
            required
          />
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
            <p className="text-xs text-white/60">
              GPS: {f.lat && f.lng ? `${f.lat.toFixed(4)}, ${f.lng.toFixed(4)}` : 'sin coordenadas'}
            </p>
            <button type="button" onClick={regeocode} disabled={regeoing}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white/10 border border-white/20">
              {regeoing ? '…' : '🔄 Recalcular GPS'}
            </button>
          </div>
        </div>

        <div className="card space-y-3">
          <p className="font-display font-bold text-ball text-sm">🕐 Horarios</p>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Apertura</label>
              <input className="input" type="time" value={f.open_time} onChange={e => setF({ ...f, open_time: e.target.value })} /></div>
            <div><label className="label">Cierre</label>
              <input className="input" type="time" value={f.close_time} onChange={e => setF({ ...f, close_time: e.target.value })} /></div>
            <div><label className="label">Turno</label>
              <select className="input" value={f.slot_minutes} onChange={e => setF({ ...f, slot_minutes: e.target.value })}>
                <option value="60">60 min</option>
                <option value="90">90 min</option>
                <option value="120">120 min</option>
              </select></div>
          </div>
          <p className="text-xs text-white/40">Para editar canchas y precios, entrá al perfil del complejo.</p>
        </div>

        <div className="card space-y-3">
          <p className="font-display font-bold text-ball text-sm">🌐 Redes y logo</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">WhatsApp</label>
              <input className="input" value={f.whatsapp} onChange={e => setF({ ...f, whatsapp: e.target.value })} /></div>
            <div><label className="label">Instagram (sin @)</label>
              <input className="input" value={f.instagram} onChange={e => setF({ ...f, instagram: e.target.value })} /></div>
          </div>
          <div>
            <label className="label">Logo (JPG/PNG)</label>
            <div className="flex items-center gap-3">
              {f.logo_url && (
                <img src={f.logo_url} alt="logo" className="w-16 h-16 rounded-lg object-cover border border-white/10" />
              )}
              <label className="btn-ghost cursor-pointer text-sm !py-2 !px-3">
                {uploading ? 'Subiendo…' : (f.logo_url ? 'Cambiar imagen' : '📤 Subir imagen')}
                <input type="file" accept="image/jpeg,image/png,image/jpg" className="hidden"
                  onChange={async e => {
                    const file = e.target.files?.[0]; if (!file) return;
                    setUploading(true);
                    const url = await uploadImage(file, 'complexes');
                    setUploading(false);
                    if (url) setF({ ...f, logo_url: url });
                    else setMsg('❌ No se pudo subir');
                  }} />
              </label>
              {f.logo_url && (
                <button type="button" onClick={() => setF({ ...f, logo_url: '' })}
                  className="text-xs text-red-400">Quitar</button>
              )}
            </div>
            <p className="text-xs text-white/40 mt-1">O pegá una URL:</p>
            <input className="input mt-1" placeholder="https://..." value={f.logo_url} onChange={e => setF({ ...f, logo_url: e.target.value })} />
          </div>
          <div><label className="label">Notas de pago</label>
            <textarea className="input resize-none" rows={2} value={f.payment_notes} onChange={e => setF({ ...f, payment_notes: e.target.value })} /></div>
        </div>

        <button type="submit" disabled={saving} className="btn-ball w-full">
          {saving ? 'Guardando…' : '💾 Guardar cambios'}
        </button>
        {msg && <p className={`text-sm ${msg.startsWith('✓') ? 'text-ball' : msg.startsWith('❌') ? 'text-red-400' : 'text-white/60'}`}>{msg}</p>}
      </form>
    </main>
  );
}
