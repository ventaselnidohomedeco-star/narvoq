'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

export default function DemoUsuarios() {
  const { slug } = useParams<{ slug: string }>();
  const [me, setMe] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'staff' | 'students'>('staff');
  const [q, setQ] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
        setMe(p);
      }
      const r = await fetch(`/api/admin/demo-credentials?center_slug=${slug}`);
      const j = await r.json();
      if (!r.ok) { alert(j.error ?? 'error'); setLoading(false); return; }
      setUsers(j.users ?? []);
      setPassword(j.password ?? '');
      setLoading(false);
    })();
  }, [slug]);

  function copy(txt: string, id: string) {
    navigator.clipboard.writeText(txt);
    setCopied(id);
    setTimeout(() => setCopied(''), 1500);
  }

  const staff = useMemo(() => users.filter(u => u.role !== 'student'), [users]);
  const students = useMemo(() => users.filter(u => u.role === 'student'), [users]);
  const filtered = useMemo(() => {
    const list = tab === 'staff' ? staff : students;
    if (!q.trim()) return list;
    const s = q.trim().toLowerCase();
    return list.filter(u => `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(s));
  }, [tab, staff, students, q]);

  if (loading) return <main className="p-8 text-white/60">Cargando credenciales…</main>;
  if (me?.role !== 'super_admin') return <main className="p-8"><p className="text-red-300">Solo super admin</p></main>;

  return (
    <main className="min-h-dvh max-w-3xl mx-auto text-white px-5 py-6">
      <Link href={`/training/centro/${slug}`} className="text-white/50 text-xs font-black">← Volver al panel</Link>
      <h1 className="font-display font-black text-2xl mt-1">🧪 Usuarios DEMO</h1>
      <p className="text-white/60 text-sm">Usá cualquiera de estos emails para loguearte y probar el sistema desde su perspectiva.</p>

      {/* Password común */}
      <div className="mt-5 rounded-2xl bg-ball/10 border border-ball/40 p-4">
        <p className="text-ball text-[11px] font-black tracking-widest">🔑 CONTRASEÑA (todos los demos)</p>
        <div className="flex items-center gap-2 mt-2">
          <code className="flex-1 bg-black/40 rounded-lg px-3 py-2 font-mono text-white select-all">{password}</code>
          <button onClick={() => copy(password, 'pwd')}
            className="shrink-0 px-3 py-2 rounded-lg bg-ball text-black font-black text-xs active:scale-95">
            {copied === 'pwd' ? '✓' : '📋'}
          </button>
        </div>
        <p className="text-white/50 text-[11px] mt-2">
          💡 Para probar: cerrá sesión → ingresá con el email del usuario + esta contraseña
        </p>
      </div>

      {/* Tabs */}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button onClick={() => setTab('staff')}
          className={`py-3 rounded-xl font-black ${tab === 'staff' ? 'bg-purple-500/20 border-2 border-purple-500/50 text-purple-200' : 'bg-white/5 text-white/60 border border-white/10'}`}>
          🎾 Staff ({staff.length})
        </button>
        <button onClick={() => setTab('students')}
          className={`py-3 rounded-xl font-black ${tab === 'students' ? 'bg-ball/20 border-2 border-ball/50 text-ball' : 'bg-white/5 text-white/60 border border-white/10'}`}>
          🎓 Alumnos ({students.length})
        </button>
      </div>

      {/* Buscador */}
      <input value={q} onChange={e => setQ(e.target.value)}
        placeholder={`🔍 Buscar ${tab === 'staff' ? 'coach' : 'alumno'}…`}
        className="input w-full mt-4" />

      {/* Lista */}
      <div className="mt-4 space-y-2">
        {filtered.length === 0 ? (
          <p className="text-white/40 text-sm text-center py-8 bg-white/5 rounded-xl">
            {q.trim() ? 'Sin resultados' : 'Sin usuarios demo cargados'}
          </p>
        ) : filtered.map((u, i) => (
          <div key={u.email} className="rounded-xl bg-white/5 border border-white/10 p-3">
            <div className="flex items-center gap-3">
              <span className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-black ${
                u.role === 'master' ? 'bg-purple-500/30 text-purple-200' :
                u.role === 'coach' ? 'bg-ball/30 text-ball' :
                u.role === 'assistant' ? 'bg-blue-500/30 text-blue-200' :
                'bg-grafito text-white'
              }`}>
                {u.first_name?.[0]}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-black">{u.first_name} {u.last_name}</p>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-black ${
                    u.role === 'master' ? 'bg-purple-500/20 text-purple-300' :
                    u.role === 'coach' ? 'bg-ball/20 text-ball' :
                    u.role === 'assistant' ? 'bg-blue-500/20 text-blue-300' :
                    'bg-white/10 text-white/70'
                  }`}>
                    {u.role === 'master' ? '⭐ MASTER' : u.role === 'coach' ? '🎾 COACH' : u.role === 'assistant' ? '📝 ASIST' : '🎓 ALUMNO'}
                  </span>
                  {u.category != null && <span className="text-[9px] text-white/50">cat {u.category}</span>}
                </div>
                {u.specialty && <p className="text-white/50 text-xs truncate">{u.specialty}</p>}
                <div className="flex items-center gap-2 mt-1.5">
                  <code className="flex-1 text-[11px] bg-black/30 rounded px-2 py-1 font-mono text-white/80 truncate select-all">{u.email}</code>
                  <button onClick={() => copy(u.email, u.email)}
                    className="shrink-0 px-2 py-1 rounded bg-white/10 text-white font-black text-[11px]">
                    {copied === u.email ? '✓' : '📋'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl bg-blue-500/10 border border-blue-500/40 p-4">
        <p className="text-blue-200 text-sm font-black">💡 Cómo probar cada rol</p>
        <ol className="text-blue-100/80 text-xs mt-2 space-y-1.5 list-decimal pl-4">
          <li><b>Como Master:</b> loguéate con el email de Marcelo. Vas a ver el panel completo con todos los accesos.</li>
          <li><b>Como Coach:</b> loguéate con Lucas / Carolina / Agustín / Delfina. Vas a ver solo "Mis alumnos" y "Registrar sesión".</li>
          <li><b>Como Alumno:</b> loguéate con cualquiera de los 70. Verás tu dashboard personal como jugador normal, pero vas a aparecer en el centro y recibir las coordinaciones.</li>
          <li><b>Como Complejo:</b> con tu cuenta original de Master Padel, verás las reservas que caen en las canchas al coordinar turnos.</li>
        </ol>
      </div>
    </main>
  );
}
