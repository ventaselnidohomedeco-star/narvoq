'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

// /complejo/cobros — Cobros pendientes por inscripciones de torneo.
// El complejo aprueba, rechaza o marca como cobrado. Impacta dashboard.

type PairRow = {
  id: string;
  tournament_id: string;
  status: 'pendiente' | 'aprobada' | 'rechazada';
  payment_proof_url: string | null;
  created_at: string;
  tournament: { id: string; name: string; price: number | null };
  p1: { first_name: string; last_name: string; avatar_url: string | null } | null;
  p2: { first_name: string; last_name: string; avatar_url: string | null } | null;
};

export default function CobrosComplejo() {
  const [cx, setCx] = useState<any>(null);
  const [rows, setRows] = useState<PairRow[]>([]);
  const [filter, setFilter] = useState<'pendientes' | 'aprobadas' | 'rechazadas' | 'todos'>('pendientes');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  async function load(cxId: string) {
    setLoading(true);
    const { data: torneos } = await supabase.from('tournaments').select('id, name, price').eq('complex_id', cxId);
    const ids = (torneos ?? []).map(t => t.id);
    if (ids.length === 0) { setRows([]); setLoading(false); return; }

    const { data } = await supabase.from('tournament_pairs')
      .select(`id, tournament_id, status, payment_proof_url, created_at,
        tournament:tournaments(id, name, price),
        p1:profiles!player1_id(first_name, last_name, avatar_url),
        p2:profiles!player2_id(first_name, last_name, avatar_url)`)
      .in('tournament_id', ids)
      .order('created_at', { ascending: false });
    setRows((data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('complexes').select('id, name').eq('owner_id', user.id).maybeSingle();
      if (data) { setCx(data); load(data.id); }
    })();
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'todos') return rows;
    if (filter === 'pendientes') return rows.filter(r => r.status === 'pendiente');
    if (filter === 'aprobadas') return rows.filter(r => r.status === 'aprobada');
    return rows.filter(r => r.status === 'rechazada');
  }, [rows, filter]);

  const totals = useMemo(() => {
    const pend = rows.filter(r => r.status === 'pendiente');
    const apr = rows.filter(r => r.status === 'aprobada');
    const sumPend = pend.reduce((s, r) => s + (Number(r.tournament?.price) || 0), 0);
    const sumApr = apr.reduce((s, r) => s + (Number(r.tournament?.price) || 0), 0);
    return { pendCount: pend.length, sumPend, aprCount: apr.length, sumApr };
  }, [rows]);

  async function changeStatus(row: PairRow, status: 'aprobada' | 'rechazada' | 'pendiente') {
    const { error } = await supabase.from('tournament_pairs').update({ status }).eq('id', row.id);
    if (error) { setMsg('❌ ' + error.message); return; }
    setMsg(`✓ Inscripción marcada como ${status}`);
    if (cx) load(cx.id);
    setTimeout(() => setMsg(''), 2500);
  }

  if (!cx) return <main className="p-8 text-white/60">Cargando…</main>;

  return (
    <main className="min-h-dvh px-5 py-6 max-w-4xl mx-auto">
      <Link href="/complejo/dashboard" className="text-white/60 text-sm">← Volver al dashboard</Link>
      <h1 className="font-display font-black text-3xl mt-2">Cobros de torneos</h1>
      <p className="text-white/50 text-sm mt-1">Aprobá, rechazá o marcá inscripciones cobradas. Impacta las estadísticas.</p>

      {/* Totales */}
      <section className="mt-5 grid grid-cols-2 gap-3">
        <div className="card !p-4">
          <p className="text-xs uppercase text-white/50 font-black">Pendientes de cobro</p>
          <p className="font-display font-black text-2xl text-yellow-300 mt-1">${totals.sumPend.toLocaleString('es-AR')}</p>
          <p className="text-xs text-white/50">{totals.pendCount} inscripciones</p>
        </div>
        <div className="card !p-4">
          <p className="text-xs uppercase text-white/50 font-black">Cobrado</p>
          <p className="font-display font-black text-2xl text-ball mt-1">${totals.sumApr.toLocaleString('es-AR')}</p>
          <p className="text-xs text-white/50">{totals.aprCount} inscripciones</p>
        </div>
      </section>

      {/* Filtros */}
      <section className="mt-5 flex flex-wrap gap-2">
        {([
          { k: 'pendientes', label: `⏳ Pendientes (${rows.filter(r => r.status === 'pendiente').length})` },
          { k: 'aprobadas', label: `✓ Cobradas (${rows.filter(r => r.status === 'aprobada').length})` },
          { k: 'rechazadas', label: `✕ Rechazadas (${rows.filter(r => r.status === 'rechazada').length})` },
          { k: 'todos', label: `Todas (${rows.length})` }
        ] as const).map(f => (
          <button key={f.k} onClick={() => setFilter(f.k)}
            className={`px-3 py-2 rounded-lg text-xs font-black border
              ${filter === f.k ? 'bg-ball/15 border-ball/40 text-ball' : 'bg-white/5 border-white/10 text-white/60'}`}>
            {f.label}
          </button>
        ))}
      </section>

      {msg && <p className="mt-3 text-ball text-sm">{msg}</p>}

      {/* Lista */}
      <section className="mt-5 space-y-3">
        {loading ? <p className="text-white/50">Cargando…</p>
          : filtered.length === 0 ? (
          <div className="card text-center py-6">
            <p className="text-white/50">Sin inscripciones {filter !== 'todos' ? filter : ''}.</p>
          </div>
        ) : filtered.map(r => (
          <div key={r.id} className="card !p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold truncate">{r.tournament?.name ?? '—'}</p>
                <p className="text-white/60 text-xs mt-1">
                  {r.p1?.first_name} {r.p1?.last_name} + {r.p2?.first_name} {r.p2?.last_name}
                </p>
                <p className="text-white/50 text-[11px] mt-1">
                  Inscripta el {new Date(r.created_at).toLocaleDateString('es-AR')}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-display font-black text-lg text-ball">${(Number(r.tournament?.price) || 0).toLocaleString('es-AR')}</p>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                  r.status === 'aprobada' ? 'bg-ball/15 border-ball/40 text-ball'
                  : r.status === 'rechazada' ? 'bg-red-500/15 border-red-500/40 text-red-300'
                  : 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300'
                }`}>{r.status}</span>
              </div>
            </div>

            {r.payment_proof_url && (
              <a href={r.payment_proof_url} target="_blank" rel="noopener"
                className="mt-3 inline-block text-ball text-xs font-bold underline">
                📎 Ver comprobante ↗
              </a>
            )}

            <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap gap-2">
              {r.status !== 'aprobada' && (
                <button onClick={() => changeStatus(r, 'aprobada')}
                  className="text-xs font-black px-3 py-2 rounded-lg bg-ball/15 border border-ball/40 text-ball">
                  ✓ Marcar como cobrado
                </button>
              )}
              {r.status !== 'rechazada' && (
                <button onClick={() => changeStatus(r, 'rechazada')}
                  className="text-xs font-black px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/40 text-red-300">
                  ✕ Rechazar
                </button>
              )}
              {r.status !== 'pendiente' && (
                <button onClick={() => changeStatus(r, 'pendiente')}
                  className="text-xs font-black px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white/70">
                  ⏳ Volver a pendiente
                </button>
              )}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
