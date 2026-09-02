'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import PhotoPicker from '@/components/PhotoPicker';
import ProvinciaLocalidadSelect from '@/components/ProvinciaLocalidadSelect';
import { uploadImage } from '@/lib/upload';
import { geocodeAddress } from '@/lib/geo';

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

      // Auto-geocoding silencioso: si NO tiene lat/lng y tiene al menos localidad,
      // lo geocodificamos con fallback (dirección→localidad+prov→localidad sola).
      if (data && !data.lat && data.locality) {
        const coords = await geocodeAddress({
          address: data.address, locality: data.locality, province: data.province
        });
        if (coords) {
          await supabase.from('complexes').update({ lat: coords.lat, lng: coords.lng }).eq('id', data.id);
          setCx({ ...data, lat: coords.lat, lng: coords.lng });
        }
      }
    })();
  }, []);

  async function save(patch: any) {
    // Si cambia address / province / locality, geocodifico auto.
    // Con fallback: si no encuentra la dirección exacta, usa localidad+provincia.
    const changesGeo = 'address' in patch || 'province' in patch || 'locality' in patch;
    if (changesGeo) {
      const coords = await geocodeAddress({
        address: patch.address ?? cx.address,
        locality: patch.locality ?? cx.locality,
        province: patch.province ?? cx.province
      });
      if (coords) {
        patch = { ...patch, lat: coords.lat, lng: coords.lng };
      }
    }
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
        <div><label className="label text-white/60">Dirección (calle + altura)</label>
          <input className="input" defaultValue={cx.address}
            placeholder="Av. Corrientes 1234"
            onBlur={e => save({ address: e.target.value })} /></div>

        <ProvinciaLocalidadSelect
          provincia={cx.province ?? ''} localidad={cx.locality ?? ''}
          onChange={({ provincia, localidad }) => save({ province: provincia, locality: localidad })}
        />

        {cx.lat && cx.lng ? (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/40 p-3 text-emerald-300 text-xs">
            📍 Ubicación detectada · Los jugadores te ven en el buscador por cercanía
          </div>
        ) : cx.locality ? (
          <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/40 p-3 text-yellow-300 text-xs">
            ⏳ Detectando ubicación… (se hace automático)
          </div>
        ) : (
          <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/40 p-3 text-yellow-300 text-xs">
            ⚠️ Cargá provincia y localidad para que los jugadores te vean en el buscador por cercanía.
          </div>
        )}

        {/* Ciudad legacy — se autopobla cuando eligen provincia+localidad */}
        <details className="text-white/40 text-xs">
          <summary className="cursor-pointer">Ciudad (legacy)</summary>
          <select className="input mt-2" value={cx.city_id ?? ''} onChange={e => save({ city_id: e.target.value })}>
            <option value="">—</option>
            {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </details>
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
        <div>
          <label className="label text-white/60">📍 Link de Google Maps (te ubica exacto en el mapa)</label>
          <input className="input" placeholder="https://maps.app.goo.gl/..."
            defaultValue={cx.maps_url ?? ''}
            onBlur={async e => {
              const url = e.target.value.trim();
              const patch: any = { maps_url: url || null };
              if (url) {
                const r = await fetch(`/api/gmaps-resolve?url=${encodeURIComponent(url)}`);
                const j = await r.json();
                if (j.lat && j.lng) { patch.lat = j.lat; patch.lng = j.lng; }
              }
              save(patch);
            }} />
          <p className="text-xs text-white/40 mt-1">Abrí Google Maps → tocá tu complejo → Compartir → Copiar link. Con esto los jugadores te ven en el mapa exacto.</p>
        </div>
        <div><label className="label text-white/60">Servicios (separados por coma)</label>
          <input className="input" placeholder="Buffet, Vestuarios, Estacionamiento, Alquiler de paletas"
            defaultValue={cx.services ?? ''} onBlur={e => save({ services: e.target.value })} /></div>
      </div>

      {/* 💰 Formas de pago — sección unificada */}
      <div className="mt-4 bg-white/5 rounded-2xl p-4">
        <p className="font-display font-black text-ball text-sm tracking-widest">💰 FORMAS DE PAGO</p>
        <p className="text-white/50 text-xs mt-1">
          Configurá qué opciones ofrecés a tus jugadores. Podés activar/desactivar cada una y elegir cómo cobrás.
        </p>

        {/* 💵 Efectivo */}
        <div className={`mt-4 rounded-2xl p-4 border-2 ${cx.payment_cash_enabled !== false ? 'bg-emerald-500/5 border-emerald-500/40' : 'bg-white/5 border-white/10'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">💵</span>
              <p className="font-display font-black">Efectivo</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer"
                defaultChecked={cx.payment_cash_enabled !== false}
                onChange={e => save({ payment_cash_enabled: e.target.checked })} />
              <div className="w-11 h-6 bg-white/10 rounded-full peer-checked:bg-ball transition after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition peer-checked:after:translate-x-5 peer-checked:after:bg-courtdark"></div>
            </label>
          </div>
          {cx.payment_cash_enabled !== false && (
            <div className="mt-3 space-y-2">
              <div>
                <label className="label text-white/60 text-xs">Descuento en efectivo (%)</label>
                <div className="relative">
                  <input className="input pr-10" type="number" step="0.5" min={0} max={30}
                    placeholder="0"
                    defaultValue={cx.payment_cash_discount_pct ?? 0}
                    onBlur={e => save({ payment_cash_discount_pct: Number(e.target.value) || 0 })} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 font-black">%</span>
                </div>
                <p className="text-white/40 text-[11px] mt-1">Se aplica al total del turno cuando el jugador elige pagar en efectivo en la cancha.</p>
              </div>
              <div>
                <label className="label text-white/60 text-xs">Notas / horarios de atención</label>
                <textarea className="input resize-none" rows={2}
                  placeholder="Ej: Cobramos efectivo en el mostrador. Traé exacto."
                  defaultValue={cx.payment_cash_notes ?? ''}
                  onBlur={e => save({ payment_cash_notes: e.target.value })} />
              </div>
            </div>
          )}
        </div>

        {/* 🏦 Transferencia */}
        <div className={`mt-3 rounded-2xl p-4 border-2 ${cx.payment_transfer_enabled !== false ? 'bg-blue-500/5 border-blue-500/40' : 'bg-white/5 border-white/10'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏦</span>
              <p className="font-display font-black">Transferencia</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer"
                defaultChecked={cx.payment_transfer_enabled !== false}
                onChange={e => save({ payment_transfer_enabled: e.target.checked })} />
              <div className="w-11 h-6 bg-white/10 rounded-full peer-checked:bg-ball transition after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition peer-checked:after:translate-x-5 peer-checked:after:bg-courtdark"></div>
            </label>
          </div>
          {cx.payment_transfer_enabled !== false && (
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label text-white/60 text-xs">Alias</label>
                  <input className="input" placeholder="ej: club.padel.mp"
                    defaultValue={cx.payment_alias ?? ''} onBlur={e => save({ payment_alias: e.target.value })} />
                </div>
                <div>
                  <label className="label text-white/60 text-xs">Banco / billetera</label>
                  <input className="input" placeholder="Mercado Pago, Santander..."
                    defaultValue={cx.payment_bank ?? ''} onBlur={e => save({ payment_bank: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label text-white/60 text-xs">CBU / CVU</label>
                <input className="input" inputMode="numeric"
                  defaultValue={cx.payment_cbu ?? ''} onBlur={e => save({ payment_cbu: e.target.value })} />
              </div>
              <div>
                <label className="label text-white/60 text-xs">Titular de la cuenta</label>
                <input className="input"
                  defaultValue={cx.payment_holder ?? ''} onBlur={e => save({ payment_holder: e.target.value })} />
              </div>
              <div>
                <label className="label text-white/60 text-xs">Instrucciones para el jugador</label>
                <textarea className="input resize-none" rows={2}
                  placeholder="Ej: Transferí el total y subí el comprobante. La reserva se confirma cuando validamos el pago."
                  defaultValue={cx.payment_notes ?? ''} onBlur={e => save({ payment_notes: e.target.value })} />
              </div>
            </div>
          )}
        </div>

        {/* 🔒 PIN de administrador (protege Rentabilidad y Gastos) */}
        <div className="mt-3 rounded-2xl p-4 border-2 bg-white/5 border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔒</span>
            <div>
              <p className="font-display font-black">PIN de administrador (4 dígitos)</p>
              <p className="text-white/50 text-[11px]">Protege Rentabilidad y Gastos. Los empleados que usen el portal no podrán abrirlos sin este PIN.</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <input type="password" inputMode="numeric" maxLength={4}
              defaultValue={cx.admin_pin ?? ''}
              onBlur={e => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                if (v === '' || v.length === 4) save({ admin_pin: v || null });
              }}
              placeholder="••••"
              className="input text-center text-2xl font-black tracking-widest w-32" />
            {cx.admin_pin && (
              <button type="button" onClick={() => save({ admin_pin: null })}
                className="text-xs text-red-400 font-bold">Quitar PIN</button>
            )}
            <p className="text-white/40 text-[11px]">Dejalo vacío para deshabilitar la protección.</p>
          </div>
        </div>

        {/* 🎾 Recargos / descuentos en reservas por forma de pago */}
        <div className="mt-3 rounded-2xl p-4 border-2 bg-white/5 border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎾</span>
            <div>
              <p className="font-display font-black">Precio de canchas según forma de pago</p>
              <p className="text-white/50 text-[11px]">
                Positivo = <b>recargo</b> · Negativo = <b>descuento</b> · 0 = sin cambio.
                Ejemplo: cancha base $7.000 con Transferencia +1.5% → $7.105.
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
            {([
              ['booking_pct_efectivo', '💵 Efectivo'],
              ['booking_pct_transferencia', '🏦 Transferencia'],
              ['booking_pct_debito', '💳 Débito'],
              ['booking_pct_credito', '💳 Crédito'],
              ['booking_pct_mp', '📱 MP']
            ] as const).map(([field, label]) => (
              <div key={field}>
                <label className="block text-white/60 text-[11px] font-bold uppercase mb-1">{label}</label>
                <div className="relative">
                  <input type="number" min={-50} max={50} step={0.1}
                    defaultValue={Number(cx[field] ?? 0)}
                    onBlur={e => save({ [field]: Number(e.target.value) || 0 })}
                    className="input pr-8" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 text-xs">%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 🧾 Descuentos por forma de pago (POS) */}
        <div className="mt-3 rounded-2xl p-4 border-2 bg-white/5 border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧾</span>
            <div>
              <p className="font-display font-black">Descuentos por forma de pago (POS)</p>
              <p className="text-white/50 text-[11px]">Se aplican automáticamente al cobrar en Punto de venta. Poné 0 si no querés descuento.</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
            {([
              ['pos_discount_efectivo', '💵 Efectivo'],
              ['pos_discount_transferencia', '🏦 Transferencia'],
              ['pos_discount_debito', '💳 Débito'],
              ['pos_discount_credito', '💳 Crédito'],
              ['pos_discount_mp', '📱 MP']
            ] as const).map(([field, label]) => (
              <div key={field}>
                <label className="block text-white/60 text-[11px] font-bold uppercase mb-1">{label}</label>
                <div className="relative">
                  <input type="number" min={0} max={50} step={0.5}
                    defaultValue={Number(cx[field] ?? 0)}
                    onBlur={e => save({ [field]: Number(e.target.value) || 0 })}
                    className="input pr-8" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 text-xs">%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 💳 Mercado Pago automático */}
        <div className={`mt-3 rounded-2xl p-4 border-2 ${cx.payment_mp_enabled ? 'bg-[#009EE3]/10 border-[#009EE3]/50' : 'bg-white/5 border-white/10'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">💳</span>
              <div>
                <p className="font-display font-black">Mercado Pago (automático)</p>
                <p className="text-white/50 text-[11px]">Pagos online — la plata cae directo en tu cuenta MP</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer"
                checked={!!cx.payment_mp_enabled}
                onChange={e => save({ payment_mp_enabled: e.target.checked })} />
              <div className="w-11 h-6 bg-white/10 rounded-full peer-checked:bg-ball transition after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition peer-checked:after:translate-x-5 peer-checked:after:bg-courtdark"></div>
            </label>
          </div>

          {cx.payment_mp_enabled && (
            <div className="mt-3">
              {cx.mp_connected_at ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 py-2 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-xs font-black text-center">
                      ✓ Cuenta MP conectada · {new Date(cx.mp_connected_at).toLocaleDateString('es-AR')}
                    </span>
                    <a href="/api/mp/oauth/authorize"
                      className="py-2 px-3 rounded-xl bg-white/10 border border-white/20 text-white text-[11px] font-bold">
                      Reconectar
                    </a>
                  </div>

                  {/* Opción: no permitir tarjeta de crédito (ahorra comisión) */}
                  <div className="rounded-xl bg-white/5 p-3 flex items-start gap-3">
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                      <input type="checkbox" className="sr-only peer"
                        defaultChecked={cx.mp_exclude_credit !== false}
                        onChange={e => save({ mp_exclude_credit: e.target.checked })} />
                      <div className="w-11 h-6 bg-white/10 rounded-full peer-checked:bg-ball transition after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition peer-checked:after:translate-x-5 peer-checked:after:bg-courtdark"></div>
                    </label>
                    <div className="flex-1">
                      <p className="text-white font-black text-sm">🚫 Bloquear tarjeta de crédito</p>
                      <p className="text-white/60 text-[11px] mt-0.5">
                        Recomendado: MP cobra ~10% de comisión por crédito. Con esto solo aceptan débito, dinero en cuenta y transferencia (~3% comisión).
                      </p>
                    </div>
                  </div>

                  {/* Opción: solo permitir pagar SEÑA por MP (no el turno completo) */}
                  <div className="rounded-xl bg-white/5 p-3 flex items-start gap-3">
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                      <input type="checkbox" className="sr-only peer"
                        defaultChecked={!!cx.mp_only_deposit}
                        onChange={e => save({ mp_only_deposit: e.target.checked })} />
                      <div className="w-11 h-6 bg-white/10 rounded-full peer-checked:bg-ball transition after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition peer-checked:after:translate-x-5 peer-checked:after:bg-courtdark"></div>
                    </label>
                    <div className="flex-1">
                      <p className="text-white font-black text-sm">🎯 Solo aceptar seña por MP</p>
                      <p className="text-white/60 text-[11px] mt-0.5">
                        Para minimizar comisiones: por MP solo la seña, y el resto en cancha (efectivo/transferencia). El jugador solo verá el botón "Seña" en la reserva.
                      </p>
                    </div>
                  </div>

                  <p className="text-white/50 text-[11px]">
                    Los jugadores verán el botón "Pagar con MP" al reservar. Podrán pagar la seña o el turno completo.
                  </p>
                </div>
              ) : (
                <div>
                  <a href="/api/mp/oauth/authorize"
                    className="block text-center py-3 rounded-xl bg-[#009EE3] hover:bg-[#0088c9] text-white font-black text-sm active:scale-95 transition">
                    💳 Conectar Mercado Pago ahora
                  </a>
                  <p className="text-white/40 text-[11px] mt-2 text-center">
                    Comisión NarvoQ: <b className="text-ball">0%</b> · Solo pagás la comisión estándar de MP.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Alerta si desactivaron todo */}
        {cx.payment_cash_enabled === false && cx.payment_transfer_enabled === false && !cx.payment_mp_enabled && (
          <div className="mt-3 rounded-2xl bg-red-500/10 border border-red-500/40 p-3">
            <p className="text-red-300 font-black text-sm">⚠️ No tenés ningún método de pago activo</p>
            <p className="text-white/60 text-xs mt-1">Los jugadores no van a poder reservar. Activá al menos uno.</p>
          </div>
        )}
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
        <div className="mt-3">
          <label className="label text-white/60">⏰ Horas para que el jugador suba el comprobante</label>
          <input type="number" min={1} max={72} className="input"
            defaultValue={cx.booking_payment_timeout_hours ?? 2}
            onBlur={e => save({ booking_payment_timeout_hours: Math.max(1, Math.min(72, Number(e.target.value) || 2)) })} />
          <p className="text-white/50 text-xs mt-1">
            Si no sube comprobante en ese tiempo, la reserva se cancela sola. Default: 2 horas.
          </p>
        </div>
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
