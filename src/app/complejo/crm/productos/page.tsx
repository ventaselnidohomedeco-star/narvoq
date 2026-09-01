'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import BackButton from '@/components/BackButton';
import PremiumGate from '@/components/PremiumGate';
import { uploadImage } from '@/lib/upload';
import { parseCsv } from '@/lib/csv';
import { downloadXls, parseXlsxFile } from '@/lib/xls';

type Product = {
  id: string;
  complex_id: string;
  name: string;
  category: string | null;
  price: number;
  cost: number;
  stock: number;
  min_stock: number;
  sku: string | null;
  ean: string | null;
  photo_url: string | null;
  active: boolean;
  is_service: boolean;
};

const CATEGORIAS = ['Bebida', 'Snack', 'Indumentaria', 'Accesorio', 'Paleta', 'Pelota', 'Servicio', 'Otro'];

export default function ProductosPage() {
  const [cx, setCx] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [importing, setImporting] = useState(false);

  // Columnas en castellano, fáciles de entender
  const CSV_COLS = ['Nombre', 'Categoria', 'Precio venta', 'Precio costo', 'Stock', 'Alerta stock bajo', 'Codigo interno (SKU)', 'Codigo de barras (EAN)', 'Es servicio (SI/NO)'];

  function exportXls() {
    const rows: (string | number)[][] = products.map(p => [
      p.name,
      p.category ?? '',
      p.price,
      p.cost,
      p.stock,
      p.min_stock,
      p.sku ?? '',
      p.ean ?? '',
      p.is_service ? 'SI' : 'NO'
    ]);
    downloadXls(`productos-${new Date().toISOString().slice(0, 10)}.xls`, CSV_COLS, rows);
  }

  function downloadTemplate() {
    // Archivo Excel real (.xls) con títulos en negrita y fondo verde de NarvoQ.
    // Excel lo abre nativo. La fila-guía queda en amarillo suave, se ignora al importar.
    const rows: (string | number)[][] = [
      [
        '👉 EJEMPLO — borrá esta fila antes de importar',
        'Bebida / Snack / Paleta / Pelota / Servicio / Otro',
        'Cuánto lo vendés (solo número)',
        'Cuánto te cuesta (opcional)',
        'Cuántos tenés hoy',
        'Avisar cuando quedan menos de X',
        'Opcional — tu código interno',
        'Opcional — número del código de barras',
        'SI o NO'
      ],
      ['Coca-Cola 500ml', 'Bebida', 1200, 700, 24, 6, 'COCA500', '7790895000133', 'NO'],
      ['Cerveza Quilmes 473ml', 'Bebida', 1800, 1100, 36, 12, '', '', 'NO'],
      ['Sándwich de miga (x3)', 'Snack', 2500, 1200, 10, 3, '', '', 'NO'],
      ['Tubo de pelotas Head', 'Pelota', 8500, 5500, 8, 2, '', '', 'NO'],
      ['Alquiler de paleta', 'Servicio', 2000, 0, 0, 0, '', '', 'SI']
    ];
    downloadXls('plantilla-productos.xls', CSV_COLS, rows);
  }

  // Devuelve el valor de la fila probando varios nombres de columna posibles
  function pick(row: Record<string, string>, ...keys: string[]): string {
    for (const k of keys) {
      const found = Object.keys(row).find(rk => rk.toLowerCase().trim() === k.toLowerCase().trim());
      if (found && row[found]) return row[found];
    }
    return '';
  }

  async function importCsv(file: File) {
    setImporting(true); setImportMsg('Leyendo archivo…');
    try {
      const isXlsx = /\.(xlsx|xls)$/i.test(file.name);
      const rows = isXlsx ? await parseXlsxFile(file) : parseCsv(await file.text());
      if (rows.length === 0) { setImportMsg('❌ Archivo vacío o sin filas válidas'); setImporting(false); return; }

      const toInsert = rows.map(r => ({
        complex_id: cx.id,
        name: pick(r, 'Nombre', 'name', 'Producto').trim(),
        category: pick(r, 'Categoria', 'Categoría', 'category').trim() || null,
        price: Number(pick(r, 'Precio venta', 'Precio', 'price')) || 0,
        cost: Number(pick(r, 'Precio costo', 'Costo', 'cost')) || 0,
        stock: Number(pick(r, 'Stock', 'stock')) || 0,
        min_stock: Number(pick(r, 'Alerta stock bajo', 'Min stock', 'min_stock')) || 0,
        sku: pick(r, 'Codigo interno (SKU)', 'SKU', 'Codigo interno', 'sku').trim() || null,
        ean: pick(r, 'Codigo de barras (EAN)', 'EAN', 'Codigo de barras', 'ean').trim() || null,
        is_service: ['si', 'sí', 'true', '1', 'yes', 'servicio'].includes(pick(r, 'Es servicio (SI/NO)', 'Es servicio', 'Servicio', 'is_service').toLowerCase()),
        active: true
      })).filter(r => r.name && !r.name.startsWith('👉'));  // saltea la fila-guía

      if (toInsert.length === 0) { setImportMsg('❌ No hay filas con Nombre. Revisá la plantilla.'); setImporting(false); return; }
      const { error } = await supabase.from('pos_products').insert(toInsert);
      if (error) { setImportMsg('❌ ' + error.message); setImporting(false); return; }
      setImportMsg(`✓ Importados ${toInsert.length} productos`);
      await load(cx.id);
    } catch (e: any) {
      setImportMsg('❌ ' + (e?.message ?? 'error desconocido'));
    }
    setImporting(false);
  }

  async function load(complexId?: string) {
    setLoading(true);
    const cid = complexId ?? cx?.id;
    if (!cid) return setLoading(false);
    const { data } = await supabase.from('pos_products')
      .select('*').eq('complex_id', cid).order('name');
    setProducts((data as any) ?? []);
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
    return products.filter(p => {
      if (filterCat && p.category !== filterCat) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.ean && p.ean.includes(q));
      }
      return true;
    });
  }, [products, search, filterCat]);

  if (loading) return <main className="p-8 text-white/60">Cargando…</main>;

  if (!cx?.is_premium) return (
    <main className="min-h-dvh p-6">
      <BackButton fallbackHref="/complejo/crm" label="CRM" />
      <h1 className="font-display font-black text-3xl mt-4 mb-6">Productos</h1>
      <PremiumGate isPremium={false} feature="financial_reports"><div /></PremiumGate>
    </main>
  );

  return (
    <main className="min-h-dvh max-w-5xl mx-auto px-5 py-6">
      <BackButton fallbackHref="/complejo/crm" label="CRM" />
      <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-black text-3xl">Productos ({products.length})</h1>
          <p className="text-white/50 text-sm mt-1">ABM de productos, stock y precios</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={downloadTemplate}
            className="bg-white/10 text-white/80 border border-white/20 font-black px-3 py-2 rounded-lg text-xs">
            📄 Plantilla Excel
          </button>
          <button onClick={exportXls}
            className="bg-white/10 text-white/80 border border-white/20 font-black px-3 py-2 rounded-lg text-xs">
            ⬇ Exportar Excel
          </button>
          <label className="bg-white/10 text-white/80 border border-white/20 font-black px-3 py-2 rounded-lg text-xs cursor-pointer">
            {importing ? '⏳ Importando…' : '⬆ Importar Excel'}
            <input type="file" accept=".xls,.xlsx,.csv,text/csv,application/vnd.ms-excel" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ''; }} />
          </label>
          <button onClick={() => { setCreating(true); setEditing(null); }}
            className="bg-ball text-courtdark font-black px-4 py-2 rounded-lg text-sm">
            + Nuevo producto
          </button>
        </div>
      </div>
      {importMsg && (
        <p className={`mt-2 text-sm font-black ${importMsg.startsWith('✓') ? 'text-ball' : 'text-orange-300'}`}>{importMsg}</p>
      )}

      {/* Filtros */}
      <section className="mt-4 flex flex-wrap gap-2">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Buscar por nombre, SKU o EAN…"
          className="flex-1 min-w-[200px] bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </section>

      {/* Lista */}
      <section className="mt-5 space-y-2">
        {filtered.length === 0 ? (
          <div className="card !p-8 text-center text-white/50">
            {products.length === 0 ? 'Todavía no cargaste productos. Empezá creando el primero →' : 'Sin resultados con esos filtros.'}
          </div>
        ) : filtered.map(p => (
          <div key={p.id} className={`card !p-3 flex items-center gap-3 ${!p.active ? 'opacity-40' : ''}`}>
            {p.photo_url ? (
              <img src={p.photo_url} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-white/5 flex items-center justify-center text-2xl shrink-0">📦</div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-display font-black truncate">{p.name}</p>
              <p className="text-white/50 text-xs truncate">
                {p.category ?? 'Sin categoría'}
                {p.sku && ` · SKU ${p.sku}`}
                {p.ean && ` · EAN ${p.ean}`}
              </p>
              <p className="text-white/70 text-xs mt-0.5">
                Stock: <b className={p.stock <= p.min_stock ? 'text-orange-300' : 'text-white'}>{p.stock}</b>
                {p.is_service && ' · servicio'}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-display font-black text-ball text-lg">${p.price.toLocaleString('es-AR')}</p>
              {p.cost > 0 && (
                <p className="text-white/40 text-[10px]">costo ${p.cost.toLocaleString('es-AR')}</p>
              )}
            </div>
            <button onClick={() => { setEditing(p); setCreating(false); }}
              className="ml-2 bg-white/10 text-xs px-3 py-2 rounded-lg font-black">
              Editar
            </button>
          </div>
        ))}
      </section>

      {/* Modal Editor */}
      {(editing || creating) && cx && (
        <ProductEditor
          complexId={cx.id}
          product={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); load(); }}
        />
      )}
    </main>
  );
}

