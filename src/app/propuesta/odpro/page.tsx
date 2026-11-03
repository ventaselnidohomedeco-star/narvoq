'use client';
import { useEffect } from 'react';

export default function PropuestaODpro() {
  useEffect(() => {
    document.title = 'NarvoQ — Propuesta Comercial ODpro Experience';
  }, []);
  return (
    <main className="min-h-screen bg-white text-gray-900">
      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          .no-print { display: none !important; }
          .page-break { page-break-after: always; }
          .avoid-break, .avoid-break * { break-inside: avoid-page !important; page-break-inside: avoid !important; }
          .avoid-break { page-break-before: auto; }
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          section { page-break-inside: avoid; break-inside: avoid-page; }
        }
      `}</style>

      {/* Botón imprimir — se oculta al imprimir */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <button onClick={() => window.print()}
          className="px-5 py-3 rounded-xl bg-black text-[#B4FF39] font-black shadow-2xl active:scale-95">
          🖨 Descargar PDF
        </button>
      </div>

      <article className="max-w-[820px] mx-auto px-8 py-10">

        {/* HEADER con fondo negro + verde lima */}
        <header className="relative overflow-hidden rounded-2xl bg-black p-8 border-l-8 border-[#B4FF39]">
          <div className="flex items-start justify-between gap-6">
            <div>
              <img src="/brand/logo.png?v=9"
                alt="NarvoQ"
                style={{ height: 72, width: 'auto', objectFit: 'contain', mixBlendMode: 'screen' }} />
              <p className="text-[#B4FF39] text-[11px] font-black tracking-[0.2em] mt-3">PROPUESTA COMERCIAL · B2B</p>
              <p className="text-white text-lg font-black mt-1">Centro de Entrenamiento</p>
            </div>
            <div className="text-right">
              <p className="text-[#B4FF39] text-[10px] font-black tracking-widest">CLIENTE</p>
              <p className="font-black text-xl mt-1 text-white">ODpro Experience</p>
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
            <span className="bg-black text-[#B4FF39] font-black text-sm px-3 py-1 rounded">01</span>
            <h2 className="text-2xl font-black text-gray-900">Resumen ejecutivo</h2>
          </div>
          <div className="rounded-2xl bg-gray-50 border border-gray-200 p-6">
            <p className="leading-relaxed text-[15px] text-gray-800">
              <b className="text-gray-900">NarvoQ</b> es una plataforma integral de gestión para centros de entrenamiento de pádel.
              Esta propuesta cubre el módulo <b>Centro de Entrenamiento</b> para <b>ODpro Experience</b>,
              su equipo de coaches y sus 70 alumnos activos.
            </p>
            <p className="mt-3 leading-relaxed text-[15px] text-gray-700">
              El objetivo es <b className="text-gray-900">eliminar la gestión manual por WhatsApp</b> y centralizar en una app
              la coordinación de turnos, el seguimiento de alumnos en los 5 pilares de formación,
              las evaluaciones periódicas, las confirmaciones de asistencia y el dashboard operativo.
            </p>
          </div>
        </section>

        {/* PROBLEMAS */}
        <section className="mt-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-black text-[#B4FF39] font-black text-sm px-3 py-1 rounded">02</span>
            <h2 className="text-2xl font-black text-gray-900">Problemas que resuelve</h2>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {[
              ['🔀 Coordinar turnos', 'Hoy requiere múltiples WhatsApps para encontrar alumnos y coaches disponibles. NarvoQ cruza automáticamente dispo + categoría + cancha.'],
              ['📈 Seguimiento del alumno', 'Hoy el progreso vive en la cabeza del coach o en Excels. NarvoQ registra horas por pilar y evaluaciones periódicas.'],
              ['✅ Confirmaciones de clase', 'Hoy se mandan WhatsApps uno por uno. NarvoQ los centraliza y permite envíos masivos.'],
              ['💰 Visibilidad financiera', 'Dashboard de horas dictadas, costos de staff y ranking de coaches.'],
              ['📱 Experiencia del alumno', 'El jugador accede a su propia app con historial, evaluaciones y confirmación de asistencia.']
            ].map(([icon, txt]) => (
              <div key={icon} className="rounded-xl bg-gray-50 border border-gray-200 p-4 flex gap-4">
                <div className="font-black text-gray-900 w-[200px] shrink-0">{icon}</div>
                <div className="text-gray-700 text-sm">{txt}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="page-break" />

        {/* PRESTACIONES CENTRO */}
        <section className="mt-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-black text-[#B4FF39] font-black text-sm px-3 py-1 rounded">03</span>
            <h2 className="text-2xl font-black text-gray-900">Prestaciones para el Centro</h2>
          </div>
          <div className="rounded-2xl bg-gray-50 border border-gray-200 overflow-hidden">
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
              <div key={titulo} className={`p-4 flex items-start gap-4 bg-white ${i !== 0 ? 'border-t border-gray-200' : ''}`}>
                <span className="text-2xl shrink-0">{icon}</span>
                <div className="flex-1">
                  <p className="font-black text-gray-900 text-[15px]">{titulo}</p>
                  <p className="text-gray-600 text-sm mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="page-break" />

        {/* PRESTACIONES ALUMNO */}
        <section className="mt-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-black text-[#B4FF39] font-black text-sm px-3 py-1 rounded">04</span>
            <h2 className="text-2xl font-black text-gray-900">Prestaciones para el Alumno</h2>
          </div>
          <div className="rounded-2xl bg-gray-50 border border-gray-200 overflow-hidden">
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
              <div key={titulo} className={`p-4 flex items-start gap-4 bg-white ${i !== 0 ? 'border-t border-gray-200' : ''}`}>
                <span className="text-2xl shrink-0">{icon}</span>
                <div className="flex-1">
                  <p className="font-black text-gray-900 text-[15px]">{titulo}</p>
                  <p className="text-gray-600 text-sm mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* PLANES — fuerzo page-break antes para que entre entera en 1 página */}
        <div className="page-break" />
        <section className="mt-8 avoid-break">
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-black text-[#B4FF39] font-black text-sm px-3 py-1 rounded">05</span>
            <h2 className="text-2xl font-black text-gray-900">Planes y precios</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {/* PRO — plan recomendado */}
            <div className="rounded-2xl bg-black border-2 border-[#B4FF39] p-6 relative overflow-hidden text-white avoid-break">
              <div className="absolute top-0 right-0 bg-[#B4FF39] text-black font-black text-[10px] px-3 py-1 tracking-widest rounded-bl-xl">
                RECOMENDADO
              </div>
              <p className="text-[#B4FF39] text-[11px] font-black tracking-widest">🥇 PLAN PRO</p>
              <p className="font-black text-5xl mt-2">$55.000</p>
              <p className="text-white/60 text-sm">ARS / mes</p>
              <p className="text-white/80 text-sm mt-3 font-black">Hasta 80 alumnos</p>
              <div className="mt-5 pt-5 border-t border-white/20 space-y-2 text-sm text-white/90">
                <p>✓ Jerarquía Master / Coach / Asistente</p>
                <p>✓ Alumnos con coach asignado</p>
                <p>✓ Importador masivo CSV / Excel</p>
                <p>✓ 5 pilares de formación</p>
                <p>✓ Coordinación automática de turnos</p>
                <p>✓ Disponibilidad semanal (alumnos + coaches)</p>
                <p>✓ Evaluaciones periódicas (6 dimensiones)</p>
                <p>✓ Confirmaciones de clase centralizadas</p>
                <p>✓ Dashboard operativo completo</p>
                <p>✓ Torneos propios con bracket automático</p>
                <p>✓ Integración con canchas del complejo</p>
                <p>✓ Push notifications</p>
                <p>✓ Soporte diario por WhatsApp</p>
              </div>
            </div>

            {/* ELITE — upgrade */}
            <div className="rounded-2xl bg-gray-50 border-2 border-gray-200 p-6 relative overflow-hidden avoid-break">
              <div className="absolute top-0 right-0 bg-gray-900 text-white font-black text-[10px] px-3 py-1 tracking-widest rounded-bl-xl">
                UPGRADE
              </div>
              <p className="text-gray-500 text-[11px] font-black tracking-widest">💎 PLAN ELITE</p>
              <p className="font-black text-5xl mt-2 text-gray-900">$120.000</p>
              <p className="text-gray-500 text-sm">ARS / mes</p>
              <p className="text-gray-700 text-sm mt-3 font-black">Alumnos ilimitados</p>
              <div className="mt-5 pt-5 border-t border-gray-200 space-y-2 text-sm text-gray-800">
                <p className="text-gray-500 italic">Todo lo del PRO más:</p>
                <p>⭐ Sin límite de alumnos</p>
                <p>⭐ <b>WhatsApp Business API automático</b> incluido (hasta 2000 msgs/mes)</p>
                <p>⭐ Tus alumnos reciben el <b>Perfil Pro gratis</b> (valor $105.000 para 70 alumnos)</p>
                <p>⭐ Branding del centro en comunicaciones</p>
                <p>⭐ Dashboard de bonos a coaches</p>
                <p>⭐ Soporte prioritario</p>
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-500 text-center">
            Setup gratuito · Carga de datos iniciales incluida · Actualizaciones continuas · Facturación mensual
          </p>
        </section>

        {/* ADD-ONS */}
        <section className="mt-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-black text-[#B4FF39] font-black text-sm px-3 py-1 rounded">06</span>
            <h2 className="text-2xl font-black text-gray-900">Add-ons opcionales</h2>
          </div>
          <div className="rounded-2xl bg-gray-50 border border-gray-200 overflow-hidden">
            {[
              ['WhatsApp Business API automático (hasta 1000 msgs/mes)', '+ $35.000 / mes'],
              ['Cobro mensual a alumnos vía Mercado Pago', '5% sobre lo cobrado'],
              ['Branded app con dominio propio (ej: app.odpro.com.ar)', '+ $150.000 / mes'],
              ['Capacitación 1-a-1 completa al equipo', '$80.000 one-time'],
              ['Soporte prioritario 24hs', '+ $20.000 / mes']
            ].map(([txt, precio], i) => (
              <div key={txt} className={`flex items-center justify-between p-4 bg-white ${i !== 0 ? 'border-t border-gray-200' : ''}`}>
                <span className="text-gray-700 text-sm">{txt}</span>
                <span className="font-black text-gray-900">{precio}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="page-break" />

        {/* ONBOARDING */}
        <section className="mt-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-black text-[#B4FF39] font-black text-sm px-3 py-1 rounded">07</span>
            <h2 className="text-2xl font-black text-gray-900">Puesta en marcha</h2>
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
              <div key={titulo} className="rounded-xl bg-gray-50 border border-gray-200 p-5 flex gap-5">
                <div className="shrink-0">
                  <div className="bg-black text-[#B4FF39] font-black text-xs px-3 py-1.5 rounded-full">{dia}</div>
                </div>
                <div>
                  <p className="font-black text-gray-900 text-base">{titulo}</p>
                  <p className="text-gray-600 text-sm mt-1 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* OFERTA CERRADA */}
        <section className="mt-8 avoid-break">
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-black text-[#B4FF39] font-black text-sm px-3 py-1 rounded">08</span>
            <h2 className="text-2xl font-black text-gray-900">Nuestra oferta para ODpro</h2>
          </div>
          <div className="rounded-2xl bg-black text-white p-8 border-l-8 border-[#B4FF39] avoid-break">
            <p className="text-[#B4FF39] text-[11px] font-black tracking-[0.2em]">PLAN SELECCIONADO</p>
            <p className="font-black text-4xl mt-1">🥇 PRO</p>
            <p className="font-black text-5xl mt-2 text-[#B4FF39]">$55.000 <span className="text-xl text-white">ARS/mes</span></p>
            <div className="mt-5 pt-5 border-t border-white/20 space-y-2 text-[15px] font-bold">
              <p>✓ Hasta 80 alumnos</p>
              <p>✓ Todas las features del centro</p>
              <p>✓ Setup, importación y carga de datos SIN COSTO</p>
              <p>✓ Capacitación al equipo incluida (1hs en vivo)</p>
              <p>✓ Activación de alumnos (email o WhatsApp)</p>
              <p>✓ Soporte diario por WhatsApp</p>
              <p>✓ Facturación mensual desde el día 1</p>
            </div>
            <div className="mt-6 pt-6 border-t border-white/20">
              <p className="text-sm font-black text-[#B4FF39]">💡 Oferta anual: $528.000/año (20% off · ahorrás $132.000)</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-500 italic text-center">
            La inversión en diseño, desarrollo, infraestructura, soporte y mantenimiento está incluida en el abono mensual.
          </p>
        </section>

        {/* FIRMA */}
        <section className="mt-10 avoid-break">
          <div className="grid grid-cols-2 gap-6">
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-6">
              <p className="text-gray-500 text-[10px] font-black tracking-widest">POR NARVOQ</p>
              <div className="mt-12 border-b-2 border-gray-900" />
              <p className="font-black mt-2 text-gray-900">Matías Hernandez</p>
              <p className="text-xs text-gray-500">Fundador · NarvoQ</p>
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-6">
              <p className="text-gray-500 text-[10px] font-black tracking-widest">POR ODPRO EXPERIENCE</p>
              <div className="mt-12 border-b-2 border-gray-900" />
              <p className="font-black mt-2 text-gray-900">Marcelo Terre</p>
              <p className="text-xs text-gray-500">Director · ODpro Experience</p>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="mt-10 pt-6 border-t border-gray-200 text-center">
          <div className="inline-block bg-black rounded-xl px-4 py-2">
            <img src="/brand/logo.png?v=9" alt="NarvoQ"
              style={{ height: 28, width: 'auto', mixBlendMode: 'screen' }} />
          </div>
          <p className="text-gray-500 text-[11px] mt-3">
            narvoqapp@gmail.com · narvoq.com.ar
          </p>
          <p className="text-gray-400 text-[10px] mt-1">
            Propuesta válida por 30 días desde la fecha de emisión
          </p>
        </footer>
      </article>
    </main>
  );
}
