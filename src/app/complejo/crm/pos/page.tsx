'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import BackButton from '@/components/BackButton';
import PremiumGate from '@/components/PremiumGate';
import BarcodeScanner from '@/components/BarcodeScanner';

type Product = {
  id: string; name: string; price: number; stock: number;
  category: string | null; photo_url: string | null;
  is_service: boolean; active: boolean;
  sku: string | null; ean: string | null;
};

type Client = { id: string; name: string; phone: string | null; total_spent: number };

type CartItem = { product: Product; qty: number };

const PAYMENT_METHODS = [
  { key: 'efectivo', label: 'Efectivo', emoji: '💵' },
  { key: 'transferencia', label: 'Transferencia', emoji: '🏦' },
  { key: 'debito', label: 'Débito', emoji: '💳' },
  { key: 'credito', label: 'Crédito', emoji: '💳' },
  { key: 'mp', label: 'Mercado Pago', emoji: '📱' },
  { key: 'seña', label: 'Seña (parcial)', emoji: '⏱' }
];

export default function POS() {
  const [cx, setCx] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  const [payment, setPayment] = useState('efectivo');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const [flash, setFlash] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setLoading(false);
      const { data: complex } = await supabase.from('complexes').select('*').eq('owner_id', user.id).maybeSingle();
      setCx(complex);
      if (!complex?.is_premium) return setLoading(false);
      const [{ data: ps }, { data: cs }] = await Promise.all([
        supabase.from('pos_products').select('*').eq('complex_id', complex.id).eq('active', true).order('name'),
        supabase.from('pos_clients').select('id, name, phone, total_spent').eq('complex_id', complex.id).order('total_spent', { ascending: false })
      ]);
      setProducts((ps as any) ?? []);
      setClients((cs as any) ?? []);
      setLoading(false);
    })();
  }, []);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.ean && p.ean.includes(q))
    );
  }, [products, search]);

  // Busca un producto por EAN o SKU exacto y lo suma al carrito. Devuelve true si lo encontró.
  function tryScanCode(code: string): boolean {
    const trimmed = code.trim();
    if (!trimmed) return false;
    const found = products.find(p => p.ean === trimmed || p.sku === trimmed);
    if (found) {
      addToCart(found);
      setFlash(`✓ ${found.name} agregado`);
      setTimeout(() => setFlash(''), 1500);
      setSearch('');
      return true;
    }
    setFlash(`⚠️ No hay producto con código ${trimmed}`);
    setTimeout(() => setFlash(''), 2500);
    return false;
  }

  // Manejo del input: si detecta un código numérico y el usuario da Enter, matchea por EAN
  function handleSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const val = search.trim();
    // Si es todo dígitos (8+), asumimos EAN escaneado por lector USB
    if (/^\d{8,14}$/.test(val)) {
      tryScanCode(val);
      return;
    }
    // Sino: si hay UN solo producto filtrado, lo agrega
    if (filteredProducts.length === 1) {
      addToCart(filteredProducts[0]);
      setSearch('');
    }
  }

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients.slice(0, 20);
    const q = clientSearch.toLowerCase();
    return clients.filter(c => c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q));
  }, [clients, clientSearch]);

  const subtotal = cart.reduce((sum, i) => sum + i.qty * i.product.price, 0);
  // Descuento según forma de pago (config en Perfil del complejo)
  const discountPct = useMemo(() => {
    if (!cx) return 0;
    const map: Record<string, number> = {
      efectivo: Number(cx.pos_discount_efectivo) || 0,
      transferencia: Number(cx.pos_discount_transferencia) || 0,
      debito: Number(cx.pos_discount_debito) || 0,
      credito: Number(cx.pos_discount_credito) || 0,
      mp: Number(cx.pos_discount_mp) || 0
    };
    return map[payment] ?? 0;
  }, [cx, payment]);
  const discount = Math.round(subtotal * discountPct / 100);
  const total = Math.max(0, subtotal - discount);
  const pending = payment === 'seña' ? Math.max(0, total - (Number(paidAmount) || 0)) : 0;

  function addToCart(p: Product) {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === p.id);
      if (existing) {
        return prev.map(i => i.product.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { product: p, qty: 1 }];
    });
  }

  function changeQty(productId: string, delta: number) {
    setCart(prev => prev
      .map(i => i.product.id === productId ? { ...i, qty: Math.max(0, i.qty + delta) } : i)
      .filter(i => i.qty > 0)
    );
  }

  function removeItem(productId: string) {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  }

  async function checkout() {
    if (cart.length === 0) { setError('Agregá al menos un producto'); return; }
    setError(''); setProcessing(true);

    const paid = payment === 'seña' ? (Number(paidAmount) || 0) : total;
    const status = payment === 'seña' && paid < total ? 'pendiente' : 'completada';

    const { data: user } = await supabase.auth.getUser();
    const { data: sale, error: sErr } = await supabase.from('pos_sales').insert({
      complex_id: cx.id,
      client_id: selectedClient?.id ?? null,
      cashier_id: user.user?.id ?? null,
      subtotal,
      discount,
      total,
      payment_method: payment,
      paid_amount: paid,
      status,
      notes: notes.trim() || null
    }).select().single();

    if (sErr || !sale) {
      setError(`Error: ${sErr?.message}`); setProcessing(false); return;
    }

    // Insertar items
    const items = cart.map(i => ({
      sale_id: sale.id,
      product_id: i.product.id,
      product_name: i.product.name,
      qty: i.qty,
      unit_price: i.product.price,
      subtotal: i.qty * i.product.price
    }));
    const { error: iErr } = await supabase.from('pos_sale_items').insert(items);
    if (iErr) { setError(`Error items: ${iErr.message}`); setProcessing(false); return; }

    setLastSaleId(sale.id);
    setCart([]);
    setSelectedClient(null);
    setPaidAmount('');
    setNotes('');
    setProcessing(false);

    // Refrescar productos (para ver stock actualizado)
    const { data: ps } = await supabase.from('pos_products').select('*').eq('complex_id', cx.id).eq('active', true).order('name');
    setProducts((ps as any) ?? []);
  }

  if (loading) return <main className="p-8 text-white/60">Cargando…</main>;

  if (!cx?.is_premium) return (
    <main className="min-h-dvh p-6">
      <BackButton fallbackHref="/complejo/crm" label="CRM" />
      <h1 className="font-display font-black text-3xl mt-4 mb-6">Punto de venta</h1>
      <PremiumGate isPremium={false} feature="financial_reports"><div /></PremiumGate>
    </main>
  );

  return (
    <main className="min-h-dvh max-w-6xl mx-auto px-4 py-4">
      <BackButton fallbackHref="/complejo/crm" label="CRM" />

      {/* Ticket final después de vender */}
      {lastSaleId && (
        <div className="mt-4 card !p-5 border-2 border-ball bg-ball/10">
          <p className="font-display font-black text-2xl text-ball">✓ VENTA REGISTRADA</p>
          <p className="text-white/70 text-sm mt-2">Ticket #{lastSaleId.slice(0, 8)}</p>
          <button onClick={() => setLastSaleId(null)}
            className="mt-3 bg-ball text-courtdark font-black px-4 py-2 rounded-lg text-sm">
            Nueva venta
          </button>
          <Link href="/complejo/crm/ventas" className="ml-2 text-ball text-sm underline">Ver historial</Link>
        </div>
      )}

      <div className="mt-4 grid md:grid-cols-[1fr_400px] gap-4">
        {/* ==================== IZQUIERDA: PRODUCTOS ==================== */}
        <section>
          <div className="flex gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={handleSearchKey}
              autoFocus
              placeholder="🔍 Nombre, SKU o EAN (Enter para escaneo USB)"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-lg" />
            <button type="button" onClick={() => setScanOpen(true)}
              title="Escanear con cámara"
              className="bg-ball text-courtdark font-black px-4 rounded-lg text-2xl">📷</button>
          </div>
          {flash && (
            <p className={`mt-2 text-sm font-black ${flash.startsWith('✓') ? 'text-ball' : 'text-orange-300'}`}>{flash}</p>
          )}

          {products.length === 0 ? (
            <div className="mt-6 card !p-8 text-center text-white/50">
              Sin productos cargados. <Link href="/complejo/crm/productos" className="text-ball underline">Agregá el primero →</Link>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {filteredProducts.map(p => (
                <button key={p.id} onClick={() => addToCart(p)}
                  disabled={!p.is_service && p.stock <= 0}
                  className={`card !p-3 text-left hover:bg-white/10 active:scale-95 transition
                    ${!p.is_service && p.stock <= 0 ? 'opacity-40 cursor-not-allowed' : ''}`}>
                  {p.photo_url ? (
                    <img src={p.photo_url} alt="" className="w-full aspect-square rounded-lg object-cover mb-2" />
                  ) : (
                    <div className="w-full aspect-square rounded-lg bg-white/5 flex items-center justify-center text-3xl mb-2">📦</div>
                  )}
                  <p className="font-black text-sm truncate">{p.name}</p>
                  <p className="text-ball font-display font-black">${p.price.toLocaleString('es-AR')}</p>
                  {!p.is_service && (
                    <p className="text-white/40 text-[10px]">Stock: {p.stock}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ==================== DERECHA: CARRITO ==================== */}
        <aside className="md:sticky md:top-4 md:self-start">
          <div className="card !p-4">
            <p className="font-display font-black text-lg">🛒 Carrito ({cart.length})</p>

            {/* Cliente */}
            <div className="mt-3 pb-3 border-b border-white/10">
              {selectedClient ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <p className="font-bold text-sm">👤 {selectedClient.name}</p>
                    {selectedClient.phone && <p className="text-white/50 text-xs">{selectedClient.phone}</p>}
                  </div>
                  <button onClick={() => setSelectedClient(null)}
                    className="text-white/60 text-xs underline">Cambiar</button>
                </div>
              ) : (
                <button onClick={() => setShowClientPicker(true)}
                  className="w-full py-2 border border-dashed border-white/20 rounded-lg text-white/60 text-sm hover:bg-white/5">
                  + Elegir cliente (opcional)
                </button>
              )}
            </div>

            {/* Items */}
            <div className="mt-3 space-y-2 max-h-96 overflow-y-auto">
              {cart.length === 0 ? (
                <p className="text-white/40 text-center py-8 text-sm">Vacío. Agregá productos ←</p>
              ) : cart.map(i => (
                <div key={i.product.id} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{i.product.name}</p>
                    <p className="text-white/50 text-xs">${i.product.price.toLocaleString('es-AR')} × {i.qty}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => changeQty(i.product.id, -1)}
                      className="w-7 h-7 bg-white/10 rounded font-black">−</button>
                    <span className="w-6 text-center font-black">{i.qty}</span>
                    <button onClick={() => changeQty(i.product.id, +1)}
                      className="w-7 h-7 bg-white/10 rounded font-black">+</button>
                  </div>
                  <p className="w-20 text-right font-display font-black text-ball text-sm shrink-0">
                    ${(i.qty * i.product.price).toLocaleString('es-AR')}
                  </p>
                  <button onClick={() => removeItem(i.product.id)}
                    className="text-red-400 text-lg shrink-0">×</button>
                </div>
              ))}
            </div>

            {/* Totales */}
            {cart.length > 0 && (
              <>
                <div className="mt-4 pt-3 border-t border-white/10 space-y-1">
                  {discountPct > 0 && (
                    <>
                      <div className="flex justify-between text-sm text-white/60">
                        <span>Subtotal</span>
                        <span>${subtotal.toLocaleString('es-AR')}</span>
                      </div>
                      <div className="flex justify-between text-sm text-ball">
                        <span>Descuento {discountPct}%</span>
                        <span>−${discount.toLocaleString('es-AR')}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between items-baseline">
                    <span className="text-white/60 text-sm">Total</span>
                    <span className="font-display font-black text-3xl text-ball">${total.toLocaleString('es-AR')}</span>
                  </div>
                </div>

                {/* Método de pago */}
                <div className="mt-4">
                  <p className="text-white/60 text-xs font-black uppercase mb-2">Forma de pago</p>
                  <div className="grid grid-cols-2 gap-1">
                    {PAYMENT_METHODS.map(m => {
                      const off = cx ? ({
                        efectivo: Number(cx.pos_discount_efectivo) || 0,
                        transferencia: Number(cx.pos_discount_transferencia) || 0,
                        debito: Number(cx.pos_discount_debito) || 0,
                        credito: Number(cx.pos_discount_credito) || 0,
                        mp: Number(cx.pos_discount_mp) || 0
                      } as Record<string, number>)[m.key] ?? 0 : 0;
                      return (
                        <button key={m.key} onClick={() => setPayment(m.key)}
                          className={`text-xs font-bold py-2 rounded ${payment === m.key ? 'bg-ball text-courtdark' : 'bg-white/5 text-white/70'}`}>
                          {m.emoji} {m.label}{off > 0 && <span className="ml-1 text-[10px]">−{off}%</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {payment === 'seña' && (
                  <div className="mt-3">
                    <label className="block text-white/60 text-xs font-bold uppercase mb-1">Paga ahora</label>
                    <input type="number" min={0} max={total}
                      value={paidAmount} onChange={e => setPaidAmount(e.target.value)}
                      placeholder="0"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-black" />
                    {pending > 0 && (
                      <p className="text-orange-300 text-xs mt-1">Queda pendiente: ${pending.toLocaleString('es-AR')}</p>
                    )}
                  </div>
                )}

                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Notas (opcional)"
                  rows={2}
                  className="w-full mt-3 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs" />

                {error && <p className="text-red-400 text-sm mt-2">{error}</p>}

                <button onClick={checkout} disabled={processing}
                  className="w-full mt-3 bg-ball text-courtdark font-display font-black rounded-2xl py-4 text-lg disabled:opacity-50 active:scale-[0.98]">
                  {processing ? 'Procesando…' : `✓ COBRAR $${total.toLocaleString('es-AR')}`}
                </button>
              </>
            )}
          </div>
        </aside>
      </div>

      {/* Escáner de cámara */}
      <BarcodeScanner open={scanOpen} onClose={() => setScanOpen(false)}
        onDetected={code => { setScanOpen(false); tryScanCode(code); }} />

      {/* Client picker modal */}
      {showClientPicker && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4" onClick={() => setShowClientPicker(false)}>
          <div onClick={e => e.stopPropagation()}
            className="w-full max-w-md bg-[#0F141D] border-t-2 sm:border-2 border-ball rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[80dvh] flex flex-col">
            <div className="p-4 border-b border-white/10">
              <p className="font-display font-black text-lg">Elegí cliente</p>
              <input value={clientSearch} onChange={e => setClientSearch(e.target.value)}
                placeholder="🔍 Buscar..."
                className="w-full mt-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredClients.length === 0 ? (
                <p className="text-white/40 text-center py-8 text-sm">
                  Sin resultados. <Link href="/complejo/crm/clientes" className="text-ball underline">Crear cliente</Link>
                </p>
              ) : filteredClients.map(c => (
                <button key={c.id}
                  onClick={() => { setSelectedClient(c); setShowClientPicker(false); }}
                  className="w-full text-left p-3 rounded-lg hover:bg-white/5 flex items-center gap-3">
                  <span className="w-10 h-10 rounded-full bg-grafito text-ball font-black flex items-center justify-center">
                    {c.name[0]?.toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{c.name}</p>
                    {c.phone && <p className="text-white/50 text-xs">{c.phone}</p>}
                  </div>
                  <p className="text-ball text-sm font-black">${c.total_spent.toLocaleString('es-AR')}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
