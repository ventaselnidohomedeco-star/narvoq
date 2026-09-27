'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { uploadImage } from '@/lib/upload';

export default function NuevoCentro() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [existing, setExisting] = useState<any>(null);
  const [checking, setChecking] = useState(true);
  const [form, setForm] = useState({
    name: '',
    brand: '',
    address: '',
    locality: '',
    province: 'Buenos Aires',
    phone: '',
    whatsapp: '',
    email: '',
    website: '',
    instagram: '',
    bio: '',
    hourly_rate: '',
    logo_url: '',
    cover_url: ''
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'logo' | 'cover' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/training/login'); return; }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      setMe(p);
      // ¿ya tiene un centro creado?
      const { data: existingCenter } = await supabase.from('training_centers')
        .select('id, slug, name').eq('created_by', user.id).maybeSingle();
      setExisting(existingCenter);
      setChecking(false);
    })();
  }, [router]);

  async function subirImagen(e: React.ChangeEvent<HTMLInputElement>, tipo: 'logo' | 'cover') {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(tipo);
    const url = await uploadImage(file, 'centros');
    setUploading(null);
    if (url) setForm({ ...form, [tipo === 'logo' ? 'logo_url' : 'cover_url']: url });
  }

  async function crear() {
    setError('');
    if (form.name.trim().length < 3) return setError('El nombre del centro es obligatorio.');
    if (!me?.id) return setError('Sesión expirada.');
    setSaving(true);
    const { data, error: err } = await supabase.from('training_centers').insert({
      name: form.name.trim(),
      brand: form.brand.trim() || null,
      address: form.address.trim() || null,
      locality: form.locality.trim() || null,
      province: form.province.trim() || null,
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      email: form.email.trim() || null,
      website: form.website.trim() || null,
      instagram: form.instagram.trim() || null,
      bio: form.bio.trim() || null,
      hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : 0,
      logo_url: form.logo_url || null,
      cover_url: form.cover_url || null,
      created_by: me.id
    }).select().single();

    if (err || !data) { setSaving(false); setError('No se pudo crear: ' + (err?.message ?? 'error')); return; }

    // Auto-agregarse como master
    await supabase.from('center_members').insert({
      center_id: data.id,
      profile_id: me.id,
      role: 'master',
      title: 'MASTER COACH',
      specialty: form.bio ? form.bio.slice(0, 100) : null,
      hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null
    });

    setSaving(false);
    router.push(`/training/centro/${data.slug}`);
  }

  if (checking) return <main className="p-8 text-white/60">Verificando…</main>;

  if (existing) {
    return (
      <main className="min-h-dvh max-w-md mx-auto px-5 py-8 text-white">
        <div className="text-center">
          <span className="text-6xl">🏫</span>
          <h1 className="font-display font-black text-2xl mt-4">Ya tenés tu centro creado</h1>
          <p className="text-white/60 mt-2">{existing.name}</p>
          <button onClick={() => router.push(`/training/centro/${existing.slug}`)}
            className="btn-ball mt-6">Ir al panel del centro →</button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh max-w-md mx-auto px-5 py-8 text-white">
      <p className="text-ball text-[11px] font-black tracking-widest">NUEVO</p>
      <h1 className="font-display font-black text-3xl mt-1 leading-tight">Crear tu Centro de Entrenamiento</h1>
      <p className="text-white/60 text-sm mt-2">
        Gestioná tu academia con jerarquía de coaches, los 5 pilares, alumnos, disponibilidad y estadísticas.
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <label className="text-white/70 text-xs font-black uppercase mb-1.5 block">Nombre del centro *</label>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Ej: ODpro Experience"
            className="input w-full" />
        </div>

        <div>
          <label className="text-white/70 text-xs font-black uppercase mb-1.5 block">Marca (opcional)</label>
          <input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })}
            placeholder="Ej: ODpro (marca de paletas)"
            className="input w-full" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-white/70 text-xs font-black uppercase mb-1.5 block">Logo</label>
            <label className="block cursor-pointer">
              {form.logo_url ? (
                <img src={form.logo_url} alt="" className="w-full aspect-square object-cover rounded-xl" />
              ) : (
                <div className="w-full aspect-square rounded-xl bg-white/5 border-2 border-dashed border-white/20 flex items-center justify-center text-white/40 text-xs text-center px-2">
                  {uploading === 'logo' ? '⏳' : '+ Subir logo'}
                </div>
              )}
              <input type="file" accept="image/*" hidden onChange={e => subirImagen(e, 'logo')} />
            </label>
          </div>
          <div>
            <label className="text-white/70 text-xs font-black uppercase mb-1.5 block">Portada</label>
            <label className="block cursor-pointer">
              {form.cover_url ? (
                <img src={form.cover_url} alt="" className="w-full aspect-square object-cover rounded-xl" />
              ) : (
                <div className="w-full aspect-square rounded-xl bg-white/5 border-2 border-dashed border-white/20 flex items-center justify-center text-white/40 text-xs text-center px-2">
                  {uploading === 'cover' ? '⏳' : '+ Subir portada'}
                </div>
              )}
              <input type="file" accept="image/*" hidden onChange={e => subirImagen(e, 'cover')} />
            </label>
          </div>
        </div>

        <div>
          <label className="text-white/70 text-xs font-black uppercase mb-1.5 block">Bio / descripción</label>
          <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })}
            rows={3}
            placeholder="Somos un centro especializado en formación de competidores…"
            className="input w-full resize-none" />
        </div>

        <div>
          <label className="text-white/70 text-xs font-black uppercase mb-1.5 block">Dirección</label>
          <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
            placeholder="Av. Doctor René Favaloro s/n y La Aguada"
            className="input w-full" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-white/70 text-xs font-black uppercase mb-1.5 block">Localidad</label>
            <input value={form.locality} onChange={e => setForm({ ...form, locality: e.target.value })}
              placeholder="San Miguel del Monte" className="input w-full" />
          </div>
          <div>
            <label className="text-white/70 text-xs font-black uppercase mb-1.5 block">Provincia</label>
            <input value={form.province} onChange={e => setForm({ ...form, province: e.target.value })}
              className="input w-full" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-white/70 text-xs font-black uppercase mb-1.5 block">WhatsApp</label>
            <input value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })}
              placeholder="2271-555555" className="input w-full" />
          </div>
          <div>
            <label className="text-white/70 text-xs font-black uppercase mb-1.5 block">Instagram</label>
            <input value={form.instagram} onChange={e => setForm({ ...form, instagram: e.target.value })}
              placeholder="@odpro_experience" className="input w-full" />
          </div>
        </div>

        <div>
          <label className="text-white/70 text-xs font-black uppercase mb-1.5 block">Precio de clase base (ARS/hora)</label>
          <input type="number" value={form.hourly_rate} onChange={e => setForm({ ...form, hourly_rate: e.target.value })}
            placeholder="8000" className="input w-full" />
        </div>

        {error && <p className="text-red-300 text-sm">{error}</p>}

        <button onClick={crear} disabled={saving}
          className="btn-ball w-full text-lg mt-2 disabled:opacity-50">
          {saving ? 'Creando centro…' : '🚀 Crear mi Centro'}
        </button>
        <p className="text-white/40 text-[11px] text-center">
          Vas a quedar automáticamente como <b className="text-ball">Master Coach</b>. Después podés invitar a tus coaches y asistentes.
        </p>
      </div>
    </main>
  );
}
