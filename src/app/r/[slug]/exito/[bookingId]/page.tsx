'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

export default function ReservaExito() {
  const { slug, bookingId } = useParams<{ slug: string; bookingId: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: b } = await supabase.from('bookings')
        .select(`
          id, starts_at, ends_at, price, status, guest_name, guest_phone,
          court:courts(name, complex:complexes(name, whatsapp, phone, address, auto_confirm_bookings))
        `)
        .eq('id', bookingId).maybeSingle();
      setData(b);
      setLoading(false);
    })();
  }, [bookingId]);

  if (loading) return <main className="min-h-dvh flex items-center justify-center text-white/60">Cargando…</main>;
  if (!data) return (
    <main className="min-h-dvh flex flex-col items-center justify-center text-center px-8">
      <p className="text-6xl mb-4">🎾</p>
      <p className="text-xl font-black">Reserva no encontrada</p>
      <Link href={`/r/${slug}`} className="mt-6 text-ball font-black">← Volver</Link>
    </main>
  );

  const cx = data.court?.complex;
  const start = new Date(data.starts_at);
  const fechaFmt = start.toLocaleString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false });
  const waNum = (cx?.whatsapp || cx?.phone || '').replace(/\D/g, '');
  const waText = encodeURIComponent(
    `Hola! Soy ${data.guest_name}. Acabo de reservar por NarvoQ:\n\n` +
    `📅 ${fechaFmt} hs\n` +
    `🎾 ${data.court.name} - ${cx?.name}\n` +
    (data.price ? `💰 $${Number(data.price).toLocaleString('es-AR')}\n` : '') +
    `\n¿Me confirmás? ¡Gracias!`
  );
  const waLink = waNum ? `https://wa.me/${waNum.startsWith('54') ? waNum : '54' + waNum}?text=${waText}` : null;

  const confirmada = data.status === 'confirmada';

  return (
    <main className="min-h-dvh max-w-md mx-auto px-5 pt-8 pb-16 text-white">
      {/* Big check */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-ball/15 border-2 border-ball">
          <span className="text-5xl">{confirmada ? '✅' : '⏳'}</span>
        </div>
        <h1 className="font-display font-black text-3xl mt-4">
          {confirmada ? '¡Reserva confirmada!' : '¡Reserva enviada!'}
        </h1>
        <p className="text-white/60 mt-2">
          {confirmada
            ? 'El complejo ya tiene tu turno bloqueado.'
            : 'El complejo va a confirmar en breve. Avisale por WhatsApp para asegurar el turno.'}
        </p>
      </div>

      {/* Detalle */}
      <div className="mt-6 rounded-2xl bg-white/5 border border-white/10 p-5 space-y-3">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🎾</span>
          <div>
            <p className="text-white/50 text-xs font-black uppercase">Cancha</p>
            <p className="font-black">{data.court.name} · {cx?.name}</p>
            <p className="text-white/60 text-sm">📍 {cx?.address}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-2xl">📅</span>
          <div>
            <p className="text-white/50 text-xs font-black uppercase">Fecha y hora</p>
            <p className="font-black capitalize">{fechaFmt} hs</p>
          </div>
        </div>
        {data.price > 0 && (
          <div className="flex items-start gap-3">
            <span className="text-2xl">💰</span>
            <div>
              <p className="text-white/50 text-xs font-black uppercase">Precio</p>
              <p className="font-black text-ball">${Number(data.price).toLocaleString('es-AR')}</p>
              <p className="text-white/50 text-xs">Se paga en el complejo</p>
            </div>
          </div>
        )}
        <div className="flex items-start gap-3">
          <span className="text-2xl">👤</span>
          <div>
            <p className="text-white/50 text-xs font-black uppercase">A nombre de</p>
            <p className="font-black">{data.guest_name}</p>
            <p className="text-white/60 text-sm">📱 {data.guest_phone}</p>
          </div>
        </div>
      </div>

      {/* Botón WhatsApp destacado */}
      {waLink && (
        <a href={waLink} target="_blank" rel="noopener"
          className="mt-6 flex items-center justify-center gap-3 w-full py-5 rounded-2xl bg-[#25D366] text-white font-black text-lg active:scale-95 transition shadow-lg shadow-[#25D366]/20">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
          </svg>
          Enviar WhatsApp al complejo
        </a>
      )}

      <p className="text-white/40 text-xs text-center mt-3">
        Se abre WhatsApp con el mensaje listo. Solo tocás Enviar.
      </p>

      {/* Banner NarvoQ suave */}
      <div className="mt-10 rounded-2xl bg-gradient-to-br from-ball/10 to-transparent border border-ball/20 p-5">
        <p className="text-ball text-[11px] font-black tracking-widest">GRATIS · SIN DESCARGAR NADA</p>
        <p className="font-display font-black text-lg mt-1">Crearte una cuenta desbloquea:</p>
        <ul className="mt-3 text-sm text-white/80 space-y-1.5">
          <li>🎾 Ver tu historial de reservas</li>
          <li>👥 Buscar compañeros para jugar</li>
          <li>🏆 Sumar puntos al ranking</li>
          <li>💬 Chatear con otros jugadores</li>
          <li>🏆 Anotarte a torneos</li>
        </ul>
        <Link href={`/registro?next=/jugador/inicio`}
          className="mt-4 inline-flex items-center justify-center w-full py-3 rounded-xl bg-ball text-black font-black active:scale-95 transition">
          Crear mi cuenta gratis →
        </Link>
      </div>

      {/* Volver */}
      <Link href={`/r/${slug}`} className="mt-6 block text-center text-white/50 text-sm font-bold underline">
        ← Reservar otro turno
      </Link>

      <div className="pt-10 text-center">
        <p className="text-white/30 text-xs">Reservas gestionadas con</p>
        <Link href="/" className="inline-block mt-1 font-display font-black text-ball">NarvoQ</Link>
      </div>
    </main>
  );
}
