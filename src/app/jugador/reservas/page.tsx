'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

export default function Reservas() {
  const [tab, setTab] = useState<'proximas' | 'cargar'>('proximas');
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [toLoad, setToLoad] = useState<any[]>([]);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: mp } = await supabase.from('match_players')
      .select(`match:matches(id, status,
        booking:bookings(id, starts_at, ends_at, price, status, payment_status, payment_proof_url,
          court:courts(name, photo_url, complex:complexes(name, address, cancel_hours))),
        result:results(id, status))`)
      .eq('player_id', user.id).limit(100);

    const matches = (mp ?? []).map((r: any) => r.match).filter((m: any) => m?.booking);
    const now = new Date();
    setUpcoming(matches
      .filter((m: any) => new Date(m.booking.starts_at) > now && m.booking.status !== 'cancelada')
      .sort((a: any, b: any) => a.booking.starts_at.localeCompare(b.booking.starts_at)));
    setToLoad(matches
      .filter((m: any) => new Date(m.booking.ends_at ?? m.booking.starts_at) < now
        && m.booking.status !== 'cancelada'
        && m.booking.payment_status === 'pagado'
        && (!m.result || m.result.length === 0))
      .sort((a: any, b: any) => b.booking.starts_at.localeCompare(a.booking.starts_at)));
  }
  useEffect(() => { load(); }, []);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('es-AR', { weekday: 'long', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });

  async function cancelar(m: any, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    const horas = (new Date(m.booking.starts_at).getTime() - Date.now()) / 3600000;
    const limite = m.booking.court.complex.cancel_hours ?? 0;
    if (horas < limite)
      return alert(`Este complejo solo permite cancelar hasta ${limite} hs antes del turno. Comunicate directamente con el complejo.`);
    if (!confirm('Cancelar esta reserva? El turno queda libre para otros jugadores.')) return;
    await supabase.from('bookings').update({ status: 'cancelada' }).eq('id', m.booking.id);
    await supabase.from('matches').update({ status: 'cancelada' }).eq('id', m.id);
    setUpcoming(upcoming.filter((x: any) => x.id !== m.id));
  }

  const paymentText = (b: any) => b.payment_status === 'pagado'
    ? 'Pago confirmado'
    : b.payment_proof_url ? 'Comprobante en revision' : 'Pago pendiente';

  const Card = ({ m, cta, cancelable }: any) => (
    <Link href={`/partido/${m.id}`} className="card !p-0 overflow-hidden flex">
      {m.booking.court.photo_url
        ? <img src={m.booking.court.photo_url} alt="" className="w-24 object-cover shrink-0" />
        : <span className="w-24 bg-grafito/10 flex items-center justify-center text-2xl shrink-0">PA</span>}
      <div className="p-3 flex-1 min-w-0">
        <p className="font-display font-bold truncate">{m.booking.court.complex.name}</p>
        <p className="text-white/50 text-sm">{m.booking.court.name} - {fmt(m.booking.starts_at)} hs</p>
        <p className={`text-xs font-black mt-1 ${m.booking.payment_status === 'pagado' ? 'text-green-400' : m.booking.payment_proof_url ? 'text-yellow-300' : 'text-red-300'}`}>
          {paymentText(m.booking)}
        </p>
        <p className="text-ball text-sm font-bold mt-1">{cta}</p>
        {cancelable && (
          <button onClick={e => cancelar(m, e)}
            className="mt-1 text-xs font-bold text-red-500">Cancelar reserva</button>
        )}
      </div>
    </Link>
  );

  return (
    <main className="px-5 pt-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-black text-2xl">Reservas</h1>
        <Link href="/jugador/reservar" className="btn-ball text-sm">+ Nueva reserva</Link>
      </div>

      <div className="mt-4 flex gap-2">
        {[
          { k: 'proximas', l: `Próximas (${upcoming.length})` },
          { k: 'cargar', l: `Cargar resultado (${toLoad.length})` }
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as any)}
            className={`px-4 py-2 rounded-xl text-sm font-black transition
              ${tab === t.k
                ? 'bg-[#2A2E36] text-ball ring-1 ring-ball/40'
                : 'bg-[#1A1D24] text-white/50 border border-white/10'}`}>
            {t.l}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3 pb-8">
        {tab === 'proximas' && (upcoming.length
          ? upcoming.map(m => <Card key={m.id} m={m} cta="Ver partido e invitar" cancelable />)
          : <div className="card text-center py-10">
              <p className="text-white/50 mt-2">No tenes reservas proximas.</p>
              <Link href="/jugador/reservar" className="btn-ball inline-block mt-3">Reservar cancha</Link>
            </div>)}
        {tab === 'cargar' && (toLoad.length
          ? toLoad.map(m => <Card key={m.id} m={m} cta="Cargar resultado" />)
          : <div className="card text-center py-10">
              <p className="text-white/50 mt-2">No tenes resultados pendientes de cargar.</p>
            </div>)}
      </div>
    </main>
  );
}
