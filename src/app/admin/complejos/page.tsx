'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

// /admin/complejos — Aprobar, rechazar o suspender complejos.
// Solo super_admin (el middleware ya filtra /admin/*).

type Complex = {
  id: string;
  name: string;
  responsible: string;
  phone: string;
  email: string;
  address: string;
  status: 'pending_review' | 'active' | 'suspended' | 'rejected';
  status_updated_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  is_precargado: boolean | null;
  logo_url: string | null;
  locality: string | null;
  province: string | null;
  city: { name: string } | null;
  courts: { id: string }[];
};

const STATUS_LABELS = {
  pending_review: { label: 'En revisión', color: 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300', emoji: '⏳' },
  active: { label: 'Activo', color: 'bg-ball/15 border-ball/40 text-ball', emoji: '✓' },
  suspended: { label: 'Suspendido', color: 'bg-orange-500/15 border-orange-500/40 text-orange-300', emoji: '⚠' },
  rejected: { label: 'Rechazado', color: 'bg-red-500/15 border-red-500/40 text-red-300', emoji: '✕' }
};

type FilterStatus = 'all' | 'precargado' | Complex['status'];

export default function AdminComplejos() {
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('pending_review');
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState('');

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('complexes')
      .select(`
        id, name, responsible, phone, email, address, status,
        status_updated_at, rejection_reason, created_at,
        is_precargado, logo_url, locality, province,
        city:cities(name),
        courts(id)
      `)
      .order('created_at', { ascending: false });
    setComplexes((data as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = complexes;
    if (filter === 'precargado') list = list.filter(c => c.is_precargado);
    else if (filter !== 'all') list = list.filter(c => c.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.responsible?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.city?.name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [complexes, filter, search]);

  const counts = useMemo(() => ({
    all: complexes.length,
    precargado: complexes.filter(c => c.is_precargado).length,
    pending_review: complexes.filter(c => c.status === 'pending_review').length,
    active: complexes.filter(c => c.status === 'active').length,
    suspended: complexes.filter(c => c.status === 'suspended').length,
    rejected: complexes.filter(c => c.status === 'rejected').length
  }), [complexes]);

  async function changeStatus(cx: Complex, newStatus: Complex['status'], reason?: string) {
    const actionLabel = {
      active: 'aprobar',
      suspended: 'suspender',
      rejected: 'rechazar',
      pending_review: 'volver a revisión'
    }[newStatus];
    if (!confirm(`¿${actionLabel} "${cx.name}"?`)) return;

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('complexes').update({
      status: newStatus,
      status_updated_at: new Date().toISOString(),
      status_updated_by: user?.id ?? null,
      rejection_reason: newStatus === 'rejected' ? (reason ?? cx.rejection_reason) : null
    }).eq('id', cx.id);

    if (error) { setMsg(`Error: ${error.message}`); return; }
    setMsg(`✓ "${cx.name}" ahora está ${STATUS_LABELS[newStatus].label.toLowerCase()}.`);
    load();
  }

  async function reject(cx: Complex) {
    const reason = prompt(`Motivo del rechazo de "${cx.name}" (visible para el dueño):`);
    if (reason === null) return;
    await changeStatus(cx, 'rejected', reason.trim() || 'Sin especificar');
  }

  if (loading) return <main className="p-8 text-white/60">Cargando complejos…</main>;

  return (
    <main className="min-h-dvh max-w-5xl mx-auto px-5 py-8">
      <Link href="/admin" className="text-white/60 text-sm font-bold">← Volver al admin</Link>
      <div className="mt-3 flex items-center justify-between gap-3">
        <h1 className="font-display font-black text-3xl">Complejos</h1>
        <Link href="/admin/complejos/nuevo"
          className="btn-ball text-sm !py-2 !px-4 shrink-0">
          + Precargar complejo
        </Link>
      </div>
      <p className="text-white/50 text-sm mt-1">Aprobar, rechazar o suspender complejos registrados. También podés precargar complejos vos mismo para mostrarlos como demo.</p>

      {/* Chips de filtro */}
      <section className="mt-6 flex flex-wrap gap-2">
        {(['pending_review', 'active', 'precargado', 'suspended', 'rejected', 'all'] as const).map(k => {
          const info = k === 'all' ? { label: 'Todos', color: 'bg-white/10 border-white/20 text-white' }
            : k === 'precargado' ? { label: '📦 Precargados', color: 'bg-white/10 border-white/20 text-white/70' }
            : STATUS_LABELS[k];
          const active = filter === k;
          return (
            <button key={k} onClick={() => setFilter(k)}
              className={`px-4 py-2 rounded-lg text-sm font-black border transition
                ${active ? info.color + ' ring-2 ring-white/40' : 'bg-white/5 border-white/10 text-white/60'}`}>
              {info.label} · {counts[k]}
            </button>
          );
        })}
      </section>

      <div className="mt-4">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Buscar por nombre, responsable, email o ciudad…"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
      </div>

      {msg && <p className="mt-3 text-ball text-sm">{msg}</p>}

      {/* Lista */}
      <section className="mt-6 space-y-3">
        {filtered.length === 0 ? (
          <div className="card !p-8 text-center text-white/50">
            {complexes.length === 0 ? 'No hay complejos registrados aún.' : 'Sin resultados con esos filtros.'}
          </div>
        ) : filtered.map(cx => {
          const info = STATUS_LABELS[cx.status];
          return (
            <div key={cx.id} className="card !p-4">
              <div className="flex items-start gap-3">
                {cx.logo_url && (
                  <img src={cx.logo_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-white/10 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-display font-black text-lg truncate">{cx.name}</p>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${info.color}`}>
                      {info.emoji} {info.label}
                    </span>
                    {cx.is_precargado && (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded border bg-white/10 border-white/20 text-white/70">
                        📦 Precargado
                      </span>
                    )}
                  </div>
                  <div className="text-white/60 text-xs mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    <span>👤 {cx.responsible}</span>
                    <span>📱 {cx.phone}</span>
                    <span>✉ {cx.email}</span>
                    <span>📍 {cx.locality ?? cx.city?.name ?? '—'}{cx.province ? `, ${cx.province}` : ''} · {cx.address}</span>
                    <span>🎾 {cx.courts?.length ?? 0} canchas</span>
                    <span>📅 Registrado {new Date(cx.created_at).toLocaleDateString('es-AR')}</span>
                  </div>
                  {cx.status === 'rejected' && cx.rejection_reason && (
                    <p className="text-red-300 text-xs mt-2">📝 Motivo: {cx.rejection_reason}</p>
                  )}
                </div>
                <Link href={`/club/${cx.id}`} target="_blank"
                  className="text-ball text-xs font-bold underline shrink-0">
                  Ver perfil ↗
                </Link>
              </div>

              {/* Acciones */}
              <div className="mt-3 flex flex-wrap gap-2 pt-3 border-t border-white/10">
                <Link href={`/admin/complejos/${cx.id}/editar`}
                  className="text-xs font-black px-3 py-2 rounded-lg bg-ball/15 border border-ball/40 text-ball">
                  ✏ Editar
                </Link>
                {cx.status !== 'active' && (
                  <button onClick={() => changeStatus(cx, 'active')}
                    className="text-xs font-black px-3 py-2 rounded-lg bg-ball/15 border border-ball/40 text-ball">
                    ✓ Aprobar / Reactivar
                  </button>
                )}
                {cx.status === 'active' && (
                  <button onClick={() => changeStatus(cx, 'suspended')}
                    className="text-xs font-black px-3 py-2 rounded-lg bg-orange-500/15 border border-orange-500/40 text-orange-300">
                    ⚠ Suspender
                  </button>
                )}
                {cx.status !== 'rejected' && cx.status !== 'active' && (
                  <button onClick={() => reject(cx)}
                    className="text-xs font-black px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/40 text-red-300">
                    ✕ Rechazar
                  </button>
                )}
                {cx.status !== 'pending_review' && cx.status !== 'active' && (
                  <button onClick={() => changeStatus(cx, 'pending_review')}
                    className="text-xs font-black px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white/70">
                    ⏳ Volver a revisión
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}
