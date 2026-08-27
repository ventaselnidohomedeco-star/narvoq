'use client';
import PasswordInput from '@/components/PasswordInput';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import Brand from '@/components/Brand';
import GoogleAuthButton, { AuthDivider } from '@/components/GoogleAuthButton';
import { trialProfileFields } from '@/lib/trial';

// Registro de entrenador con manejo robusto:
//  - No deja usuarios "huérfanos" en auth: si falla el insert de profile,
//    se cierra sesión inmediatamente para que el usuario pueda reintentar
//    (usando esas mismas credenciales) sin recibir "email ya registrado".
//  - Si el email ya existía en auth pero NO en profiles, hace signIn
//    con la contraseña y crea el profile al vuelo (reintento limpio).
//  - Mensajes de error en español, claros y accionables.
//  - Sanitiza el username y valida antes de tocar la base.
export default function TrainingRegistro() {
  const router = useRouter();
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [f, setF] = useState({
    first_name: '', last_name: '', phone: '', age: '30', sex: 'M',
    city_id: '', zone: '', username: '', email: '', password: '', bio: '',
    academy_name: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { supabase.from('cities').select('id,name').then(({ data }) => setCities(data ?? [])); }, []);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  // Construye el payload del profile una sola vez para reusar en signUp y en el reintento.
  function buildProfilePayload(userId: string) {
    return {
      id: userId,
      role: 'coach',
      username: f.username.toLowerCase().trim(),
      first_name: f.first_name.trim(),
      last_name: f.last_name.trim(),
      phone: f.phone.trim(),
      age: Number(f.age),
      sex: f.sex,
      city_id: f.city_id || null,
      zone: f.zone.trim() || null,
      category: 4,
      bio: f.bio.trim() || null,
      academy_name: f.academy_name.trim() || null,
      ...trialProfileFields()   // 🎁 Trial Premium 60 días
    };
  }

  // Traduce errores de Supabase a mensajes humanos.
  function humanError(err: any): string {
    const msg: string = err?.message ?? '';
    const code: string = err?.code ?? '';
    if (code === '23505' || /duplicate key/i.test(msg)) {
      if (/username/i.test(msg)) return 'Ese nombre de usuario ya está en uso, probá otro.';
      if (/email/i.test(msg)) return 'Ese email ya está registrado. Probá iniciar sesión.';
      return 'Algún dato duplicado. Cambiá usuario o email.';
    }
    if (/schema cache/i.test(msg)) {
      return 'La base de datos necesita una migración pendiente. Contactá al soporte (update-30 sin correr).';
    }
    if (/invalid.*email/i.test(msg)) return 'El email no es válido.';
    if (/password/i.test(msg) && /short|weak|character/i.test(msg))
      return 'La contraseña es muy corta (mínimo 6 caracteres).';
    return msg || 'Ocurrió un error. Probá de nuevo.';
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');

    // Validaciones básicas ANTES de tocar la base
    if (!f.username.trim() || !/^[a-z0-9_.-]{3,24}$/.test(f.username.toLowerCase().trim())) {
      setError('El nombre de usuario debe tener 3-24 letras/números (sin espacios).');
      setLoading(false); return;
    }
    if (f.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      setLoading(false); return;
    }

    // 1) Intentar signUp
    const { data, error: signErr } = await supabase.auth.signUp({
      email: f.email.trim(),
      password: f.password
    });

    let userId: string | null = data?.user?.id ?? null;

    // 1.a) Si el email YA está registrado, probamos signIn (recuperación de intento previo fallido)
    if (signErr && /already registered|already been registered/i.test(signErr.message)) {
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: f.email.trim(), password: f.password
      });
      if (signInErr || !signInData?.user) {
        setError('Este email ya está registrado. Si es tuyo, andá a "Entrá acá" y usá tu contraseña o recuperala.');
        setLoading(false); return;
      }
      userId = signInData.user.id;

      // Si ya tenía profile, avisar que use login normal
      const { data: existing } = await supabase.from('profiles').select('id, role').eq('id', userId).maybeSingle();
      if (existing) {
        await supabase.auth.signOut();
        setError('Este email ya tiene una cuenta activa. Entrá desde "Ya sos profe? Entrá acá".');
        setLoading(false); return;
      }
      // Si no tiene profile, seguimos y creamos su profile abajo.
    } else if (signErr || !userId) {
      setError(humanError(signErr));
      setLoading(false); return;
    }

    // 2) Insertar profile — si falla, cerrar sesión y NO dejar user huérfano usable
    const { error: pErr } = await supabase.from('profiles').insert(buildProfilePayload(userId!));

    if (pErr) {
      // Cerramos sesión para que el usuario pueda reintentar con esas mismas credenciales
      // (nuestro flujo detecta el user existente y le da otra chance de crear el profile).
      await supabase.auth.signOut();
      setError(humanError(pErr) + ' Los datos de acceso quedaron guardados, podés reintentar con el mismo email y contraseña.');
      setLoading(false); return;
    }

    // 3) Todo OK
    router.push('/training/dashboard');
  }

  return (
    <main className="min-h-dvh px-6 py-10 max-w-md mx-auto">
      <Brand variant="full" size={36} className="mb-4" />
      <p className="font-display font-black text-ball text-sm tracking-widest">TRAINING</p>
      <h1 className="font-display font-black text-3xl mt-1">Crear cuenta de profe</h1>
      <p className="text-white/50 mt-1">Registrá alumnos, cargá sesiones y compartí sus dashboards.</p>

      <div className="mt-6">
        <GoogleAuthButton role="coach" label="Registrarme con Google" />
      </div>
      <AuthDivider />

      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Nombre</label><input className="input" value={f.first_name} onChange={set('first_name')} required /></div>
          <div><label className="label">Apellido</label><input className="input" value={f.last_name} onChange={set('last_name')} required /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Celular</label><input className="input" inputMode="tel" value={f.phone} onChange={set('phone')} required /></div>
          <div><label className="label">Edad</label><input className="input" type="number" min={16} max={99} value={f.age} onChange={set('age')} required /></div>
        </div>
        <div><label className="label">Ciudad</label>
          <select className="input" value={f.city_id} onChange={set('city_id')}>
            <option value="">Elegí tu ciudad</option>
            {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></div>
        <div><label className="label">Zona / club donde entrenás</label>
          <input className="input" value={f.zone} onChange={set('zone')} placeholder="Ej: Club Náutico, Sport Club, etc." /></div>
        <div><label className="label">Academia (opcional)</label>
          <input className="input" value={f.academy_name} onChange={set('academy_name')}
            placeholder="Ej: Palermo Padel Academy — dejalo vacío si sos independiente" /></div>
        <div><label className="label">Bio corta</label>
          <input className="input" value={f.bio} onChange={set('bio')} placeholder="Especialidad, categoría, años de experiencia…" /></div>
        <div className="court-divider my-2" />
        <div><label className="label">Usuario (3-24 letras/números)</label>
          <input className="input" value={f.username} onChange={set('username')} required
            pattern="[a-zA-Z0-9_.-]{3,24}" /></div>
        <div><label className="label">Email</label><input className="input" type="email" value={f.email} onChange={set('email')} required /></div>
        <div><label className="label">Contraseña</label><PasswordInput minLength={6} value={f.password} onChange={set('password')} required /></div>
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}
        <button className="btn-ball w-full text-lg" disabled={loading}>{loading ? 'Creando…' : 'Crear cuenta de profe'}</button>
      </form>
      <p className="mt-6 text-white/50">
        ¿Ya sos profe? <Link href="/training/login" className="text-ball font-semibold">Entrá acá</Link>
      </p>
    </main>
  );
}
