'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

// Clientes: historial, jugadores frecuentes, facturación y ocupación
export default function Clientes() {
  const [cx, setCx] = useState<any>(null);
  const [frecuentes, setFrecuentes] = useState<any[]>([]);
  const [historial, setHistorial] = useState<any[]>([]);
  const [meses, setMeses] = useState<{ mes: string; reservas: number; plata: number }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: complex } = await supabase.from('complexes').select('*, courts(id)').eq('owner_id', user!.id).single();
      setCx(complex);
      const courtIds = complex.courts.map((c: any) => c.id);

      const desde = new Date(); desde.setMonth(desde.getMonth() - 6);
      const { data: bks } = await supabase.from('bookings')
        .select('starts_at, price, type, status, guest_name, player:profiles!player_id(id, username, first_name, last_name, avatar_url, phone, category)')
        .in('court_id', courtIds).eq('type', 'reserva').neq('status', 'cancelada')
        .gte('starts_at', desde.toISOString())
        .order('starts_at', { ascending: false }).limit(2000);

      const list = bks ?? [];
      setHistorial(list.slice(0, 25));

      // Frecuentes: cuántas veces reservó cada jugador
      const map = new Map<string, any>();
      list.forEach((b: any) => {
        const key = b.player?.id ?? `guest:${b.guest_name}`;
        const prev = map.get(key);
        map.set(key, prev ? { ...prev, count: prev.count + 1 }
          : { player: b.player, guest: b.guest_name, count: 1 });
      });
      setFrecuentes(Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 10));

      // Facturación estimada por mes
      const mm = new Map<string, { reservas: number; plata: number }>();
      list.forEach((b: any) => {
        const k = new Date(b.starts_at).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
        const prev = mm.get(k) ?? { reservas: 0, plata: 0 };
        mm.set(k, { reservas: prev.reservas + 1, plata: prev.plata + Number(b.price ?? 0) });
      });
      setMeses(Array.from(mm.entries()).map(([mes, v]) => ({ mes, ...v })).slice(0, 6));
    })();
  }, []);

  const maxPlata = Math.max(1, ...meses.map(m => m.plata));

  if (!cx) return <main className="p-8 text-white/70">Cargando…</main>;

  return (
    <main className="px-5 py-6">
      <h1 className="font-display font-black text-xl">Clientes</h1>

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
          {frecuentes.map((f, i) => (
            <li key={i} className="flex items-center gap-3">
              {f.player?.avatar_url
                ? <img src={f.player.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                : <span className="w-9 h-9 rounded-full bg-court font-display font-black flex items-center justify-center">
                    {(f.player?.first_name ?? f.guest ?? '?')[0]}
                  </span>}
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">
                  {f.player ? `${f.player.first_name} ${f.player.last_name}` : `${f.guest ?? 'Invitado'} (manual)`}
                </p>
                {f.player && <p className="text-white/40 text-xs">{f.player.phone} · cat. {f.player.category}</p>}
              </div>
              <span className="font-display font-black text-ball">{f.count}</span>
            </li>
          ))}
          {frecuentes.length === 0 && <p className="text-white/40 text-sm">Todavía no hay reservas.</p>}
        </ul>
      </section>

      {/* Historial */}
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
    </main>
  );
}
