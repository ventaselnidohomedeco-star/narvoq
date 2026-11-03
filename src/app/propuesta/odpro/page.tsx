'use client';
import { useEffect } from 'react';

export default function PropuestaODpro() {
  useEffect(() => {
    document.title = 'NarvoQ — Propuesta Comercial ODpro Experience';
  }, []);
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          .no-print { display: none !important; }
          .page-break { page-break-after: always; }
          body { background: #0a0a0a !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      {/* Botón imprimir — se oculta al imprimir */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <button onClick={() => window.print()}
          className="px-5 py-3 rounded-xl bg-[#B4FF39] text-black font-black shadow-2xl shadow-[#B4FF39]/30 active:scale-95">
          🖨 Descargar PDF
        </button>
      </div>

      <article className="max-w-[820px] mx-auto px-8 py-10">

        {/* HEADER con logo */}
        <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#B4FF39]/20 via-[#B4FF39]/5 to-transparent border border-[#B4FF39]/40 p-8">
          <div className="flex items-start justify-between gap-6">
            <div>
              <img src="/brand/logo.png?v=9"
                alt="NarvoQ"
                style={{ height: 72, width: 'auto', objectFit: 'contain' }} />
              <p className="text-[#B4FF39] text-[11px] font-black tracking-[0.2em] mt-3">PROPUESTA COMERCIAL · B2B</p>
              <p className="text-white/90 text-lg font-black mt-1">Centro de Entrenamiento</p>
            </div>
            <div className="text-right">
              <p className="text-[#B4FF39] text-[10px] font-black tracking-widest">CLIENTE</p>
              <p className="font-black text-xl mt-1">ODpro Experience</p>
              <p className="text-white/60 text-xs mt-1">San Miguel del Monte</p>
              <p className="text-white/60 text-xs">Buenos Aires · Argentina</p>
              <p className="text-white/60 text-xs mt-2">A/C: <b className="text-white">Marcelo Terre</b></p>
              <p className="text-white/40 text-[10px] mt-3">
                {new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </header>

        {/* RESUMEN */}
        <section className="mt-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-[#B4FF39] text-black font-black text-sm px-3 py-1 rounded">01</span>
            <h2 className="text-2xl font-black">Resumen ejecutivo</h2>
          </div>
          <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-6">
            <p className="leading-relaxed text-[15px] text-white/90">
              <b className="text-[#B4FF39]">NarvoQ</b> es una plataforma integral de gestión para centros de entrenamiento de pádel.
              Esta propuesta cubre el módulo <b>Centro de Entrenamiento</b> para <b>ODpro Experience</b>,
              su equipo de coaches y sus 70 alumnos activos.
            </p>
            <p className="mt-3 leading-relaxed text-[15px] text-white/80">
              El objetivo es <b className="text-[#B4FF39]">eliminar la gestión manual por WhatsApp</b> y centralizar en una app
              la coordinación de turnos, el seguimiento de alumnos en los 5 pilares de formación,
              las evaluaciones periódicas, las confirmaciones de asistencia y el dashboard operativo.
            </p>
          </div>
        </section>

        {/* PROBLEMAS */}
        <section className="mt-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-[#B4FF39] text-black font-black text-sm px-3 py-1 rounded">02</span>
            <h2 className="text-2xl font-black">Problemas que resuelve</h2>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {[
              ['🔀 Coordinar turnos', 'Hoy requiere múltiples WhatsApps para encontrar alumnos y coaches disponibles. NarvoQ cruza automáticamente dispo + categoría + cancha.'],
              ['📈 Seguimiento del alumno', 'Hoy el progreso vive en la cabeza del coach o en Excels. NarvoQ registra horas por pilar y evaluaciones periódicas.'],
              ['✅ Confirmaciones de clase', 'Hoy se mandan WhatsApps uno por uno. NarvoQ los centraliza y permite envíos masivos.'],
              ['💰 Visibilidad financiera', 'Dashboard de horas dictadas, costos de staff y ranking de coaches.'],
              ['📱 Experiencia del alumno', 'El jugador accede a su propia app con historial, evaluaciones y confirmación de asistencia.']
            ].map(([icon, txt]) => (
              <div key={icon} className="rounded-xl bg-white/[0.03] border border-white/10 p-4 flex gap-4">
                <div className="font-black text-white w-[200px] shrink-0">{icon}</div>
                <div className="text-white/80 text-sm">{txt}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="page-break" />

        {/* PRESTACIONES CENTRO */}
        <section className="mt-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-[#B4FF39] text-black font-black text-sm px-3 py-1 rounded">03</span>
            <h2 className="text-2xl font-black">Prestaciones para el Centro</h2>
          </div>
          <div className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
            {[
              ['🏫', 'Jerarquía Master / Coach / Asistente', 'Permisos y vistas separadas por rol'],
              ['🎓', 'Alumnos con coach asignado', 'Cada coach gestiona solo sus alumnos'],
              ['📥', 'Importador masivo CSV / Excel', 'Alta de todos los alumnos en 1 click + activación por email o WhatsApp (vos elegís el canal)'],
              ['🏋️', '5 pilares de formación', 'Filosofía · GYM · Psicología · Nutrición · Cancha — tracking de horas por alumno'],
              ['✨', 'Coordinación automática de turnos', 'Cross-info de dispo alumno + coach + cancha + categoría'],
              ['⏰', 'Disponibilidad semanal', 'Alumnos y coaches cargan sus horarios → el sistema propone combinaciones'],
              ['🎯', 'Evaluaciones periódicas', '6 dimensiones (técnica, táctica, físico, mental, actitud, compromiso) + fortalezas / mejoras / objetivos'],
              ['📱', 'Confirmaciones de clase', 'Centralizadas en una vista unificada por día'],
              ['📊', 'Dashboard operativo', 'Horas dictadas, costos de staff, ranking de coaches, ausentismo'],
              ['🏆', 'Torneos propios', 'Fixture, standings, bracket automático'],
              ['🏟', 'Integración con canchas', 'Si tenés complejo asociado, cruza con disponibilidad real de canchas'],
              ['🔔', 'Push notifications', 'A alumnos y coaches en todos los eventos clave']
            ].map(([icon, titulo, desc], i) => (
              <div key={titulo} className={`p-4 flex items-start gap-4 ${i !== 0 ? 'border-t border-white/5' : ''}`}>
                <span className="text-2xl shrink-0">{icon}</span>
                <div className="flex-1">
                  <p className="font-black text-white text-[15px]">{titulo}</p>
                  <p className="text-white/60 text-sm mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="page-break" />

        {/* PRESTACIONES ALUMNO */}
        <section className="mt-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-[#B4FF39] text-black font-black text-sm px-3 py-1 rounded">04</span>
            <h2 className="text-2xl font-black">Prestaciones para el Alumno</h2>
          </div>
          <div className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
            {[
              ['📅', 'Mis clases', 'Lista de clases próximas con botón "✓ Voy" / "✗ No puedo"'],
              ['🏋️', 'Balance por pilar', 'Horas acumuladas en Cancha, GYM, Filosofía, Psicología y Nutrición'],
              ['🎯', 'Evaluaciones del coach', 'Scores en 6 dimensiones + fortalezas, debilidades y objetivos'],
              ['📊', 'Progreso personal', 'Dashboard histórico de todas sus sesiones'],
              ['🔔', 'Notificaciones push', 'Nueva clase, nueva evaluación, cambio de coach'],
              ['🎾', 'Reservar canchas', 'En ODpro y otros complejos de la red NarvoQ'],
              ['🏆', 'Torneos', 'Inscripción y seguimiento de torneos propios y externos'],
              ['📰', 'Feed + Smashe@', 'Comunidad de pádel de la zona + chat 24hs']
            ].map(([icon, titulo, desc], i) => (
              <div key={titulo} className={`p-4 flex items-start gap-4 ${i !== 0 ? 'border-t border-white/5' : ''}`}>
                <span className="text-2xl shrink-0">{icon}</span>
                <div className="flex-1">
                  <p className="font-black text-white text-[15px]">{titulo}</p>
                  <p className="text-white/60 text-sm mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* PLANES */}
        <section className="mt-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-[#B4FF39] text-black font-black text-sm px-3 py-1 rounded">05</span>
            <h2 className="text-2xl font-black">Planes y precios</h2>
          </div>
          <div className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
            <div className="grid grid-cols-4 bg-black border-b border-white/10 text-[11px] font-black text-white/60 tracking-widest">
              <div className="p-3">PLAN</div>
              <div className="p-3">ALUMNOS</div>
              <div className="p-3">FEATURES</div>
              <div className="p-3 text-right">PRECIO ARS/MES</div>
            </div>
            {[
              { name: '🥉 Basic', alumnos: 'Hasta 15', features: 'Features core', precio: '$10.000', highlight: false },
              { name: '🥈 Starter', alumnos: 'Hasta 30', features: 'Core + Coaching', precio: '$25.000', highlight: false },
              { name: '🥇 PRO', badge: 'RECOMENDADO', alumnos: 'Hasta 80', features: 'Todo + Confirmaciones + Coordinación', precio: '$55.000', highlight: true },
              { name: '💎 Elite', alumnos: 'Ilimitado', features: 'PRO + WhatsApp Auto + Perfil Pro gratis a tus alumnos', precio: '$120.000', highlight: false }
            ].map((p, i) => (
              <div key={p.name} className={`grid grid-cols-4 items-center text-sm ${i !== 0 ? 'border-t border-white/5' : ''} ${p.highlight ? 'bg-[#B4FF39]/10' : ''}`}>
                <div className="p-4">
                  <p className={`font-black ${p.highlight ? 'text-[#B4FF39]' : 'text-white'}`}>{p.name}</p>
                  {p.badge && <p className="text-[9px] text-[#B4FF39] font-black mt-0.5">{p.badge}</p>}
                </div>
                <div className="p-4 text-white/80">{p.alumnos}</div>
                <div className="p-4 text-white/70 text-xs">{p.features}</div>
                <div className={`p-4 text-right font-black ${p.highlight ? 'text-[#B4FF39] text-xl' : 'text-white text-lg'}`}>{p.precio}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-white/50">
            Todos los planes incluyen: setup gratuito, carga de datos iniciales, soporte por WhatsApp, actualizaciones continuas y nuevas features sin costo adicional.
          </p>
        </section>

        {/* ADD-ONS */}
        <section className="mt-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-[#B4FF39] text-black font-black text-sm px-3 py-1 rounded">06</span>
            <h2 className="text-2xl font-black">Add-ons opcionales</h2>
          </div>
          <div className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
            {[
              ['WhatsApp Business API automático (hasta 1000 msgs/mes)', '+ $35.000 / mes'],
              ['Cobro mensual a alumnos vía Mercado Pago', '5% sobre lo cobrado'],
              ['Branded app con dominio propio (ej: app.odpro.com.ar)', '+ $150.000 / mes'],
              ['Capacitación 1-a-1 completa al equipo', '$80.000 one-time'],
              ['Soporte prioritario 24hs', '+ $20.000 / mes']
            ].map(([txt, precio], i) => (
              <div key={txt} className={`flex items-center justify-between p-4 ${i !== 0 ? 'border-t border-white/5' : ''}`}>
                <span className="text-white/80 text-sm">{txt}</span>
                <span className="font-black text-[#B4FF39]">{precio}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="page-break" />

        {/* ONBOARDING */}
        <section className="mt-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-[#B4FF39] text-black font-black text-sm px-3 py-1 rounded">07</span>
            <h2 className="text-2xl font-black">Puesta en marcha</h2>
          </div>
          <div className="space-y-3">
            {[
              ['Día 1', 'Setup e importación',
                'Creamos el centro ODpro Experience en NarvoQ. Dejamos cargada la jerarquía (vos como Master Coach + tus coaches) y los 5 pilares. Nosotros importamos tu Excel/CSV con los alumnos — cada uno recibe su link de activación por el canal que elijas (email o WhatsApp broadcast). En el mismo día están todos adentro.'],
              ['Día 2', 'Capacitación del equipo',
                'Sesión en vivo de 1hs con vos y tus coaches. Les mostramos cómo registrar sesiones, evaluar, coordinar turnos y confirmar asistencia.'],
              ['Desde el día 3', 'Uso real',
                'Arrancás a usar la app en el día a día del centro. Soporte diario por WhatsApp.']
            ].map(([dia, titulo, desc]) => (
              <div key={titulo} className="rounded-xl bg-white/[0.03] border border-white/10 p-5 flex gap-5">
                <div className="shrink-0">
                  <div className="bg-[#B4FF39] text-black font-black text-xs px-3 py-1.5 rounded-full">{dia}</div>
                </div>
                <div>
                  <p className="font-black text-white text-base">{titulo}</p>
                  <p className="text-white/70 text-sm mt-1 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* OFERTA CERRADA */}
        <section className="mt-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-[#B4FF39] text-black font-black text-sm px-3 py-1 rounded">08</span>
            <h2 className="text-2xl font-black">Nuestra oferta para ODpro</h2>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-[#B4FF39] to-[#9ADD1E] text-black p-8">
            <p className="text-black/60 text-[11px] font-black tracking-[0.2em]">PLAN SELECCIONADO</p>
            <p className="font-black text-4xl mt-1">🥇 PRO</p>
            <p className="font-black text-5xl mt-2">$55.000 <span className="text-xl">ARS/mes</span></p>
            <div className="mt-5 pt-5 border-t border-black/20 space-y-2 text-[15px] font-bold">
              <p>✓ Hasta 80 alumnos</p>
              <p>✓ Todas las features del centro</p>
              <p>✓ Setup, importación y carga de datos SIN COSTO</p>
              <p>✓ Capacitación al equipo incluida (1hs en vivo)</p>
              <p>✓ Activación de alumnos (email o WhatsApp)</p>
              <p>✓ Soporte diario por WhatsApp</p>
              <p>✓ Facturación mensual desde el día 1</p>
            </div>
            <div className="mt-6 pt-6 border-t border-black/20">
              <p className="text-sm font-black">💡 Oferta anual: $528.000/año (20% off · ahorrás $132.000)</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-white/40 italic text-center">
            La inversión en diseño, desarrollo, infraestructura, soporte y mantenimiento está incluida en el abono mensual.
          </p>
        </section>

        {/* FIRMA */}
        <section className="mt-10">
          <div className="grid grid-cols-2 gap-6">
            <div className="rounded-xl bg-white/[0.03] border border-white/10 p-6">
              <p className="text-[#B4FF39] text-[10px] font-black tracking-widest">POR NARVOQ</p>
              <div className="mt-12 border-b border-white/30" />
              <p className="font-black mt-2 text-white">Matías Hernandez</p>
              <p className="text-xs text-white/50">Fundador · NarvoQ</p>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/10 p-6">
              <p className="text-[#B4FF39] text-[10px] font-black tracking-widest">POR ODPRO EXPERIENCE</p>
              <div className="mt-12 border-b border-white/30" />
              <p className="font-black mt-2 text-white">Marcelo Terre</p>
              <p className="text-xs text-white/50">Director · ODpro Experience</p>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="mt-10 pt-6 border-t border-white/10 text-center">
          <img src="/brand/logo.png?v=9" alt="NarvoQ"
            style={{ height: 32, width: 'auto', margin: '0 auto', opacity: 0.8 }} />
          <p className="text-white/40 text-[11px] mt-3">
            narvoqapp@gmail.com · narvoq.com.ar
          </p>
          <p className="text-white/30 text-[10px] mt-1">
            Propuesta válida por 30 días desde la fecha de emisión
          </p>
        </footer>
      </article>
    </main>
  );
}
