'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { uploadImage } from '@/lib/upload';

const SURFACES = ['cemento', 'sintetico', 'cristal'];

export default function Canchas() {
  const [cx, setCx] = useState<any>(null);
  const [courts, setCourts] = useState<any[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: complex } = await supabase.from('complexes').select('*').eq('owner_id', user!.id).single();
    setCx(complex);
    const { data } = await supabase.from('courts').select('*').eq('complex_id', complex.id).order('name');
    setCourts(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function actualizar(c: any, patch: any) {
    await supabase.from('courts').update(patch).eq('id', c.id); load();
  }

  async function subirFoto(c: any, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusyId(c.id);
    const url = await uploadImage(file, 'courts');
    setBusyId(null);
    if (url) actualizar(c, { photo_url: url });
    else alert('No pudimos subir la foto. ¿Ejecutaste update-01-fotos.sql?');
  }

  async function agregar() {
    await supabase.from('courts').insert({
      complex_id: cx.id, name: `Cancha ${courts.length + 1}`,
      price_per_slot: courts[0]?.price_per_slot ?? 0
    });
    load();
  }

  if (!cx) return <main className="p-8 text-white/70">Cargando…</main>;

  return (
    <main className="px-5 py-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-black text-xl">Mis canchas ({courts.length})</h1>
        <button onClick={agregar} className="btn-ball text-sm">+ Agregar</button>
      </div>

      <div className="mt-4 space-y-4">
        {courts.map(c => (
          <div key={c.id} className="bg-white/5 rounded-2xl overflow-hidden">
            {/* Foto de la cancha */}
            <label className="block relative aspect-video bg-white/5 cursor-pointer">
              {c.photo_url
                ? <img src={c.photo_url} alt="" className="w-full h-full object-cover" />
                : <span className="absolute inset-0 flex flex-col items-center justify-center text-white/40">
                    <span className="text-3xl">📷</span>
                    <span className="text-sm font-semibold">Subir foto de la cancha</span>
                  </span>}
              {busyId === c.id && (
                <span className="absolute inset-0 bg-black/60 flex items-center justify-center font-bold">Subiendo…</span>
              )}
              {c.photo_url && (
                <span className="absolute bottom-2 right-2 bg-black/60 text-xs font-semibold px-2 py-1 rounded-lg">
                  Cambiar foto
                </span>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={e => subirFoto(c, e)} />
            </label>

            <div className="p-4 space-y-3">
              <div className="flex gap-3 items-center">
                <input className="input flex-1 font-bold" defaultValue={c.name}
                  onBlur={e => actualizar(c, { name: e.target.value })} />
                <button onClick={() => actualizar(c, { active: !c.active })}
                  className={`text-xs font-bold px-3 py-2 rounded-lg shrink-0 ${c.active ? 'bg-ball text-courtdark' : 'bg-white/10 text-white/50'}`}>
                  {c.active ? 'Activa' : 'Inactiva'}
                </button>
              </div>

              <div><label className="label text-white/60">Descripción</label>
                <textarea className="input resize-none" rows={2}
                  placeholder="Ej: Cancha de cristal panorámico, techada, con iluminación LED."
                  defaultValue={c.description ?? ''}
                  onBlur={e => actualizar(c, { description: e.target.value })} /></div>

              <div className="grid grid-cols-3 gap-3">
                <div><label className="label text-white/60">$ por turno</label>
                  <input className="input" type="number" defaultValue={c.price_per_slot}
                    onBlur={e => actualizar(c, { price_per_slot: Number(e.target.value) })} /></div>
                <div><label className="label text-white/60">Superficie</label>
                  <select className="input" defaultValue={c.surface}
                    onChange={e => actualizar(c, { surface: e.target.value })}>
                    {SURFACES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select></div>
                <div><label className="label text-white/60">Techada</label>
                  <select className="input" defaultValue={String(c.covered)}
                    onChange={e => actualizar(c, { covered: e.target.value === 'true' })}>
                    <option value="false">No</option><option value="true">Sí</option>
                  </select></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
