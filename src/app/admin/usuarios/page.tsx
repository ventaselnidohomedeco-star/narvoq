'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

type Tab = 'jugadores' | 'complejos' | 'entrenadores' | 'admins';

export default function AdminUsuarios() {
  const [ok, setOk] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('jugadores');
  const [q, setQ] = useState('');
  const [jugadores, setJugadores] = useState<any[]>([]);
  const [complejos, setComplejos] = useState<any[]>([]);
  const [entrenadores, setEntrenadores] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setOk(false);
    const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (me?.role !== 'super_admin') return setOk(false);
    setOk(true);

    // Endpoint server con service role: trae profiles + email + last_sign_in
    const [usersRes, cxs] = await Promise.all([
      fetch('/api/admin/users-with-email').then(r => r.json()).catch(() => ({ users: [] })),
      supabase.from('complexes')
        .select('id, name, slug, address, locality, province, status, active, is_premium, created_at, owner_id, owner:profiles!owner_id(first_name, last_name, phone, username)')
        .order('created_at', { ascending: false })
    ]);

    const all = (usersRes.users ?? []) as any[];
    // Los que no tienen first_name los mostramos igual en admins (por si algún registro quedó incompleto)
    setJugadores(all.filter(p => p.role === 'player' && p.first_name));
    setEntrenadores(all.filter(p => (p.role === 'coach' || p.role === 'trainer') && p.first_name));
    setAdmins(all.filter(p => p.role === 'super_admin' || p.role === 'complex_admin'));
    setComplejos((cxs.data ?? []) as any[]);
    setLoading(false);
  }

  // Map de emails por user_id (para lookup rápido en complejos)
  const emailByUserId = useMemo(() => {
    const m: Record<string, string> = {};
    [...jugadores, ...entrenadores, ...admins].forEach((u: any) => {
      if (u.id && u.email) m[u.id] = u.email;
    });
    return m;
  }, [jugadores, entrenadores, admins]);

  const list = useMemo(() => {
    let arr =
      tab === 'jugadores' ? jugadores :
      tab === 'complejos' ? complejos.map((c: any) => ({ ...c, owner_email: emailByUserId[c.owner_id] ?? null })) :
      tab === 'entrenadores' ? entrenadores :
      admins;
    if (!q.trim()) return arr;
    const s = q.trim().toLowerCase();
    return arr.filter((x: any) => JSON.stringify(x).toLowerCase().includes(s));
  }, [tab, q, jugadores, complejos, entrenadores, admins, emailByUserId]);

  function exportCSV() {
    if (list.length === 0) return;
    const keys = Object.keys(list[0]).filter(k => typeof list[0][k] !== 'object' || list[0][k] === null);
    const rows = [
      keys.join(','),
      ...list.map((r: any) => keys.map(k => {
        const v = r[k];
        if (v == null) return '';
        return `"${String(v).replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');
    const blob = new Blob([rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `narvoq-${tab}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (ok === null) return <main className="p-8 text-white/60">Verificando…</main>;
  if (!ok) return <main className="p-8 text-red-300">Solo super admin</main>;

  const stats = {
    jugadores: jugadores.length,
    complejos: complejos.length,
    entrenadores: entrenadores.length,
    admins: admins.length,
    total: jugadores.length + entrenadores.length + admins.length
  };

  return (
    <main className="px-5 py-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-ball text-[11px] font-black tracking-widest">ADMIN · USUARIOS</p>
          <h1 className="font-display font-black text-2xl">Todos los usuarios</h1>
          <p className="text-white/50 text-sm mt-1">
            {loading ? 'Cargando…' : `${stats.total} personas registradas + ${stats.complejos} complejos`}
          </p>
        </div>
        <Link href="/admin" className="text-white/60 text-sm font-black">← Volver</Link>
      </div>

      {/* Totales grandes */}
      <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { k: 'jugadores' as Tab, l: '🎾 Jugadores', v: stats.jugadores, color: 'bg-ball/15 border-ball/40 text-ball' },
          { k: 'complejos' as Tab, l: '🏟 Complejos', v: stats.complejos, color: 'bg-blue-500/15 border-blue-500/40 text-blue-300' },
          { k: 'entrenadores' as Tab, l: '👨‍🏫 Entrenadores', v: stats.entrenadores, color: 'bg-orange-500/15 border-orange-500/40 text-orange-300' },
          { k: 'admins' as Tab, l: '⚙️ Admins', v: stats.admins, color: 'bg-purple-500/15 border-purple-500/40 text-purple-300' }
        ].map(s => (
          <button key={s.k} onClick={() => setTab(s.k)}
            className={`text-left rounded-2xl border p-4 transition ${s.color} ${tab === s.k ? 'ring-2 ring-white/40' : 'opacity-70 hover:opacity-100'}`}>
            <p className="text-[11px] font-black opacity-80">{s.l}</p>
            <p className="font-display font-black text-3xl mt-1">{s.v}</p>
          </button>
        ))}
      </div>

      {/* Buscador + export */}
      <div className="mt-5 flex gap-2 items-center flex-wrap">
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="🔍 Buscar por nombre, celular, usuario, localidad…"
          className="flex-1 min-w-[240px] bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40" />
        <button onClick={exportCSV} disabled={list.length === 0}
          className="px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white font-black text-sm active:scale-95 transition disabled:opacity-40">
          ⬇ Export CSV
        </button>
      </div>

      {/* Lista */}
      <div className="mt-4 rounded-2xl border border-white/10 overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-white/50">Cargando…</p>
        ) : list.length === 0 ? (
          <p className="p-8 text-center text-white/40 text-sm">Sin resultados</p>
        ) : (
          <div className="divide-y divide-white/10">
            {tab === 'complejos'
              ? list.map((c: any) => (
                <div key={c.id} className="flex items-start gap-3 p-4 hover:bg-white/5">
                  <span className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-300 text-xl font-display font-black flex items-center justify-center shrink-0">
                    {c.name?.[0]?.toUpperCase() ?? '?'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-black">{c.name}</p>
                      {c.is_premium && <span className="text-[10px] bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded font-black">PREMIUM</span>}
                      <span className={`text-[10px] px-2 py-0.5 rounded font-black ${
                        c.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' :
                        c.status === 'pending_review' ? 'bg-yellow-500/20 text-yellow-300' :
                        'bg-red-500/20 text-red-300'
                      }`}>{c.status ?? (c.active ? 'active' : 'inactive')}</span>
                    </div>
                    <p className="text-white/60 text-sm mt-0.5">📍 {c.address}{c.locality ? ` · ${c.locality}` : ''}{c.province ? `, ${c.province}` : ''}</p>
                    {c.owner && (
                      <p className="text-white/50 text-xs mt-1">
                        👤 {c.owner.first_name} {c.owner.last_name} · 📱 {c.owner.phone ?? '—'}
                      </p>
                    )}
                    {c.owner_email && (
                      <p className="text-white/70 text-xs mt-0.5">
                        ✉️ <a href={`mailto:${c.owner_email}`} className="hover:text-ball underline decoration-dotted break-all">{c.owner_email}</a>
                      </p>
                    )}
                    <p className="text-white/40 text-[11px] mt-1">
                      Slug: <code className="bg-black/40 px-1 rounded">{c.slug ?? '—'}</code> · Registrado {new Date(c.created_at).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                  <Link href={`/admin/complejos/${c.id}/editar`}
                    className="shrink-0 px-3 py-2 rounded-lg bg-white/10 text-white text-xs font-black">Editar</Link>
                </div>
              ))
              : list.map((u: any) => (
                <div key={u.id} className="flex items-center gap-3 p-4 hover:bg-white/5">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
                  ) : (
                    <span className="w-12 h-12 rounded-full bg-grafito text-white font-display font-black flex items-center justify-center shrink-0">
                      {u.first_name?.[0]?.toUpperCase() ?? '?'}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-black">{u.first_name} {u.last_name}</p>
                      {u.is_premium && <span className="text-[10px] bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded font-black">PREMIUM</span>}
                      {u.category != null && <span className="text-[10px] bg-ball/20 text-ball px-2 py-0.5 rounded font-black">CAT {u.category}</span>}
                    </div>
                    <p className="text-white/60 text-sm">@{u.username ?? '—'} · 📱 {u.phone ?? '—'}</p>
                    {u.email && (
                      <p className="text-white/70 text-xs mt-0.5 flex items-center gap-1.5">
                        <span>✉️</span>
                        <a href={`mailto:${u.email}`} className="hover:text-ball underline decoration-dotted break-all">{u.email}</a>
                        {u.email_confirmed
                          ? <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-black shrink-0">✓ verif</span>
                          : <span className="text-[9px] bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded font-black shrink-0">sin verif</span>}
                      </p>
                    )}
                    <p className="text-white/40 text-[11px] mt-1">
                      {u.locality ? `📍 ${u.locality}${u.province ? ', ' + u.province : ''}` : 'Sin localidad'} · Registrado {new Date(u.created_at).toLocaleDateString('es-AR')}
                      {u.last_sign_in_at && ` · Último login ${new Date(u.last_sign_in_at).toLocaleDateString('es-AR')}`}
                    </p>
                  </div>
                  {u.username && (
                    <Link href={`/u/${u.username}`}
                      className="shrink-0 px-3 py-2 rounded-lg bg-white/10 text-white text-xs font-black">Ver</Link>
                  )}
                </div>
              ))
            }
          </div>
        )}
      </div>
    </main>
  );
}
