'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

// /admin/suscripciones — Lista completa con filtros, búsqueda y acciones.
// Acciones: forzar activa, cancelar, regalar meses gratis, ver historial.
// Export a CSV para el contador.

type Sub = {
  id: string;
  user_id: string | null;
  complex_id: string | null;
  plan_id: string;
  status: string;
  starts_at: string;
  expires_at: string;
  cancelled_at: string | null;
  mp_last_payment_id: string | null;
  created_at: string;
  plan: {
    role: string;
    billing_period: string;
    price_ars: number;
  } | null;
  user?: {
    first_name: string;
    last_name: string;
    username: string;
    email?: string;
  } | null;
  complex?: {
    name: string;
  } | null;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'Activa', color: 'text-ball bg-ball/10 border-ball/30' },
  trial: { label: 'Trial', color: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/30' },
  past_due: { label: 'Vencida', color: 'text-orange-300 bg-orange-500/10 border-orange-500/30' },
  cancelled: { label: 'Cancelada', color: 'text-red-400 bg-red-500/10 border-red-500/30' },
  expired: { label: 'Expirada', color: 'text-white/50 bg-white/5 border-white/20' }
};

export default function AdminSuscripciones() {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<'all' | 'player' | 'coach' | 'complex_admin'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'past_due' | 'cancelled' | 'expired'>('all');
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState('');

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('subscriptions')
      .select(`
        *,
        plan:subscription_plans(role, billing_period, price_ars),
        user:profiles!user_id(first_name, last_name, username),
        complex:complexes(name)
      `)
      .order('created_at', { ascending: false });
    setSubs((data as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = subs;
    if (filterRole !== 'all') list = list.filter(s => s.plan?.role === filterRole);
    if (filterStatus !== 'all') list = list.filter(s => s.status === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(s => {
        const userName = s.user ? `${s.user.first_name} ${s.user.last_name} ${s.user.username}`.toLowerCase() : '';
        const cxName = s.complex?.name?.toLowerCase() ?? '';
        return userName.includes(q) || cxName.includes(q);
      });
    }
    return list;
  }, [subs, filterRole, filterStatus, search]);

  async function forceActive(sub: Sub) {
    if (!confirm(`¿Forzar activa esta suscripción? Vence: ${new Date(sub.expires_at).toLocaleDateString('es-AR')}`)) return;
    const { error } = await supabase.from('subscriptions').update({
      status: 'active', cancelled_at: null
    }).eq('id', sub.id);
    if (error) { setMsg(`Error: ${error.message}`); return; }
    setMsg('✓ Suscripción reactivada');
    load();
  }

  async function cancel(sub: Sub) {
    if (!confirm('¿Cancelar esta suscripción? El usuario mantendrá premium hasta la fecha de vencimiento.')) return;
    const { error } = await supabase.from('subscriptions').update({
      status: 'cancelled', cancelled_at: new Date().toISOString()
    }).eq('id', sub.id);
    if (error) { setMsg(`Error: ${error.message}`); return; }
    setMsg('✓ Suscripción cancelada (sigue premium hasta el vencimiento)');
    load();
  }

  async function extend(sub: Sub, months: number) {
    if (!confirm(`¿Regalar ${months} mes(es) gratis? Nueva fecha de vencimiento: ${new Date(new Date(sub.expires_at).getTime() + months * 30 * 24 * 3600 * 1000).toLocaleDateString('es-AR')}`)) return;
    const newExpires = new Date(new Date(sub.expires_at).getTime() + months * 30 * 24 * 3600 * 1000);
    const { error } = await supabase.from('subscriptions').update({
      expires_at: newExpires.toISOString(),
      status: 'active'
    }).eq('id', sub.id);
    if (error) { setMsg(`Error: ${error.message}`); return; }
    setMsg(`✓ ${months} mes(es) extra otorgados`);
    load();
  }

  function exportCSV() {
    const headers = ['ID', 'Nombre', 'Rol', 'Plan', 'Estado', 'Inicio', 'Vencimiento', 'Precio ARS', 'MP Payment ID'];
    const rows = filtered.map(s => [
      s.id,
      s.user ? `${s.user.first_name} ${s.user.last_name}` : s.complex?.name ?? '—',
      s.plan?.role ?? '—',
      s.plan?.billing_period ?? '—',
      s.status,
      new Date(s.starts_at).toLocaleDateString('es-AR'),
      new Date(s.expires_at).toLocaleDateString('es-AR'),
      s.plan?.price_ars ?? 0,
      s.mp_last_payment_id ?? ''
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `narvoq_suscripciones_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  // Totales para header
  const totalActive = subs.filter(s => s.status === 'active' || s.status === 'trial').length;
  const totalMRR = subs
    .filter(s => (s.status === 'active' || s.status === 'trial') && s.plan)
    .reduce((sum, s) => sum + (s.plan!.billing_period === 'monthly' ? s.plan!.price_ars : s.plan!.price_ars / 12), 0);

  if (loading) return <main className="p-8 text-white/60">Cargando suscripciones…</main>;

  return (
    <main className="min-h-dvh max-w-5xl mx-auto px-5 py-8">
      <Link href="/admin" className="text-white/60 text-sm font-bold">← Volver al admin</Link>
      <div className="flex items-center justify-between mt-3">
        <div>
          <h1 className="font-display font-black text-3xl">Suscripciones</h1>
          <p className="text-white/50 text-sm mt-1">
            {totalActive} activas · MRR ${Math.round(totalMRR).toLocaleString('es-AR')} · {filtered.length} filtradas
          </p>
        </div>
        <button onClick={exportCSV} className="bg-ball text-courtdark font-black text-sm px-4 py-2 rounded-lg">
          📥 Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <section className="mt-6 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Buscar por nombre o complejo…"
          className="flex-1 min-w-[200px] bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
        <select value={filterRole} onChange={e => setFilterRole(e.target.value as any)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
          <option value="all">Todos los roles</option>
          <option value="player">🎾 Jugadores</option>
          <option value="coach">🎓 Entrenadores</option>
          <option value="complex_admin">🏟️ Complejos</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
          <option value="all">Todos los estados</option>
          <option value="active">Activas</option>
          <option value="past_due">Vencidas</option>
          <option value="cancelled">Canceladas</option>
          <option value="expired">Expiradas</option>
        </select>
      </section>

      {msg && <p className="mt-3 text-ball text-sm">{msg}</p>}

      {/* Lista */}
      <section className="mt-6 space-y-2">
        {filtered.length === 0 ? (
          <div className="card !p-6 text-center text-white/50">
            {subs.length === 0
              ? 'Todavía no hay suscripciones. Cuando activemos MP, se van a listar acá.'
              : 'No hay resultados con esos filtros.'}
          </div>
        ) : (
          filtered.map(s => {
            const statusInfo = STATUS_LABELS[s.status] ?? STATUS_LABELS.expired;
            const isExpiringSoon = s.status === 'active' &&
              new Date(s.expires_at).getTime() - Date.now() < 7 * 24 * 3600 * 1000;
            const name = s.user ? `${s.user.first_name} ${s.user.last_name}` : s.complex?.name ?? 'Sin nombre';
            const roleEmoji = s.plan?.role === 'player' ? '🎾' : s.plan?.role === 'coach' ? '🎓' : '🏟️';

            return (
              <div key={s.id} className="card !p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{roleEmoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-display font-black truncate">{name}</p>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                      {isExpiringSoon && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded border text-orange-300 bg-orange-500/10 border-orange-500/30">
                          Vence pronto
                        </span>
                      )}
                    </div>
                    <div className="text-white/60 text-xs mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      <span>Plan: {s.plan?.billing_period === 'monthly' ? 'Mensual' : 'Anual'} · ${s.plan?.price_ars.toLocaleString('es-AR')}</span>
                      <span>Vence: {new Date(s.expires_at).toLocaleDateString('es-AR')}</span>
                      <span>Desde: {new Date(s.starts_at).toLocaleDateString('es-AR')}</span>
                      {s.mp_last_payment_id && <span>MP: {s.mp_last_payment_id.slice(-8)}</span>}
                    </div>
                  </div>
                </div>

                {/* Acciones */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {s.status !== 'active' && (
                    <button onClick={() => forceActive(s)}
                      className="text-xs font-black px-3 py-1.5 rounded-lg bg-ball/15 border border-ball/40 text-ball">
                      ✓ Forzar activa
                    </button>
                  )}
                  {s.status === 'active' && (
                    <button onClick={() => cancel(s)}
                      className="text-xs font-black px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/40 text-red-300">
                      ✕ Cancelar
                    </button>
                  )}
                  <button onClick={() => extend(s, 1)}
                    className="text-xs font-black px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white">
                    +1 mes gratis
                  </button>
                  <button onClick={() => extend(s, 3)}
                    className="text-xs font-black px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white">
                    +3 meses gratis
                  </button>
                </div>
              </div>
            );
          })
        )}
      </section>
    </main>
  );
}
