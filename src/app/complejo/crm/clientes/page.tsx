'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import BackButton from '@/components/BackButton';
import PremiumGate from '@/components/PremiumGate';

type Client = {
  id: string;
  complex_id: string;
  profile_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  total_spent: number;
  visits_count: number;
  created_at: string;
};

export default function ClientesPage() {
  const [cx, setCx] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Client | null>(null);
  const [creating, setCreating] = useState(false);

  async function load(complexId?: string) {
    setLoading(true);
    const cid = complexId ?? cx?.id;
    if (!cid) return setLoading(false);
    const { data } = await supabase.from('pos_clients')
      .select('*').eq('complex_id', cid).order('total_spent', { ascending: false });
    setClients((data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setLoading(false);
      const { data: complex } = await supabase.from('complexes').select('*').eq('owner_id', user.id).maybeSingle();
      setCx(complex);
      if (complex?.is_premium) await load(complex.id);
      else setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  }, [clients, search]);

  if (loading) return <main className="p-8 text-white/60">Cargando…</main>;

  if (!cx?.is_premium) return (
    <main className="min-h-dvh p-6">
      <BackButton fallbackHref="/complejo/crm" label="CRM" />
      <h1 className="font-display font-black text-3xl mt-4 mb-6">Clientes</h1>
      <PremiumGate isPremium={false} feature="financial_reports"><div /></PremiumGate>
    </main>
  );

  return (
    <main className="min-h-dvh max-w-5xl mx-auto px-5 py-6">
      <BackButton fallbackHref="/complejo/crm" label="CRM" />
      <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-black text-3xl">Clientes ({clients.length})</h1>
          <p className="text-white/50 text-sm mt-1">Base de datos con historial de compras</p>
        </div>
        <button onClick={() => setCreating(true)}
          className="bg-ball text-courtdark font-black px-4 py-2 rounded-lg text-sm">
          + Nuevo cliente
        </button>
      </div>

      <div className="mt-4">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Buscar por nombre, teléfono o email…"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
      </div>

      <section className="mt-5 space-y-2">
        {filtered.length === 0 ? (
          <div className="card !p-8 text-center text-white/50">
            {clients.length === 0 ? 'Sin clientes cargados aún. Los podés agregar acá o se crean solos al vender.' : 'Sin resultados.'}
          </div>
        ) : filtered.map(c => (
          <div key={c.id} className="card !p-3 flex items-center gap-3">
            <span className="w-12 h-12 rounded-full bg-grafito text-ball text-lg font-black flex items-center justify-center shrink-0">
              {c.name[0]?.toUpperCase() ?? '?'}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-display font-black truncate">{c.name}</p>
              <p className="text-white/50 text-xs truncate">
                {c.phone && `📱 ${c.phone}`}
                {c.phone && c.email && ' · '}
                {c.email && `✉ ${c.email}`}
              </p>
              {c.notes && <p className="text-white/40 text-xs truncate mt-0.5">📝 {c.notes}</p>}
            </div>
            <div className="text-right shrink-0">
              <p className="font-display font-black text-ball">${c.total_spent.toLocaleString('es-AR')}</p>
              <p className="text-white/40 text-[10px]">{c.visits_count} visitas</p>
            </div>
            <button onClick={() => setEditing(c)}
              className="ml-2 bg-white/10 text-xs px-3 py-2 rounded-lg font-black">
              Editar
            </button>
          </div>
        ))}
      </section>

      {(editing || creating) && cx && (
        <ClientEditor
          complexId={cx.id}
          client={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); load(); }}
        />
      )}
    </main>
  );
}

function ClientEditor({ complexId, client, onClose, onSaved }: {
  complexId: string;
  client: Client | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState<any>(client ?? { name: '', phone: '', email: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setError(''); setSaving(true);
    if (!f.name.trim()) { setError('Nombre requerido'); setSaving(false); return; }
    const payload = {
      complex_id: complexId,
      name: f.name.trim(),
      phone: f.phone?.trim() || null,
      email: f.email?.trim() || null,
      notes: f.notes?.trim() || null
    };
    const q = client
      ? supabase.from('pos_clients').update(payload).eq('id', client.id)
      : supabase.from('pos_clients').insert(payload);
    const { error: err } = await q;
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
  }

  async function del() {
    if (!client) return;
    if (!confirm(`¿Borrar cliente "${client.name}"? Sus ventas históricas quedan sin cliente.`)) return;
    await supabase.from('pos_clients').delete().eq('id', client.id);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-lg bg-[#0F141D] border-t-2 sm:border-2 border-ball rounded-t-3xl sm:rounded-3xl overflow-y-auto max-h-[92dvh]">
        <div className="p-5 sticky top-0 bg-[#0F141D] border-b border-white/10 flex items-center justify-between">
          <h3 className="font-display font-black text-xl">{client ? 'Editar cliente' : 'Nuevo cliente'}</h3>
          <button onClick={onClose} className="text-white/60 text-xl w-10 h-10">✕</button>
        </div>

        <div className="p-5 space-y-3">
          <label className="block">
            <span className="text-white/60 text-xs font-bold uppercase">Nombre *</span>
            <input value={f.name} onChange={e => setF({ ...f, name: e.target.value })}
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white" />
          </label>
          <label className="block">
            <span className="text-white/60 text-xs font-bold uppercase">Teléfono</span>
            <input value={f.phone ?? ''} onChange={e => setF({ ...f, phone: e.target.value })}
              placeholder="ej: 11 5555 1234"
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white" />
          </label>
          <label className="block">
            <span className="text-white/60 text-xs font-bold uppercase">Email</span>
            <input value={f.email ?? ''} onChange={e => setF({ ...f, email: e.target.value })}
              type="email"
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white" />
          </label>
          <label className="block">
            <span className="text-white/60 text-xs font-bold uppercase">Notas</span>
            <textarea value={f.notes ?? ''} onChange={e => setF({ ...f, notes: e.target.value })}
              rows={3}
              placeholder="Preferencias, deudas anteriores, etc."
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
          </label>
          {client && (
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10 text-sm">
              <div>
                <p className="text-white/50 text-xs">Total gastado</p>
                <p className="font-display font-black text-ball">${client.total_spent.toLocaleString('es-AR')}</p>
              </div>
              <div>
                <p className="text-white/50 text-xs">Visitas</p>
                <p className="font-display font-black">{client.visits_count}</p>
              </div>
            </div>
          )}
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        <div className="p-5 sticky bottom-0 bg-[#0F141D] border-t border-white/10 flex gap-2">
          {client && (
            <button onClick={del}
              className="flex-1 bg-red-500/15 border border-red-500/40 text-red-300 font-black rounded-lg py-3 text-sm">
              🗑 Borrar
            </button>
          )}
          <button onClick={save} disabled={saving}
            className="flex-1 bg-ball text-courtdark font-black rounded-lg py-3 disabled:opacity-50">
            {saving ? 'Guardando…' : client ? 'Guardar' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  );
}
