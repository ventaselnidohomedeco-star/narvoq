'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

const DIAS_LABEL = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const MESES_LABEL = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

type Session = {
  id: string;
  date: string;
  session_time: string | null;
  pillar: string;
  hours: number;
  confirmed_at: string | null;
  wa_sent_at: string | null;
  student: { id: string; first_name: string; last_name: string; phone: string | null };
  coach: { first_name: string; last_name: string } | null;
};

export default function Confirmaciones() {
  const { slug } = useParams<{ slug: string }>();
  const [centro, setCentro] = useState<any>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'manana' | 'proximos7' | 'pendientes'>('manana');

  async function load() {
    const { data: c } = await supabase.from('training_centers').select('*').eq('slug', slug).maybeSingle();
    if (!c) { setLoading(false); return; }
    setCentro(c);
    const today = new Date().toISOString().slice(0, 10);
    const nextWeek = new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10);
    const { data } = await supabase.from('pillar_sessions')
      .select(`id, date, session_time, pillar, hours, confirmed_at, wa_sent_at,
        student:profiles!student_id(id, first_name, last_name, phone),
        coach:profiles!coach_id(first_name, last_name)`)
      .eq('center_id', c.id)
      .gte('date', today).lt('date', nextWeek)
      .order('date').limit(1000);
    setSessions((data ?? []) as any);
    setLoading(false);
  }
  useEffect(() => { load(); }, [slug]);

  const filtered = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    if (filter === 'manana') return sessions.filter(s => s.date === tomorrow);
    if (filter === 'pendientes') return sessions.filter(s => !s.confirmed_at);
    return sessions;
  }, [sessions, filter]);

  // Agrupar por fecha
  const grouped = useMemo(() => {
    const g: Record<string, Session[]> = {};
    for (const s of filtered) {
      (g[s.date] = g[s.date] ?? []).push(s);
    }
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  function waMessage(s: Session): string {
    const d = new Date(s.date + 'T00:00:00');
    const dia = DIAS_LABEL[d.getDay()];
    const dayN = d.getDate();
    const mes = MESES_LABEL[d.getMonth()];
    const hora = s.session_time ? s.session_time.slice(0, 5) : '18:00';
    return `¡Hola ${s.student.first_name}! 👋\n\nPor favor confirmar asistencia a tu turno:\n\n🏟️ En: ${centro?.name}\n📅 El día: ${dia} ${dayN} de ${mes}\n⏰ A las: ${hora} hs\n👨‍🏫 Con: ${s.coach?.first_name ?? 'el coach'}\n\nRespondé con un ✅ para confirmar.`;
  }

  function waLink(s: Session): string | null {
    if (!s.student.phone) return null;
    const num = s.student.phone.replace(/\D/g, '');
    const final = num.startsWith('54') ? num : '54' + num;
    return `https://wa.me/${final}?text=${encodeURIComponent(waMessage(s))}`;
  }

  async function marcarEnviado(id: string) {
    await supabase.from('pillar_sessions').update({ wa_sent_at: new Date().toISOString() }).eq('id', id);
    load();
  }

  async function marcarConfirmado(id: string) {
    await supabase.from('pillar_sessions')
      .update({ confirmed_at: new Date().toISOString(), confirmed_by: 'coach' })
      .eq('id', id);
    load();
  }

  async function enviarTodosManual() {
    const pendientes = filtered.filter(s => !s.wa_sent_at && s.student.phone);
    if (pendientes.length === 0) return alert('No hay mensajes pendientes de enviar.');
    if (!confirm(`Se van a abrir ${pendientes.length} ventanas de WhatsApp. ¿Continuar?`)) return;
    for (const s of pendientes) {
      const link = waLink(s);
      if (link) {
        window.open(link, '_blank');
        await marcarEnviado(s.id);
        await new Promise(r => setTimeout(r, 400));
      }
    }
  }

  if (loading) return <main className="p-8 text-white/60">Cargando…</main>;
  if (!centro) return <main className="p-8"><p className="text-white/60">Centro no encontrado</p></main>;

  const pendientesTomorrow = sessions.filter(s =>
    s.date === new Date(Date.now() + 86400000).toISOString().slice(0, 10) && !s.confirmed_at
  ).length;

  return (
    <main className="min-h-dvh max-w-2xl mx-auto text-white px-5 py-6">
      <Link href={`/training/centro/${slug}`} className="text-white/50 text-xs font-black">← {centro.name}</Link>
      <h1 className="font-display font-black text-2xl mt-1">📱 Confirmaciones WhatsApp</h1>
      <p className="text-white/50 text-sm">Sesiones agendadas · Enviá recordatorios a los alumnos</p>

      {/* Banner Fase 2 */}
      <div className="mt-4 rounded-2xl bg-gradient-to-br from-emerald-500/15 to-transparent border border-emerald-500/40 p-4">
        <p className="text-emerald-300 text-[11px] font-black tracking-widest">💚 FASE 2 · WHATSAPP AUTOMÁTICO</p>
        <p className="text-white/80 text-sm mt-1">
          <b>Hoy (manual):</b> tocás "Enviar WA" y se abre WhatsApp con el mensaje listo.
          <br/>
          <b>Fase 2 (en setup):</b> integración con WhatsApp Business API — los mensajes se envían SOLOS 24hs antes de cada sesión. Costo ~USD 0.02/msg.
        </p>
      </div>

      {/* Filtros */}
      <div className="mt-5 grid grid-cols-3 gap-2">
        {[
          { k: 'manana', l: '📅 Mañana', badge: pendientesTomorrow },
          { k: 'proximos7', l: '📆 Próximos 7d' },
          { k: 'pendientes', l: '⏳ Sin confirmar' }
        ].map((f: any) => (
          <button key={f.k} onClick={() => setFilter(f.k)}
            className={`relative py-2.5 rounded-xl font-black text-sm ${filter === f.k ? 'bg-ball text-black' : 'bg-white/5 text-white/60 border border-white/10'}`}>
            {f.l}
            {f.badge > 0 && filter !== f.k && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                {f.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Botón enviar todos */}
      {filtered.filter(s => !s.wa_sent_at && s.student.phone).length > 0 && (
        <button onClick={enviarTodosManual}
          className="mt-4 w-full py-3 rounded-xl bg-[#25D366] text-white font-black active:scale-95 transition">
          📱 Enviar WA a todos los pendientes ({filtered.filter(s => !s.wa_sent_at && s.student.phone).length})
        </button>
      )}

      {/* Listado */}
      {grouped.length === 0 ? (
        <p className="mt-8 text-white/40 text-center text-sm">
          Sin sesiones agendadas en el filtro. Para probar, agendá sesiones futuras desde <Link href={`/training/centro/${slug}/pilares`} className="text-ball underline">Pilares</Link>
        </p>
      ) : grouped.map(([date, ss]) => {
        const d = new Date(date + 'T00:00:00');
        return (
          <section key={date} className="mt-6">
            <p className="text-ball text-[11px] font-black tracking-widest mb-2">
              {DIAS_LABEL[d.getDay()].toUpperCase()} {d.getDate()} DE {MESES_LABEL[d.getMonth()].toUpperCase()} · {ss.length} sesiones
            </p>
            <div className="space-y-2">
              {ss.map(s => {
                const link = waLink(s);
                return (
                  <div key={s.id} className={`rounded-xl p-3 border ${
                    s.confirmed_at ? 'bg-emerald-500/10 border-emerald-500/30' :
                    s.wa_sent_at ? 'bg-yellow-500/10 border-yellow-500/30' :
                    'bg-white/5 border-white/10'
                  }`}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm">{s.student.first_name} {s.student.last_name}</p>
                        <p className="text-white/60 text-xs">
                          ⏰ {s.session_time?.slice(0,5) ?? '18:00'}
                          {' · '}{pillarLabel(s.pillar)}
                          {s.coach && ` · con ${s.coach.first_name}`}
                        </p>
                        <p className="text-xs mt-1">
                          {s.confirmed_at ? (
                            <span className="text-emerald-300 font-black">✅ Confirmó asistencia</span>
                          ) : s.wa_sent_at ? (
                            <span className="text-yellow-300 font-black">📨 WA enviado · esperando confirmación</span>
                          ) : (
                            <span className="text-white/40">⏳ Sin contactar</span>
                          )}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        {!s.confirmed_at && link && (
                          <a href={link} target="_blank" rel="noopener"
                            onClick={() => marcarEnviado(s.id)}
                            className="text-[11px] bg-[#25D366] text-white px-2.5 py-1.5 rounded font-black text-center">
                            📱 WA
                          </a>
                        )}
                        {!s.confirmed_at && (
                          <button onClick={() => marcarConfirmado(s.id)}
                            className="text-[11px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-2.5 py-1.5 rounded font-black">
                            ✓
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </main>
  );
}

function pillarLabel(p: string): string {
  return p === 'cancha' ? '🎾 Cancha' : p === 'gym' ? '🏋️ GYM' :
         p === 'psicologia' ? '💭 Psicología' : p === 'nutricion' ? '🥗 Nutrición' : '🧠 Filosofía';
}
