'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Brand from '@/components/Brand';
import ProvinciaLocalidadSelect from '@/components/ProvinciaLocalidadSelect';
import { trialProfileFields } from '@/lib/trial';

// Página que pide los datos que faltan del perfil (ciudad, celular, categoría, etc.).
// Se muestra sí o sí después de entrar con Google la primera vez, o cuando
// alguien tiene un perfil incompleto por cualquier razón.
export default function CompletarPerfil() {
  const router = useRouter();
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [f, setF] = useState({
    phone: '', age: '', sex: 'M', city_id: '', zone: '', category: '8', username: '',
    province: '', locality: ''
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [userStatus, setUserStatus] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'invalid'>('idle');

  // Validador: 3-20 chars, minúsculas, dígitos, . _ (nada más)
  const USERNAME_RE = /^[a-z0-9._]{3,20}$/;

  function cleanUsername(v: string) {
    return v.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')      // saca acentos
      .replace(/\s+/g, '.')                          // espacios → punto
      .replace(/[^a-z0-9._]/g, '');                  // saca símbolos no válidos
  }

  // Check de disponibilidad con debounce
  useEffect(() => {
    const u = f.username.trim();
    if (!u) { setUserStatus('idle'); return; }
    if (!USERNAME_RE.test(u)) { setUserStatus('invalid'); return; }
    setUserStatus('checking');
    const t = setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase.from('profiles').select('id').eq('username', u).maybeSingle();
      if (data && data.id !== user?.id) setUserStatus('taken');
      else setUserStatus('ok');
    }, 350);
    return () => clearTimeout(t);
  }, [f.username]);

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
          username: prof.username ?? '',
          province: prof.province ?? '',
          locality: prof.locality ?? ''
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
    if (!f.province) { setError('Elegí tu provincia.'); setSaving(false); return; }
    if (!f.locality) { setError('Elegí tu localidad.'); setSaving(false); return; }
    if (!f.username.trim()) { setError('Elegí un nombre de usuario.'); setSaving(false); return; }
    if (!USERNAME_RE.test(f.username.trim())) { setError('El nombre de usuario debe tener 3-20 caracteres: solo minúsculas, números, punto o guión bajo.'); setSaving(false); return; }
    if (userStatus === 'taken') { setError('Ese nombre de usuario ya está en uso, probá otro.'); setSaving(false); return; }

    const { data: { user } } = await supabase.auth.getUser();

    // Si el profile ya existe → update. Si NO existe (caso raro: fila nunca
    // creada) → insert con datos mínimos de auth + los del form.
    let err: any = null;
    if (profile) {
      const r = await supabase.from('profiles').update({
        phone: f.phone.trim(),
        age: Number(f.age),
        sex: f.sex,
        city_id: f.city_id || null,
        province: f.province,
        locality: f.locality,
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
        city_id: f.city_id || null,
        province: f.province,
        locality: f.locality,
        zone: f.zone.trim() || null,
        category: Number(f.category),
        ...trialProfileFields()   // 🎁 Trial Premium 60 días
      });
      err = r.error;
    }
    setSaving(false);

    if (err) {
      setError(err.code === '23505' ? 'Ese nombre de usuario ya está en uso, probá otro.' : err.message);
      return;
    }

    // Aplicar roster de complejos: si el usuario ya estaba en la planilla de
    // algún club (por celular/DNI/email), le asignamos la categoría cargada.
    try { await supabase.rpc('apply_roster_to_profile', { p_profile_id: user!.id }); } catch {}

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
    <main className="min-h-dvh px-6 py-8 pb-40 max-w-md mx-auto">
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
            onChange={e => setF({ ...f, username: cleanUsername(e.target.value) })}
            placeholder="ej: juanperez o juan.perez" required maxLength={20}
            autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
          <div className="mt-1 min-h-[18px] text-xs">
            {userStatus === 'checking' && <span className="text-white/50">Verificando…</span>}
            {userStatus === 'invalid' && <span className="text-red-400">Solo minúsculas, números, punto o guión bajo. Entre 3 y 20 caracteres.</span>}
            {userStatus === 'taken' && <span className="text-red-400">Ese nombre de usuario ya está registrado. Intentá con otro.</span>}
            {userStatus === 'ok' && <span className="text-ball">✓ Disponible</span>}
            {userStatus === 'idle' && (
              <span className="text-white/40">Solo minúsculas, números, punto (.) o guión bajo (_). Sin espacios ni acentos. Ej: <b>juan.perez</b></span>
            )}
          </div>
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

        <ProvinciaLocalidadSelect
          provincia={f.province} localidad={f.locality}
          onChange={({ provincia, localidad }) => setF({ ...f, province: provincia, locality: localidad })}
          required
        />

        <div>
          <label className="label">Zona / barrio (opcional)</label>
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
