'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Brand from '@/components/Brand';

// Página que pide los datos que faltan del perfil (ciudad, celular, categoría, etc.).
// Se muestra sí o sí después de entrar con Google la primera vez, o cuando
// alguien tiene un perfil incompleto por cualquier razón.
export default function CompletarPerfil() {
  const router = useRouter();
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [f, setF] = useState({
    phone: '', age: '', sex: 'M', city_id: '', zone: '', category: '8', username: ''
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const [{ data: prof }, { data: cs }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('cities').select('id,name').order('name')
      ]);
      setCities(cs ?? []);
      setProfile(prof);
      // Pre-cargar los campos que ya tenga
      if (prof) {
        setF({
          phone: prof.phone && prof.phone !== '-' ? prof.phone : '',
          age: prof.age ? String(prof.age) : '',
          sex: prof.sex ?? 'M',
          city_id: prof.city_id ?? '',
          zone: prof.zone ?? '',
          category: prof.category ? String(prof.category) : '8',
          username: prof.username ?? ''
        });
      }
      setLoading(false);
    })();
  }, [router]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSaving(true);

    if (!f.phone.trim()) { setError('El celular es obligatorio.'); setSaving(false); return; }
    if (!f.age || Number(f.age) < 10 || Number(f.age) > 99) { setError('Poné una edad válida.'); setSaving(false); return; }
    if (!f.city_id) { setError('Elegí tu ciudad.'); setSaving(false); return; }
    if (!f.username.trim()) { setError('Elegí un nombre de usuario.'); setSaving(false); return; }

    const { data: { user } } = await supabase.auth.getUser();

    // Si el profile ya existe → update. Si NO existe (caso raro: fila nunca
    // creada) → insert con datos mínimos de auth + los del form.
    let err: any = null;
    if (profile) {
      const r = await supabase.from('profiles').update({
        phone: f.phone.trim(),
        age: Number(f.age),
        sex: f.sex,
        city_id: f.city_id,
        zone: f.zone.trim() || null,
        category: Number(f.category),
        username: f.username.toLowerCase().trim()
      }).eq('id', user!.id);
      err = r.error;
    } else {
      const meta = user!.user_metadata ?? {};
      const fullName: string = meta.full_name ?? meta.name ?? '';
      const [firstName, ...rest] = fullName.split(' ');
      const r = await supabase.from('profiles').insert({
        id: user!.id,
        role: 'player',
        username: f.username.toLowerCase().trim(),
        first_name: firstName || 'Usuario',
        last_name: rest.join(' ') || '',
        avatar_url: meta.avatar_url ?? meta.picture ?? null,
        phone: f.phone.trim(),
        age: Number(f.age),
        sex: f.sex,
        city_id: f.city_id,
        zone: f.zone.trim() || null,
        category: Number(f.category)
      });
      err = r.error;
    }
    setSaving(false);

    if (err) {
      setError(err.code === '23505' ? 'Ese nombre de usuario ya está en uso, probá otro.' : err.message);
      return;
    }

    // Redirigir al dashboard del rol correspondiente.
    // Usamos window.location (full reload) para forzar que el middleware
    // corra fresh contra el perfil recién actualizado. Con router.push()
    // Next.js reutilizaría la respuesta cacheada del middleware anterior
    // (que aún ve el perfil como "incompleto") y volvería a rebotar acá.
    const dest = profile?.role === 'coach' ? '/training/dashboard'
      : profile?.role === 'complex_admin' ? '/complejo/dashboard'
      : '/jugador/dashboard';
    window.location.href = dest;
  }

  if (loading) return <main className="min-h-dvh flex items-center justify-center text-white/60">Cargando…</main>;

  return (
    <main className="min-h-dvh px-6 py-8 max-w-md mx-auto">
      <Brand variant="full" size={40} className="mb-4" />
      <h1 className="font-display font-black text-3xl">Completá tu perfil</h1>
      <p className="text-white/60 mt-1">
        {profile?.first_name ? `Hola ${profile.first_name}, ` : ''}
        para arrancar necesitamos algunos datos más.
      </p>

      <form onSubmit={guardar} className="mt-6 space-y-4">
        <div>
          <label className="label">Nombre de usuario</label>
          <input className="input" value={f.username}
            onChange={e => setF({ ...f, username: e.target.value })}
            placeholder="ej: juanperez" required />
          <p className="text-white/40 text-xs mt-1">Con este nombre te van a encontrar en la app.</p>
        </div>

        <div>
          <label className="label">Celular</label>
          <input className="input" inputMode="tel" value={f.phone}
            onChange={e => setF({ ...f, phone: e.target.value })}
            placeholder="ej: 11 5555 1234" required />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Edad</label>
            <input className="input" type="number" min={10} max={99} value={f.age}
              onChange={e => setF({ ...f, age: e.target.value })} required />
          </div>
          <div>
            <label className="label">Sexo</label>
            <select className="input" value={f.sex} onChange={e => setF({ ...f, sex: e.target.value })}>
              <option value="M">Masc</option>
              <option value="F">Fem</option>
              <option value="X">Otro</option>
            </select>
          </div>
          <div>
            <label className="label">Cat.</label>
            <select className="input" value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Ciudad</label>
          <select className="input" value={f.city_id} onChange={e => setF({ ...f, city_id: e.target.value })} required>
            <option value="">Elegí tu ciudad</option>
            {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Zona / localidad (opcional)</label>
          <input className="input" value={f.zone}
            onChange={e => setF({ ...f, zone: e.target.value })}
            placeholder="ej: Palermo, Zona Norte…" />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button type="submit" disabled={saving} className="btn-ball w-full text-lg disabled:opacity-50">
          {saving ? 'Guardando…' : 'Guardar y entrar'}
        </button>
      </form>
    </main>
  );
}