function ProductEditor({ complexId, product, onClose, onSaved }: {
  complexId: string;
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState<any>(product ?? {
    name: '', category: 'Bebida', price: 0, cost: 0,
    stock: 0, min_stock: 0, sku: '', ean: '', photo_url: '',
    active: true, is_service: false
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setError(''); setSaving(true);
    if (!f.name.trim()) { setError('Nombre requerido'); setSaving(false); return; }

    const payload = {
      complex_id: complexId,
      name: f.name.trim(),
      category: f.category || null,
      price: Number(f.price) || 0,
      cost: Number(f.cost) || 0,
      stock: Number(f.stock) || 0,
      min_stock: Number(f.min_stock) || 0,
      sku: f.sku?.trim() || null,
      ean: f.ean?.trim() || null,
      photo_url: f.photo_url || null,
      active: f.active !== false,
      is_service: !!f.is_service
    };

    const q = product
      ? supabase.from('pos_products').update(payload).eq('id', product.id)
      : supabase.from('pos_products').insert(payload);
    const { error: err } = await q;
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
  }

  async function del() {
    if (!product) return;
    if (!confirm(`¿Borrar "${product.name}"?`)) return;
    await supabase.from('pos_products').delete().eq('id', product.id);
    onSaved();
  }

  async function uploadPhoto(file: File | null) {
    if (!file) return;
    const url = await uploadImage(file, 'pos-products');
    if (url) setF({ ...f, photo_url: url });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="w-full max-w-lg bg-[#0F141D] border-t-2 sm:border-2 border-ball rounded-t-3xl sm:rounded-3xl overflow-y-auto max-h-[92dvh]">
        <div className="p-5 sticky top-0 bg-[#0F141D] border-b border-white/10">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-black text-xl">{product ? 'Editar producto' : 'Nuevo producto'}</h3>
            <button onClick={onClose} className="text-white/60 text-xl w-10 h-10">✕</button>
          </div>
        </div>

        <div className="p-5 space-y-3">
          {/* Foto */}
          <label className="block">
            <span className="text-white/60 text-xs font-bold uppercase">Foto</span>
            <div className="mt-1 flex items-center gap-3">
              {f.photo_url ? (
                <img src={f.photo_url} alt="" className="w-20 h-20 rounded-lg object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-lg bg-white/5 flex items-center justify-center text-3xl">📦</div>
              )}
              <input type="file" accept="image/*"
                onChange={e => uploadPhoto(e.target.files?.[0] ?? null)}
                className="text-white/70 text-xs" />
            </div>
          </label>

          <label className="block">
            <span className="text-white/60 text-xs font-bold uppercase">Nombre *</span>
            <input value={f.name} onChange={e => setF({ ...f, name: e.target.value })}
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white" />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-white/60 text-xs font-bold uppercase">Categoría</span>
              <select value={f.category ?? ''} onChange={e => setF({ ...f, category: e.target.value })}
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white">
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 pt-6">
              <input type="checkbox" checked={f.is_service} onChange={e => setF({ ...f, is_service: e.target.checked })}
                className="w-5 h-5 accent-ball" />
              <span className="text-sm">Es servicio (no descuenta stock)</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-white/60 text-xs font-bold uppercase">Precio venta *</span>
              <input type="number" min={0} value={f.price} onChange={e => setF({ ...f, price: e.target.value })}
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-black" />
            </label>
            <label className="block">
              <span className="text-white/60 text-xs font-bold uppercase">Costo</span>
              <input type="number" min={0} value={f.cost} onChange={e => setF({ ...f, cost: e.target.value })}
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white" />
            </label>
          </div>

          {!f.is_service && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-white/60 text-xs font-bold uppercase">Stock actual</span>
                <input type="number" value={f.stock} onChange={e => setF({ ...f, stock: e.target.value })}
                  className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white" />
              </label>
              <label className="block">
                <span className="text-white/60 text-xs font-bold uppercase">Alerta stock bajo</span>
                <input type="number" value={f.min_stock} onChange={e => setF({ ...f, min_stock: e.target.value })}
                  className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white" />
              </label>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-white/60 text-xs font-bold uppercase">SKU (interno)</span>
              <input value={f.sku ?? ''} onChange={e => setF({ ...f, sku: e.target.value })}
                placeholder="Auto o manual"
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
            </label>
            <label className="block">
              <span className="text-white/60 text-xs font-bold uppercase">EAN (código barras)</span>
              <input value={f.ean ?? ''} onChange={e => setF({ ...f, ean: e.target.value })}
                placeholder="Escaneable en fase 3"
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
            </label>
          </div>

          {f.cost > 0 && f.price > 0 && (
            <p className="text-white/50 text-xs">
              Margen: <b className="text-ball">
                {(((f.price - f.cost) / f.price) * 100).toFixed(0)}%
              </b> · Ganancia por unidad: ${(f.price - f.cost).toLocaleString('es-AR')}
            </p>
          )}

          <label className="flex items-center gap-2 pt-2">
            <input type="checkbox" checked={f.active !== false} onChange={e => setF({ ...f, active: e.target.checked })}
              className="w-5 h-5 accent-ball" />
            <span className="text-sm">Producto activo (visible en el POS)</span>
          </label>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        <div className="p-5 sticky bottom-0 bg-[#0F141D] border-t border-white/10 flex gap-2">
          {product && (
            <button onClick={del}
              className="flex-1 bg-red-500/15 border border-red-500/40 text-red-300 font-black rounded-lg py-3 text-sm">
              🗑 Borrar
            </button>
          )}
          <button onClick={save} disabled={saving}
            className="flex-1 bg-ball text-courtdark font-black rounded-lg py-3 disabled:opacity-50">
            {saving ? 'Guardando…' : product ? 'Guardar cambios' : 'Crear producto'}
          </button>
        </div>
      </div>
    </div>
  );
}
