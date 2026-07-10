'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import PhotoPicker from '@/components/PhotoPicker';
import { uploadImage } from '@/lib/upload';

export default function PerfilComplejo() {
  const router = useRouter();
  const [cx, setCx] = useState<any>(null);
  const [cities, setCities] = useState<any[]>([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase.from('complexes').select('*').eq('owner_id', user!.id).single();
      setCx(data);
      const { data: cs } = await supabase.from('cities').select('id,name');
      setCities(cs ?? []);
    })();
  }, []);

  async function save(patch: any) {
    await supabase.from('complexes').update(patch).eq('id', cx.id);
    setCx({ ...cx, ...patch });
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  }

  async function agregarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const url = await uploadImage(file, 'complejos');
    setBusy(false);
    if (url) save({ photos: [...(cx.photos ?? []), url] });
  }

  async function quitarFoto(url: string) {
    save({ photos: cx.photos.filter((p: string) => p !== url) });
  }

  if (!cx) return <main className="p-8 text-white/70">Cargando…</main>;

  return (
    <main className="px-5 py-6">
      <h1 className="font-display font-black text-xl">Perfil del complejo</h1>
      {saved && <p className="text-green-400 text-sm font-semibold mt-1">✓ Guardado</p>}

      {/* Logo */}
      <div className="mt-5 bg-white/5 rounded-2xl p-4 flex items-center gap-4">
        <div className="[&_.label]:text-white/60 [&_button]:!bg-white/10 [&_button]:!border-white/20">
          <PhotoPicker folder="logos" current={cx.logo_url} shape="circle"
            onUploaded={url => save({ logo_url: url })} />
        </div>
        <div>
          <p className="font-display font-black">{cx.name}</p>
          <p className="text-white/50 text-sm">Tocá el círculo para subir el logo</p>
        </div>
      </div>

      {/* Datos */}
      <div className="mt-4 bg-white/5 rounded-2xl p-4 space-y-4">
        <div><label className="label text-white/60">Nombre del complejo</label>
          <input className="input" defaultValue={cx.name} onBlur={e => save({ name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label text-white/60">Responsable</label>
            <input className="input" defaultValue={cx.responsible} onBlur={e => save({ responsible: e.target.value })} /></div>
          <div><label className="label text-white/60">Teléfono</label>
            <input className="input" defaultValue={cx.phone} onBlur={e => save({ phone: e.target.value })} /></div>
        </div>
        <div><label className="label text-white/60">Dirección</label>
          <input className="input" defaultValue={cx.address} onBlur={e => save({ address: e.target.value })} /></div>
        <div><label className="label text-white/60">Ciudad</label>
          <select className="input" value={cx.city_id} onChange={e => save({ city_id: e.target.value })}>
            {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></div>
      </div>

      {/* Contacto y redes */}
      <div className="mt-4 bg-white/5 rounded-2xl p-4 space-y-4">
        <p className="font-display font-bold text-ball text-sm">Contacto y redes</p>
        <div><label className="label text-white/60">WhatsApp (con código de área, ej: 5492271400000)</label>
          <input className="input" defaultValue={cx.whatsapp ?? ''}
            onBlur={e => save({ whatsapp: e.target.value })} /></div>
        <div><label className="label text-white/60">Instagram (sin @)</label>
          <input className="input" defaultValue={cx.instagram ?? ''}
            onBlur={e => save({ instagram: e.target.value })} /></div>
        <div><label className="label text-white/60">Link de Google Maps</label>
          <input className="input" placeholder="https://maps.app.goo.gl/..."
            defaultValue={cx.maps_url ?? ''} onBlur={e => save({ maps_url: e.target.value })} /></div>
        <div><label className="label text-white/60">Servicios (separados por coma)</label>
          <input className="input" placeholder="Buffet, Vestuarios, Estacionamiento, Alquiler de paletas"
            defaultValue={cx.services ?? ''} onBlur={e => save({ services: e.target.value })} /></div>
      </div>

      {/* Datos de cobro */}
      <div className="mt-4 bg-white/5 rounded-2xl p-4 space-y-4">
        <p className="font-display font-bold text-ball text-sm">Datos para recibir transferencias</p>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label text-white/60">Alias</label>
            <input className="input" placeholder="ej: club.padel.mp"
              defaultValue={cx.payment_alias ?? ''} onBlur={e => save({ payment_alias: e.target.value })} /></div>
          <div><label className="label text-white/60">Banco / billetera</label>
            <input className="input" placeholder="Mercado Pago, Banco..."
              defaultValue={cx.payment_bank ?? ''} onBlur={e => save({ payment_bank: e.target.value })} /></div>
        </div>
        <div><label className="label text-white/60">CBU / CVU</label>
          <input className="input" inputMode="numeric"
            defaultValue={cx.payment_cbu ?? ''} onBlur={e => save({ payment_cbu: e.target.value })} /></div>
        <div><label className="label text-white/60">Titular de la cuenta</label>
          <input className="input"
            defaultValue={cx.payment_holder ?? ''} onBlur={e => save({ payment_holder: e.target.value })} /></div>
        <div><label className="label text-white/60">Instrucciones para el jugador</label>
          <textarea className="input resize-none" rows={3}
            placeholder="Ej: transferi el total y subi el comprobante. La reserva se confirma cuando validamos el pago."
            defaultValue={cx.payment_notes ?? ''} onBlur={e => save({ payment_notes: e.target.value })} /></div>
      </div>

      {/* Horarios y reglas */}
      <div className="mt-4 bg-white/5 rounded-2xl p-4">
        <p className="font-display font-bold text-ball text-sm">Horarios y reglas</p>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div><label className="label text-white/60">Abre</label>
            <input type="time" className="input" defaultValue={cx.open_time?.slice(0, 5)}
              onBlur={e => save({ open_time: e.target.value })} /></div>
          <div><label className="label text-white/60">Cierra</label>
            <input type="time" className="input" defaultValue={cx.close_time?.slice(0, 5)}
              onBlur={e => save({ close_time: e.target.value })} /></div>
          <div><label className="label text-white/60">Turno</label>
            <select className="input" defaultValue={cx.slot_minutes}
              onChange={e => save({ slot_minutes: Number(e.target.value) })}>
              <option value={60}>60′</option><option value={90}>90′</option><option value={120}>120′</option>
            </select></div>
        </div>
        <div className="mt-3"><label className="label text-white/60">Cancelación gratis hasta (horas antes)</label>
          <input type="number" className="input" defaultValue={cx.cancel_hours}
            onBlur={e => save({ cancel_hours: Number(e.target.value) })} /></div>
      </div>

      {/* Galería de fotos */}
      <div className="mt-4 bg-white/5 rounded-2xl p-4">
        <p className="font-display font-bold text-ball text-sm">Fotos del complejo</p>
        <div className="grid grid-cols-3 gap-2 mt-3">
          {(cx.photos ?? []).map((url: string) => (
            <div key={url} className="relative aspect-square">
              <img src={url} alt="" className="w-full h-full object-cover rounded-xl" />
              <button onClick={() => quitarFoto(url)}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 text-xs font-bold">✕</button>
            </div>
          ))}
          <label className="aspect-square rounded-xl border-2 border-dashed border-white/20 flex items-center justify-center text-white/40 text-2xl cursor-pointer">
            {busy ? '…' : '+'}
            <input type="file" accept="image/*" className="hidden" onChange={agregarFoto} />
          </label>
        </div>
      </div>

      <button onClick={async () => { await supabase.auth.signOut(); router.push('/'); }}
        className="mt-6 w-full py-3 rounded-xl border border-white/20 font-semibold text-white/60">
        Cerrar sesión
      </button>
    </main>
  );
}
