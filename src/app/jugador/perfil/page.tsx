'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import PhotoPicker from '@/components/PhotoPicker';

export default function Perfil() {
  const router = useRouter();
  const [p, setP] = useState<any>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setP(data);
    })();
  }, []);

  async function save(patch: any) {
    const { error } = await supabase.from('profiles').update(patch).eq('id', p.id);
    if (error) return alert(error.message);
    setP({ ...p, ...patch });
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  }

  if (!p) return <main className="p-8 text-white/50">Cargando perfil…</main>;

  return (
    <main className="px-5 pt-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-black text-2xl">Mi perfil</h1>
        <Link href={`/u/${p.username}`} className="text-ball text-sm font-semibold">Ver como público →</Link>
      </div>
      {saved && <p className="text-green-600 text-sm font-semibold mt-1">✓ Guardado</p>}

      {/* Foto */}
      <div className="card mt-4 flex items-center gap-4">
        <PhotoPicker folder="avatars" current={p.avatar_url} shape="circle"
          onUploaded={url => save({ avatar_url: url })} />
        <div>
          <p className="font-display font-black text-lg">{p.first_name} {p.last_name}</p>
          <p className="text-white/50 text-sm">@{p.username}</p>
          <p className="text-white/50 text-xs mt-1">Tocá la foto para cambiarla</p>
        </div>
      </div>

      {/* Datos personales */}
      <div className="card mt-4 space-y-4">
        <p className="font-display font-bold text-sm text-court">Datos personales</p>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Nombre</label>
            <input className="input" defaultValue={p.first_name} onBlur={e => save({ first_name: e.target.value })} /></div>
          <div><label className="label">Apellido</label>
            <input className="input" defaultValue={p.last_name} onBlur={e => save({ last_name: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Edad</label>
            <input className="input" type="number" min={10} max={99} defaultValue={p.age}
              onBlur={e => save({ age: Number(e.target.value) })} /></div>
          <div><label className="label">Celular</label>
            <input className="input" defaultValue={p.phone} onBlur={e => save({ phone: e.target.value })} /></div>
        </div>
        <div><label className="label">Zona / localidad</label>
          <input className="input" defaultValue={p.zone ?? ''} onBlur={e => save({ zone: e.target.value })} /></div>
      </div>

      {/* Datos de juego */}
      <div className="card mt-4 space-y-4">
        <p className="font-display font-bold text-sm text-court">Mi juego</p>
        <div><label className="label">Categoría</label>
          <select className="input" defaultValue={p.category}
            onChange={e => save({ category: Number(e.target.value) })}>
            {[1,2,3,4,5,6,7,8].map(c =>
              <option key={c} value={c}>{c}</option>)}
          </select></div>
        <div><label className="label">Lado preferido</label>
          <div className="flex gap-2">
            {[['drive','Drive'],['reves','Revés'],['ambos','Ambos']].map(([k, l]) => (
              <button key={k} type="button" onClick={() => save({ side: k })}
                className={`px-4 py-2 rounded-xl text-sm font-bold ${p.side === k ? 'bg-court text-white' : 'bg-white/10 text-white/60'}`}>
                {l}
              </button>
            ))}
          </div></div>
        <div><label className="label">Paleta (marca y modelo)</label>
          <input className="input" placeholder="Ej: Bullpadel Vertex 04" defaultValue={p.racket ?? ''}
            onBlur={e => save({ racket: e.target.value })} /></div>
        <div><label className="label">Foto de tu paleta</label>
          <PhotoPicker folder="rackets" current={p.racket_photo_url} shape="wide"
            onUploaded={url => save({ racket_photo_url: url })} /></div>
        <div><label className="label">Bio</label>
          <textarea className="input resize-none" rows={2} maxLength={140}
            placeholder="Ej: Drive zurdo. Siempre listo para un partido 🎾"
            defaultValue={p.bio ?? ''} onBlur={e => save({ bio: e.target.value })} /></div>
      </div>

      <button onClick={async () => { await supabase.auth.signOut(); router.push('/'); }}
        className="mt-6 mb-4 w-full py-3 rounded-xl border border-white/15 font-semibold text-white/60">
        Cerrar sesión
      </button>
    </main>
  );
}
