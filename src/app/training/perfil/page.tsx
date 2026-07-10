'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function PerfilProfe() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [f, setF] = useState({ first_name: '', last_name: '', phone: '', bio: '', zone: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setMe(data);
    setF({
      first_name: data?.first_name ?? '',
      last_name: data?.last_name ?? '',
      phone: data?.phone ?? '',
      bio: data?.bio ?? '',
      zone: data?.zone ?? ''
    });
  }
  useEffect(() => { load(); }, []);

  async function guardar() {
    if (!me) return;
    setSaving(true); setMsg('');
    const { error } = await supabase.from('profiles').update({
      first_name: f.first_name,
      last_name: f.last_name,
      phone: f.phone,
      bio: f.bio || null,
      zone: f.zone || null
    }).eq('id', me.id);
    setSaving(false);
    if (error) return setMsg(error.message);
    setMsg('Guardado.');
  }

  async function salir() {
    await supabase.auth.signOut();
    router.push('/');
  }

  if (!me) return <main className="p-8 text-white/60">Cargando…</main>;

  return (
    <main className="px-5 py-6">
      <h1 className="font-display font-black text-2xl">Perfil</h1>
      <p className="text-white/50 text-sm">@{me.username}</p>

      <section className="card mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Nombre</label>
            <input className="input" value={f.first_name} onChange={e => setF({ ...f, first_name: e.target.value })} /></div>
          <div><label className="label">Apellido</label>
            <input className="input" value={f.last_name} onChange={e => setF({ ...f, last_name: e.target.value })} /></div>
        </div>
        <div><label className="label">Celular</label>
          <input className="input" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></div>
        <div><label className="label">Zona / club donde entrenás</label>
          <input className="input" value={f.zone} onChange={e => setF({ ...f, zone: e.target.value })} /></div>
        <div><label className="label">Bio</label>
          <textarea className="input" rows={3} value={f.bio} onChange={e => setF({ ...f, bio: e.target.value })} /></div>
        {msg && <p className="text-ball text-sm">{msg}</p>}
        <button onClick={guardar} disabled={saving} className="btn-ball w-full disabled:opacity-40">
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </section>

      <button onClick={salir} className="mt-6 w-full py-3 rounded-xl border border-white/15 font-semibold text-white/70">
        Cerrar sesión
      </button>
    </main>
  );
}
