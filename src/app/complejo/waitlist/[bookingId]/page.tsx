'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

// Gestión de lista de espera para un turno que se canceló.
// El complejo ve quiénes esperaban ese turno y puede aceptar a uno.
// Al aceptar → crea reserva nueva + WhatsApp pre-armado al jugador.
export default function WaitlistManager() {
  const params = useParams<{ bookingId: string }>();
  const search = useSearchParams();
  const wlHighlight = search?.get('wl');
  const router = useRouter();

  const [booking, setBooking] = useState<any>(null);
  const [waitlist, setWaitlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data: bk } = await supabase.from('bookings')
      .select(`id, court_id, starts_at, ends_at, status,
        court:courts(name, price_per_slot, complex:complexes(id, name, owner_id))`)
      .eq('id', params.bookingId).maybeSingle();
    setBooking(bk);

    if (bk) {
      const { data: wl } = await supabase.from('booking_waitlist')
        .select(`id, player_id, created_at, notified_at, fulfilled_at,
          player:profiles!player_id(first_name, last_name, phone, avatar_url, username)`)
        .eq('court_id', (bk as any).court_id)
        .eq('starts_at', (bk as any).starts_at)
        .order('created_at');
      setWaitlist(wl ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function aceptar(wl: any) {
    if (!booking) return;
    if (!confirm(`¿Asignar el turno a ${wl.player?.first_name}? Se crea la reserva y se le abre WhatsApp para avisarle.`)) return;
    setProcessing(wl.id);
    try {
      // 1) Crear la reserva nueva confirmada
      const { data: newBk, error: bErr } = await supabase.from('bookings').insert({
        court_id: booking.court_id,
        player_id: wl.player_id,
        starts_at: booking.starts_at,
        ends_at: booking.ends_at,
        status: 'confirmada',
        payment_status: 'pendiente',
        type: 'reserva',
        price: booking.court.price_per_slot
      }).select().single();
      if (bErr) throw bErr;

      // 2) Marcar el waitlist como fulfilled
      await supabase.from('booking_waitlist').update({
        fulfilled_at: new Date().toISOString(),
        booking_id: newBk.id
      }).eq('id', wl.id);

      // 3) WhatsApp
      const when = new Date(booking.starts_at).toLocaleString('es-AR', {
        weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
      });
      const phone = (wl.player?.phone ?? '').replace(/\D/g, '');
      const msg = encodeURIComponent(
        `Hola ${wl.player?.first_name}! Estabas en lista de espera para ${booking.court.name} el ${when} hs. Aceptamos tu reserva porque se cayó la anterior. ¿Confirmás que vas a jugar?`
      );
      if (phone) window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');

      setMsg('✓ Turno asignado. Se abrió WhatsApp con el mensaje.');
      load();
    } catch (e: any) {
      setMsg('❌ ' + (e.message ?? 'error'));
    } finally { setProcessing(null); }
  }

  async function borrarDeLista(wl: any) {
    if (!confirm(`¿Sacar a ${wl.player?.first_name} de la lista de espera?`)) return;
    await supabase.from('booking_waitlist').delete().eq('id', wl.id);
    load();
  }

  if (loading) return <main className="p-8 text-white/60">Cargando…</main>;
  if (!booking) return <main className="p-8 text-red-400">Reserva no encontrada.</main>;

  const when = new Date(booking.starts_at).toLocaleString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
  });
  const pendientes = waitlist.filter(w => !w.fulfilled_at);
  const yaAsignado = waitlist.find(w => w.fulfilled_at);

  return (
    <main className="min-h-dvh max-w-2xl mx-auto px-5 py-6">
      <Link href="/complejo/dashboard" className="text-white/60 text-sm">← Volver</Link>
      <h1 className="font-display font-black text-2xl mt-3">🔄 Lista de espera</h1>
      <p className="text-white/60 text-sm mt-1">
        Se canceló <b>{booking.court.name}</b> del {when} hs.
      </p>

      {msg && <p className={`mt-3 text-sm ${msg.startsWith('✓') ? 'text-ball' : 'text-red-400'}`}>{msg}</p>}

      {yaAsignado && (
        <div className="mt-4 rounded-2xl bg-ball/10 border border-ball/40 p-4">
          <p className="text-ball font-black text-sm">✓ Turno ya asignado a {yaAsignado.player?.first_name} {yaAsignado.player?.last_name}</p>
        </div>
      )}

      {pendientes.length === 0 ? (
        <div className="card mt-5 text-center py-6 text-white/50">
          Nadie más en lista de espera.
        </div>
      ) : (
        <section className="mt-5 space-y-3">
          {pendientes.map((w, i) => (
            <div key={w.id}
              className={`card !p-4 ${w.id === wlHighlight ? 'ring-2 ring-ball' : ''}`}>
              <div className="flex items-center gap-3">
                {w.player?.avatar_url
                  ? <img src={w.player.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                  : <span className="w-12 h-12 rounded-full bg-court flex items-center justify-center font-black text-sm">
                      {w.player?.first_name?.[0] ?? '?'}
                    </span>}
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold truncate">
                    {i === 0 && <span className="text-ball">#1 </span>}
                    {w.player?.first_name} {w.player?.last_name}
                  </p>
                  <p className="text-white/50 text-xs truncate">
                    @{w.player?.username} {w.player?.phone && ` · ${w.player.phone}`}
                  </p>
                  <p className="text-white/40 text-[11px]">
                    Se anotó {new Date(w.created_at).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => aceptar(w)} disabled={processing === w.id}
                  className="flex-1 py-3 rounded-xl bg-ball text-courtdark font-black text-sm disabled:opacity-50">
                  {processing === w.id ? 'Procesando…' : '✓ Asignar y avisar por WhatsApp'}
                </button>
                <button onClick={() => borrarDeLista(w)}
                  className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm font-bold">
                  ✕
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
