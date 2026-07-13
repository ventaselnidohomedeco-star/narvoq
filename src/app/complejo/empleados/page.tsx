'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import BackButton from '@/components/BackButton';
import { notify } from '@/lib/notify';

const Avatar = ({ url, name, size = 'w-11 h-11' }: any) => url
  ? <img src={url} alt="" className={`${size} rounded-full object-cover shrink-0`} />
  : <span className={`${size} rounded-full bg-grafito text-ball font-display font-black flex items-center justify-center shrink-0`}>
      {name?.[0]?.toUpperCase() ?? '?'}
    </span>;

export default function Empleados() {
  const [cx, setCx] = useState<any>(null);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [candidatos, setCandidatos] = useState<any[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMe(user.id);
    const { data: complex } = await supabase.from('complexes').select('*').eq('owner_id', user.id).single();
    setCx(complex);
    if (!complex) return;
    const { data } = await supabase.from('complex_employees')
      .select('role, active, created_at, user:profiles!user_id(id, username, first_name, last_name, avatar_url, phone)')
      .eq('complex_id', complex.id).order('created_at', { ascending: false });
    setEmpleados(data ?? []);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    setError('');
    if (q.trim().length < 2) return setCandidatos([]);
    const raw = q.trim();
    const clean = raw.replace(/^@/, '');
    const t = `%${clean}%`;
    const digits = raw.replace(/\D/g, '');
    const phoneT = digits.length >= 3 ? `%${digits}%` : null;
    const parts = clean.split(/\s+/);
    let orClauses = [`username.ilike.${t}`, `first_name.ilike.${t}`, `last_name.ilike.${t}`];
    if (phoneT) orClauses.push(`phone.ilike.${phoneT}`);
    if (parts.length >= 2) {
      orClauses.push(`and(first_name.ilike.%${parts[0]}%,last_name.ilike.%${parts.slice(1).join(' ')}%)`);
    }
    supabase.from('profiles')
      .select('id, username, first_name, last_name, avatar_url')
      .or(orClauses.join(','))
      .limit(10)
      .then(({ data }) => setCandidatos((data ?? []).filter(p => p.id !== me)));
  }, [q, me]);

  async function agregar(p: any, role: 'staff' | 'manager') {
    setError(''); setMsg('');
    if (!cx) return;
    const { error: err } = await supabase.from('complex_employees')
      .insert({ complex_id: cx.id, user_id: p.id, role });
    if (err) {
      if (err.code === '23505') return setError('Esa persona ya es empleada del complejo.');
      return setError(`${err.message}. ¿Ejecutaste update-15-academy-employees.sql?`);
    }
    await notify({
      user_id: p.id, kind: 'coach_add',
      title: `${cx.name} te agregó como empleado`,
      body: role === 'manager' ? 'Podés gestionar calendario, canchas y aprobaciones.' : 'Podés gestionar reservas del complejo.',
      link: '/complejo/dashboard'
    });
    setQ(''); setCandidatos([]); setMsg(`${p.first_name} agregado como ${role === 'manager' ? 'manager' : 'staff'}.`);
    load();
  }

  async function togglear(uid: string, activo: boolean) {
    if (!cx) return;
    await supabase.from('complex_employees').update({ active: !activo })
      .eq('complex_id', cx.id).eq('user_id', uid);
    load();
  }

  async function quitar(uid: string) {
    if (!confirm('¿Quitar este empleado?')) return;
    if (!cx) return;
    await supabase.from('complex_employees').delete()
      .eq('complex_id', cx.id).eq('user_id', uid);
    load();
  }

  if (!cx) return <main className="p-8 text-white/70">Cargando…</main>;

  return (
    <main className="px-5 py-6 pb-24">
      <BackButton fallbackHref="/complejo/mas" label="Más" />
      <h1 className="h-hero mt-4">Empleados</h1>
      <p className="text-white/60 text-sm mt-1">
        Sumá gente de tu equipo para que puedan gestionar reservas y calendario. Vos seguís siendo el único dueño.
      </p>

      <section className="card mt-4 space-y-3">
        <p className="font-display font-black text-ball text-sm">Agregar empleado</p>
        <p className="text-white/50 text-xs">
          Buscá por nombre, apellido, @usuario o celular. La persona ya tiene que estar registrada en NarvoQ.
        </p>
        <input className="input" placeholder="🔍 Buscar persona…" value={q} onChange={e => setQ(e.target.value)} />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        {msg && <p className="text-ball text-sm">{msg}</p>}
        {candidatos.length > 0 && (
          <div className="space-y-2">
            {candidatos.map(p => (
              <div key={p.id} className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                <Avatar url={p.avatar_url} name={p.first_name} size="w-10 h-10" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{p.first_name} {p.last_name}</p>
                  <p className="text-white/50 text-xs truncate">@{p.username}</p>
                </div>
                <button onClick={() => agregar(p, 'staff')}
                  className="text-xs font-black bg-ball text-courtdark rounded-lg px-3 py-2 shrink-0">
                  + Staff
                </button>
                <button onClick={() => agregar(p, 'manager')}
                  className="text-xs font-black bg-grafito text-ball rounded-lg px-3 py-2 shrink-0">
                  + Manager
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <p className="font-display font-black text-ball text-sm mb-2">Equipo actual ({empleados.length})</p>
        {empleados.length === 0 && (
          <div className="card text-center py-8">
            <p className="text-3xl">👥</p>
            <p className="text-white/60 mt-2 text-sm">Todavía no agregaste empleados.</p>
          </div>
        )}
        <ul className="space-y-2">
          {empleados.map(e => (
            <li key={e.user.id} className="card flex items-center gap-3">
              <Avatar url={e.user.avatar_url} name={e.user.first_name} />
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold truncate">{e.user.first_name} {e.user.last_name}</p>
                <p className="text-white/50 text-xs truncate">
                  @{e.user.username} · {e.role === 'manager' ? '⚙️ Manager' : '👤 Staff'}
                </p>
              </div>
              <button onClick={() => togglear(e.user.id, e.active)}
                className={`text-xs font-black px-2.5 py-1.5 rounded-lg ${e.active ? 'bg-ball text-courtdark' : 'bg-white/10 text-white/60'}`}>
                {e.active ? 'ACTIVO' : 'INACTIVO'}
              </button>
              <button onClick={() => quitar(e.user.id)} className="text-white/40 text-xl px-1">×</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card mt-6 !p-4">
        <p className="font-display font-black text-ball text-sm">Permisos</p>
        <div className="mt-3 space-y-2 text-sm">
          <p className="flex gap-2"><span>👤</span><span><b>Staff</b>: puede ver el calendario, cargar reservas manuales, aprobar pagos, y bloquear turnos.</span></p>
          <p className="flex gap-2"><span>⚙️</span><span><b>Manager</b>: todo lo de Staff + editar canchas, precios y ver rentabilidad.</span></p>
          <p className="flex gap-2 text-white/50"><span>⛔</span><span>Solo vos podés editar el perfil del complejo y agregar empleados.</span></p>
        </div>
      </section>
    </main>
  );
}
