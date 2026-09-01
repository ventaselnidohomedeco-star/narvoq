'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { uploadImage } from '@/lib/upload';

type Expense = {
  id: string;
  complex_id: string;
  category: string;
  amount: number;
  spent_on: string;
  description: string | null;
  receipt_url: string | null;
  is_recurring: boolean;
  recurring_day: number | null;
  created_at: string;
};

const CATEGORIAS = [
  { key: 'Sueldos', emoji: '👥' },
  { key: 'Alquiler', emoji: '🏠' },
  { key: 'Servicios', emoji: '💡' },
  { key: 'Mantenimiento', emoji: '🔧' },
  { key: 'Impuestos', emoji: '🧾' },
  { key: 'Insumos buffet', emoji: '🥤' },
  { key: 'Marketing', emoji: '📣' },
  { key: 'Otros', emoji: '📦' }
];

export default function GastosPage() {
  const [cx, setCx] = useState<any>(null);
  const [rows, setRows] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthOffset, setMonthOffset] = useState(0);   // 0 = mes actual, 1 = anterior, ...
  const [msg, setMsg] = useState('');

  // Form
  const [f, setF] = useState({
    category: 'Servicios',
    amount: '',
    spent_on: new Date().toISOString().slice(0, 10),
    description: '',
    receipt_url: '',
    is_recurring: false,
    recurring_day: ''
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const monthRange = useMemo(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
    const to = new Date(now.getFullYear(), now.getMonth() - monthOffset + 1, 0);
    return { from, to };
  }, [monthOffset]);

  async function load(cxId: string) {
    setLoading(true);
    const { data } = await supabase.from('expenses')
      .select('*').eq('complex_id', cxId)
      .gte('spent_on', monthRange.from.toISOString().slice(0, 10))
      .lte('spent_on', monthRange.to.toISOString().slice(0, 10))
      .order('spent_on', { ascending: false });
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
  useEffect(() => { if (cx) load(cx.id); }, [monthOffset]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!f.amount || Number(f.amount) <= 0) return setMsg('Ingresá un monto válido');
    setSaving(true); setMsg('');
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('expenses').insert({
      complex_id: cx.id,
      category: f.category,
      amount: Math.round(Number(f.amount)),
      spent_on: f.spent_on,
      description: f.description.trim() || null,
      receipt_url: f.receipt_url || null,
      is_recurring: f.is_recurring,
      recurring_day: f.is_recurring ? (Number(f.recurring_day) || new Date(f.spent_on).getDate()) : null,
      created_by: user?.id ?? null
    });
    setSaving(false);
    if (error) return setMsg('❌ ' + error.message);
    setF({ ...f, amount: '', description: '', receipt_url: '' });
    setMsg('✓ Gasto registrado');
    load(cx.id);
    setTimeout(() => setMsg(''), 2000);
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este gasto?')) return;
    await supabase.from('expenses').delete().eq('id', id);
    load(cx.id);
  }

  const totales = useMemo(() => {
    const total = rows.reduce((a, r) => a + r.amount, 0);
    const byCat = new Map<string, number>();
    rows.forEach(r => byCat.set(r.category, (byCat.get(r.category) ?? 0) + r.amount));
    const cats = Array.from(byCat.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
    return { total, cats };
  }, [rows]);

  if (!cx) return <main className="p-8 text-white/60">Cargando…</main>;

  const mesLabel = monthRange.from.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  return (
    <main className="min-h-dvh max-w-5xl mx-auto px-5 py-6">
      <Link href="/complejo/dashboard" className="text-white/60 text-sm">← Volver al dashboard</Link>

      <div className="mt-3 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-black text-3xl">💸 Gastos</h1>
          <p className="text-white/50 text-sm">Se restan de tus ingresos para calcular rentabilidad.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonthOffset(monthOffset + 1)}
            className="bg-white/10 px-3 py-2 rounded-lg text-sm">←</button>
          <span className="font-display font-black text-lg capitalize">{mesLabel}</span>
          <button disabled={monthOffset === 0} onClick={() => setMonthOffset(Math.max(0, monthOffset - 1))}
            className="bg-white/10 px-3 py-2 rounded-lg text-sm disabled:opacity-40">→</button>
        </div>
      </div>

      {/* Total del mes */}
      <section className="mt-5 rounded-2xl bg-red-500/10 border border-red-500/30 p-4">
        <p className="text-red-300 text-xs font-black uppercase">Total gastado este mes</p>
        <p className="font-display font-black text-3xl text-red-300 mt-1">
          −${totales.total.toLocaleString('es-AR')}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {totales.cats.map(c => (
            <span key={c.category} className="bg-white/10 border border-white/10 rounded-full px-3 py-1 text-xs">
              {CATEGORIAS.find(x => x.key === c.category)?.emoji ?? '·'} {c.category}: <b>${c.total.toLocaleString('es-AR')}</b>
            </span>
          ))}
        </div>
      </section>

      {/* Formulario nuevo gasto */}
      <form onSubmit={crear} className="mt-5 card space-y-3">
        <p className="font-display font-bold text-ball text-sm">➕ Nuevo gasto</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="label">Categoría</label>
            <select className="input" value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>
              {CATEGORIAS.map(c => <option key={c.key} value={c.key}>{c.emoji} {c.key}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Monto</label>
            <input className="input" type="number" min={0} value={f.amount}
              onChange={e => setF({ ...f, amount: e.target.value })} placeholder="0" required />
          </div>
          <div>
            <label className="label">Fecha</label>
            <input className="input" type="date" value={f.spent_on}
              onChange={e => setF({ ...f, spent_on: e.target.value })} />
          </div>
          <div>
            <label className="label">Comprobante (opcional)</label>
            <label className="btn-ghost cursor-pointer text-xs !py-2 !px-3 inline-flex items-center gap-2">
              {uploading ? '…' : (f.receipt_url ? '✓ Cargado' : '📎 Subir')}
              <input type="file" accept="image/*" className="hidden"
                onChange={async e => {
                  const file = e.target.files?.[0]; if (!file) return;
                  setUploading(true);
                  const url = await uploadImage(file, 'expenses');
                  setUploading(false);
                  if (url) setF({ ...f, receipt_url: url });
                }} />
            </label>
          </div>
        </div>
        <div>
          <label className="label">Detalle (opcional)</label>
          <input className="input" value={f.description}
            onChange={e => setF({ ...f, description: e.target.value })}
            placeholder="Ej: Factura EDESUR marzo · Sueldo Juan Pérez · Impuestos AFIP" />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input type="checkbox" checked={f.is_recurring}
              onChange={e => setF({ ...f, is_recurring: e.target.checked })} />
            🔁 Se repite cada mes
          </label>
          {f.is_recurring && (
            <div className="flex items-center gap-2">
              <span className="text-white/60 text-xs">Día del mes:</span>
              <input className="input !w-16 !py-1" type="number" min={1} max={28}
                value={f.recurring_day} onChange={e => setF({ ...f, recurring_day: e.target.value })}
                placeholder="1" />
            </div>
          )}
        </div>
        <button type="submit" disabled={saving} className="btn-ball">
          {saving ? 'Guardando…' : 'Registrar gasto'}
        </button>
        {msg && <p className={`text-sm ${msg.startsWith('✓') ? 'text-ball' : 'text-red-400'}`}>{msg}</p>}
      </form>

      {/* Lista de gastos */}
      <section className="mt-5 space-y-2">
        {loading ? <p className="text-white/50">Cargando…</p>
          : rows.length === 0 ? (
          <div className="card text-center py-8 text-white/50">Sin gastos en {mesLabel}.</div>
        ) : rows.map(r => (
          <div key={r.id} className="card !p-3 flex items-center gap-3">
            <span className="text-2xl">{CATEGORIAS.find(c => c.key === r.category)?.emoji ?? '·'}</span>
            <div className="flex-1 min-w-0">
              <p className="font-display font-bold truncate">{r.category}</p>
              <p className="text-white/50 text-xs truncate">
                {new Date(r.spent_on).toLocaleDateString('es-AR')}
                {r.description && ` · ${r.description}`}
                {r.is_recurring && ' · 🔁 recurrente'}
              </p>
            </div>
            <p className="font-display font-black text-red-300 shrink-0">−${r.amount.toLocaleString('es-AR')}</p>
            {r.receipt_url && (
              <a href={r.receipt_url} target="_blank" rel="noopener"
                className="text-ball text-xs font-bold shrink-0">📎</a>
            )}
            <button onClick={() => eliminar(r.id)} className="text-red-400 text-xs shrink-0">✕</button>
          </div>
        ))}
      </section>
    </main>
  );
}
