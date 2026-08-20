'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

// Clientes: jugadores del club con SALDO DE CUENTA CORRIENTE + historial + facturación.
export default function Clientes() {
  const [cx, setCx] = useState<any>(null);
  const [frecuentes, setFrecuentes] = useState<any[]>([]);
  const [balances, setBalances] = useState<Map<string, number>>(new Map());
  const [historial, setHistorial] = useState<any[]>([]);
  const [meses, setMeses] = useState<{ mes: string; reservas: number; plata: number }[]>([]);
  const [income, setIncome] = useState<{ efectivo: number; transferencia: number; mp: number }>({ efectivo: 0, transferencia: 0, mp: 0 });
  const [ledger, setLedger] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [days, setDays] = useState(30);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: complex } = await supabase.from('complexes').select('*, courts(id)').eq('owner_id', user!.id).single();
    setCx(complex);
    if (!complex) return;
    const courtIds = complex.courts.map((c: any) => c.id);

    const desde = new Date(); desde.setMonth(desde.getMonth() - 6);
    const { data: bks } = await supabase.from('bookings')
      .select('starts_at, price, type, status, guest_name, player:profiles!player_id(id, username, first_name, last_name, avatar_url, phone, category)')
      .in('court_id', courtIds).eq('type', 'reserva').neq('status', 'cancelada')
      .gte('starts_at', desde.toISOString())
      .order('starts_at', { ascending: false }).limit(2000);

    const list = bks ?? [];
    setHistorial(list.slice(0, 25));

    // Frecuentes
    const map = new Map<string, any>();
    list.forEach((b: any) => {
      const key = b.player?.id ?? `guest:${b.guest_name}`;
      const prev = map.get(key);
      map.set(key, prev ? { ...prev, count: prev.count + 1 }
        : { player: b.player, guest: b.guest_name, count: 1 });
    });
    const frecList = Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 20);
    setFrecuentes(frecList);

    // Facturación por mes
    const mm = new Map<string, { reservas: number; plata: number }>();
    list.forEach((b: any) => {
      const k = new Date(b.starts_at).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
      const prev = mm.get(k) ?? { reservas: 0, plata: 0 };
      mm.set(k, { reservas: prev.reservas + 1, plata: prev.plata + Number(b.price ?? 0) });
    });
    setMeses(Array.from(mm.entries()).map(([mes, v]) => ({ mes, ...v })).slice(0, 6));

    // Balances: primero, TODOS los jugadores con movimientos en el ledger de este
    // complejo (aunque no aparezcan en frecuentes porque su reserva fue cancelada).
    const { data: ledgerPlayers } = await supabase.from('player_ledger')
      .select('player_id')
      .eq('complex_id', complex.id);
    const uniquePids = Array.from(new Set((ledgerPlayers ?? []).map((r: any) => r.player_id)));

    // Agregar los que están en frecuentes también
    frecList.forEach(f => { if (f.player?.id) uniquePids.push(f.player.id); });
    const allPids = Array.from(new Set(uniquePids));

    // Traer perfiles de los que no están en frecuentes ya
    const missing = allPids.filter(pid => !frecList.some(f => f.player?.id === pid));
    if (missing.length > 0) {
      const { data: profs } = await supabase.from('profiles')
        .select('id, username, first_name, last_name, avatar_url, phone, category')
        .in('id', missing);
      (profs ?? []).forEach((p: any) => {
        frecList.push({ player: p, guest: null, count: 0 });
      });
      setFrecuentes([...frecList]);
    }

    // Consultar balance de cada uno
    const bmap = new Map<string, number>();
    for (const pid of allPids) {
      const { data } = await supabase.rpc('get_player_balance', {
        p_player_id: pid, p_complex_id: complex.id
      });
      bmap.set(pid, Number(data ?? 0));
    }
    setBalances(bmap);

    // Ingresos por método (últimos N días)
    const from = new Date(); from.setDate(from.getDate() - days);
    const { data: inc } = await supabase.rpc('get_complex_income_by_method', {
      p_complex_id: complex.id, p_from: from.toISOString(), p_to: new Date().toISOString()
    });
    const totals = { efectivo: 0, transferencia: 0, mp: 0 };
    (inc ?? []).forEach((r: any) => {
      if (r.method === 'efectivo') totals.efectivo = Number(r.total);
      if (r.method === 'transferencia') totals.transferencia = Number(r.total);
      if (r.method === 'mp') totals.mp = Number(r.total);
    });
    setIncome(totals);
  }

  useEffect(() => { load(); }, [days]); // eslint-disable-line

  async function abrirDetalle(f: any) {
    if (!f.player?.id) return;
    setSelected(f);
    setMsg('');
    const { data } = await supabase.from('player_ledger')
      .select('*, ref_booking:bookings(starts_at, court:courts(name))')
      .eq('player_id', f.player.id).eq('complex_id', cx.id)
      .order('created_at', { ascending: false }).limit(50);
    setLedger(data ?? []);
  }

  async function agregarMovimiento(kind: 'manual_credit' | 'manual_debit', method: string) {
    if (!selected?.player?.id) return;
    const amountStr = prompt(kind === 'manual_credit'
      ? `¿Cuánto sumás al saldo de ${selected.player.first_name}?`
      : `¿Cuánto le descontás del saldo a ${selected.player.first_name}?`);
    if (!amountStr) return;
    const amount = Number(amountStr.replace(',', '.'));
    if (!amount || amount <= 0) return alert('Monto inválido');
    const desc = prompt('Motivo/descripción (opcional):') ?? '';

    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('player_ledger').insert({
      player_id: selected.player.id,
      complex_id: cx.id,
      kind,
      amount: kind === 'manual_credit' ? amount : -amount,
      method,
      description: desc || null,
      created_by: user!.id
    });
    setBusy(false);
    if (error) return alert('Error: ' + error.message);
    setMsg('✓ Movimiento registrado.');
    await abrirDetalle(selected);
    load();
  }

  const maxPlata = Math.max(1, ...meses.map(m => m.plata));
  const totalIncome = income.efectivo + income.transferencia + income.mp;
  const conSaldo = Array.from(balances.entries()).filter(([, b]) => b !== 0);

  if (!cx) return <main className="p-8 text-white/70">Cargando…</main>;

  return (
    <main className="px-5 py-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-black text-xl">Clientes</h1>
        <select value={days} onChange={e => setDays(Number(e.target.value))}
          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs">
          <option value={7}>7 días</option>
          <option value={30}>30 días</option>
          <option value={90}>90 días</option>
        </select>
      </div>

      {/* Ingresos por método (contable) */}
      <section className="mt-4 grid grid-cols-3 gap-2">
        <div className="bg-white/5 rounded-2xl p-3 text-center">
          <p className="text-white/50 text-[10px] font-black uppercase">💵 Efectivo</p>
          <p className="font-display font-black text-lg text-white mt-1">${income.efectivo.toLocaleString('es-AR')}</p>
        </div>
        <div className="bg-white/5 rounded-2xl p-3 text-center">
          <p className="text-white/50 text-[10px] font-black uppercase">🏦 Transferencia</p>
          <p className="font-display font-black text-lg text-white mt-1">${income.transferencia.toLocaleString('es-AR')}</p>
        </div>
        <div className="bg-ball/10 border border-ball/30 rounded-2xl p-3 text-center">
          <p className="text-ball text-[10px] font-black uppercase">Total {days}d</p>
          <p className="font-display font-black text-lg text-ball mt-1">${totalIncome.toLocaleString('es-AR')}</p>
        </div>
      </section>

      {/* Clientes con saldo (favor/deuda) */}
      {conSaldo.length > 0 && (
        <section className="mt-4 bg-white/5 rounded-2xl p-4">
          <p className="font-display font-bold text-ball text-sm">💼 Cuentas con saldo</p>
          <p className="text-white/40 text-[11px] mb-3">Verde = a favor del jugador · Rojo = debe</p>
          <ul className="space-y-2">
            {conSaldo.map(([pid, bal]) => {
              const f = frecuentes.find(x => x.player?.id === pid);
              if (!f) return null;
              return (
                <li key={pid}>
                  <button onClick={() => abrirDetalle(f)} className="w-full flex items-center gap-3 text-left">
                    {f.player?.avatar_url
                      ? <img src={f.player.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                      : <span className="w-9 h-9 rounded-full bg-grafito font-display font-black flex items-center justify-center">
                          {(f.player?.first_name ?? '?')[0]}
                        </span>}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate text-sm">{f.player?.first_name} {f.player?.last_name}</p>
                      <p className="text-white/40 text-xs">{f.player?.phone}</p>
                    </div>
                    <span className={`font-display font-black text-sm ${bal > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {bal > 0 ? '+' : ''}${bal.toLocaleString('es-AR')}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Facturación por mes */}
      <section className="mt-4 bg-white/5 rounded-2xl p-4">
        <p className="font-display font-bold text-ball text-sm">Facturación estimada (últimos meses)</p>
        <div className="mt-3 flex items-end gap-2 h-32">
          {[...meses].reverse().map(m => (
            <div key={m.mes} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-white/60 font-bold">${(m.plata / 1000).toFixed(0)}k</span>
              <div className="w-full bg-ball rounded-t-lg" style={{ height: `${Math.max(6, m.plata / maxPlata * 90)}px` }} />
              <span className="text-[10px] text-white/40">{m.mes}</span>
            </div>
          ))}
          {meses.length === 0 && <p className="text-white/40 text-sm">Sin datos todavía.</p>}
        </div>
      </section>

      {/* Jugadores frecuentes */}
      <section className="mt-4 bg-white/5 rounded-2xl p-4">
        <p className="font-display font-bold text-ball text-sm">Jugadores frecuentes</p>
        <ul className="mt-3 space-y-2">
          {frecuentes.map((f, i) => {
            const bal = f.player?.id ? balances.get(f.player.id) ?? 0 : 0;
            return (
              <li key={i}>
                <button onClick={() => f.player?.id && abrirDetalle(f)}
                  disabled={!f.player?.id}
                  className="w-full flex items-center gap-3 text-left disabled:cursor-default">
                  {f.player?.avatar_url
                    ? <img src={f.player.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                    : <span className="w-9 h-9 rounded-full bg-grafito font-display font-black flex items-center justify-center">
                        {(f.player?.first_name ?? f.guest ?? '?')[0]}
                      </span>}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">
                      {f.player ? `${f.player.first_name} ${f.player.last_name}` : `${f.guest ?? 'Invitado'} (manual)`}
                    </p>
                    {f.player && <p className="text-white/40 text-xs">{f.player.phone} · cat. {f.player.category}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-display font-black text-ball text-sm">{f.count} rvs</p>
                    {bal !== 0 && (
                      <p className={`text-[11px] font-bold ${bal > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {bal > 0 ? '+' : ''}${bal.toLocaleString('es-AR')}
                      </p>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
          {frecuentes.length === 0 && <p className="text-white/40 text-sm">Todavía no hay reservas.</p>}
        </ul>
      </section>

      {/* Historial reservas */}
      <section className="mt-4 bg-white/5 rounded-2xl p-4">
        <p className="font-display font-bold text-ball text-sm">Últimas reservas</p>
        <ul className="mt-3 space-y-2 text-sm">
          {historial.map((b: any, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span className="truncate">
                {b.player ? `${b.player.first_name} ${b.player.last_name}` : b.guest_name ?? 'Manual'}
              </span>
              <span className="text-white/40 shrink-0">
                {new Date(b.starts_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' })} · ${Number(b.price ?? 0).toLocaleString('es-AR')}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Drawer detalle cliente */}
      {selected && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-end lg:items-center justify-center p-0 lg:p-6" onClick={() => setSelected(null)}>
          <div className="bg-[#0B0F16] border-2 border-white/15 w-full max-w-lg rounded-t-3xl lg:rounded-2xl max-h-[90dvh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                {selected.player?.avatar_url
                  ? <img src={selected.player.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                  : <span className="w-12 h-12 rounded-full bg-grafito font-display font-black flex items-center justify-center text-lg">
                      {selected.player.first_name[0]}
                    </span>}
                <div>
                  <p className="font-display font-black text-lg leading-tight">{selected.player.first_name} {selected.player.last_name}</p>
                  <p className="text-white/50 text-xs">{selected.player.phone}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="w-10 h-10 rounded-full bg-white/10 text-xl">✕</button>
            </div>

            <div className="p-5">
              <div className="bg-white/5 rounded-2xl p-4 text-center">
                <p className="text-white/50 text-xs font-black uppercase">Saldo actual</p>
                {(() => {
                  const bal = balances.get(selected.player.id) ?? 0;
                  return (
                    <p className={`font-display font-black text-3xl mt-1 ${bal > 0 ? 'text-emerald-400' : bal < 0 ? 'text-red-400' : 'text-white'}`}>
                      {bal > 0 ? '+' : ''}${bal.toLocaleString('es-AR')}
                    </p>
                  );
                })()}
              </div>

              <p className="text-white/60 text-xs mt-4 mb-2 font-bold uppercase">Registrar movimiento</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => agregarMovimiento('manual_credit', 'efectivo')} disabled={busy}
                  className="py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-sm font-black disabled:opacity-50">
                  ➕ Suma efectivo
                </button>
                <button onClick={() => agregarMovimiento('manual_credit', 'transferencia')} disabled={busy}
                  className="py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-sm font-black disabled:opacity-50">
                  ➕ Suma transf.
                </button>
                <button onClick={() => agregarMovimiento('manual_debit', 'efectivo')} disabled={busy}
                  className="py-3 rounded-xl bg-red-500/10 border border-red-500/40 text-red-300 text-sm font-black disabled:opacity-50">
                  ➖ Cobrar efectivo
                </button>
                <button onClick={() => agregarMovimiento('manual_debit', 'transferencia')} disabled={busy}
                  className="py-3 rounded-xl bg-red-500/10 border border-red-500/40 text-red-300 text-sm font-black disabled:opacity-50">
                  ➖ Cobrar transf.
                </button>
              </div>
              {msg && <p className="text-ball text-xs mt-2">{msg}</p>}

              <p className="text-white/60 text-xs mt-5 mb-2 font-bold uppercase">Historial</p>
              {ledger.length === 0 ? (
                <p className="text-white/40 text-sm text-center py-6">Sin movimientos aún.</p>
              ) : (
                <ul className="space-y-2">
                  {ledger.map(m => (
                    <li key={m.id} className="flex items-start gap-2 text-sm py-2 border-b border-white/5">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold">
                          {KIND_LABEL[m.kind as keyof typeof KIND_LABEL] ?? m.kind}
                          {m.method && <span className="text-white/50 text-xs ml-2">· {m.method}</span>}
                        </p>
                        {m.description && <p className="text-white/60 text-xs">{m.description}</p>}
                        <p className="text-white/40 text-[11px]">{new Date(m.created_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <span className={`font-display font-black shrink-0 ${Number(m.amount) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {Number(m.amount) > 0 ? '+' : ''}${Number(m.amount).toLocaleString('es-AR')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const KIND_LABEL = {
  'seña_paid': '💰 Seña pagada',
  'restante_paid': '✅ Restante cobrado',
  'refund': '↩️ Reembolso',
  'used_credit': '🪙 Usó saldo',
  'manual_credit': '➕ Crédito manual',
  'manual_debit': '➖ Débito manual'
};
