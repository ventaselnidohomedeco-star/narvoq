'use client';
import { useEffect } from 'react';

export default function PropuestaODpro() {
  useEffect(() => {
    document.title = 'NarvoQ — Propuesta Comercial ODpro Experience';
  }, []);
  return (
    <main className="min-h-screen bg-white text-black">
      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 15mm; }
          .no-print { display: none !important; }
          .page-break { page-break-after: always; }
          body { background: white !important; }
        }
      `}</style>

      {/* Botón imprimir — se oculta al imprimir */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <button onClick={() => window.print()}
          className="px-5 py-3 rounded-xl bg-black text-white font-black shadow-lg active:scale-95">
          🖨 Descargar PDF
        </button>
      </div>

      <article className="max-w-[820px] mx-auto px-10 py-12">
        {/* HEADER */}
        <header className="flex items-center justify-between pb-6 border-b-4 border-black">
          <div>
            <h1 className="text-5xl font-black tracking-tight">NARVOQ</h1>
            <p className="text-sm font-bold text-gray-500 mt-1">Propuesta Comercial · Centro de Entrenamiento</p>
          </div>
          <div className="text-right">
            <p className="font-black text-lg">ODpro Experience</p>
            <p className="text-xs text-gray-500">San Miguel del Monte · Buenos Aires</p>
            <p className="text-xs text-gray-500 mt-1">A/C: Marcelo Terre</p>
            <p className="text-xs text-gray-400 mt-1">{new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        </header>

        {/* INTRO */}
        <section className="mt-8">
          <h2 className="text-2xl font-black">1. Resumen ejecutivo</h2>
          <p className="mt-3 leading-relaxed text-[15px]">
            <b>NarvoQ</b> es una plataforma integral de gestión para centros de entrenamiento de pádel.
            Esta propuesta cubre el módulo <b>Centro de Entrenamiento</b> para <b>ODpro Experience</b>,
            su equipo de coaches y sus ~70 alumnos activos.
          </p>
          <p className="mt-2 leading-relaxed text-[15px]">
            El objetivo es <b>eliminar la gestión manual por WhatsApp</b> y centralizar en una app
            la coordinación de turnos, el seguimiento de alumnos en los 5 pilares de formación,
            las evaluaciones periódicas, las confirmaciones de asistencia y el dashboard operativo.
          </p>
        </section>

        {/* PROBLEMAS */}
        <section className="mt-8">
          <h2 className="text-2xl font-black">2. Problemas que resuelve</h2>
          <ul className="mt-3 space-y-2 text-[15px]">
            <li><b>Coordinar turnos:</b> hoy requiere múltiples WhatsApps para encontrar alumnos y coaches disponibles. NarvoQ cruza automáticamente dispo + categoría + cancha.</li>
            <li><b>Seguimiento del alumno:</b> hoy el progreso vive en la cabeza del coach o en Excels. NarvoQ registra horas por pilar y evaluaciones periódicas.</li>
            <li><b>Confirmaciones de clase:</b> hoy se mandan WhatsApps uno por uno. NarvoQ los envía semi-automático desde una vista unificada (y automático en Fase 2).</li>
            <li><b>Visibilidad financiera:</b> dashboard de horas dictadas, costos de staff y ranking de coaches.</li>
            <li><b>Experiencia del alumno:</b> el jugador accede a su propia app con historial, evaluaciones y confirmación de asistencia.</li>
          </ul>
        </section>

        {/* PRESTACIONES CENTRO */}
        <section className="mt-8">
          <h2 className="text-2xl font-black">3. Prestaciones para el Centro</h2>
          <table className="w-full mt-3 text-[14px]">
            <tbody>
              {[
                ['🏫 Jerarquía Master / Coach / Asistente', 'Permisos y vistas separadas por rol'],
                ['🎓 Alumnos con coach asignado', 'Cada coach gestiona solo sus alumnos'],
                ['📥 Importador CSV / Excel', 'Alta masiva de alumnos en 1 click + activación por WhatsApp'],
                ['🏋️ 5 pilares de formación', 'Filosofía · GYM · Psicología · Nutrición · Cancha — tracking de horas por alumno'],
                ['✨ Coordinación automática de turnos', 'Cross-info de dispo alumno + coach + cancha + categoría'],
                ['⏰ Disponibilidad semanal', 'Alumnos y coaches cargan sus horarios → el sistema propone combinaciones'],
                ['🎯 Evaluaciones periódicas', '6 dimensiones (técnica, táctica, físico, mental, actitud, compromiso) + fortalezas / mejoras / objetivos'],
                ['📱 Confirmaciones por WhatsApp', 'Semi-manual hoy; automático 24hs antes en Fase 2 (add-on)'],
                ['📊 Dashboard operativo', 'Horas dictadas, costos de staff, ranking de coaches, ausentismo'],
                ['🏆 Torneos propios', 'Fixture, standings, bracket automático'],
                ['🏟 Integración con canchas', 'Si tenés complejo asociado, cruza con disponibilidad real de canchas'],
                ['🔔 Push notifications', 'A alumnos y coaches en todos los eventos clave']
              ].map(([k, v]) => (
                <tr key={k} className="border-b border-gray-200">
                  <td className="py-2 pr-4 font-bold align-top w-[260px]">{k}</td>
                  <td className="py-2">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="page-break" />

        {/* PRESTACIONES ALUMNO */}
        <section className="mt-8">
          <h2 className="text-2xl font-black">4. Prestaciones para el Alumno</h2>
          <table className="w-full mt-3 text-[14px]">
            <tbody>
              {[
                ['📅 Mis clases', 'Lista de clases próximas con botón "✓ Voy" / "✗ No puedo"'],
                ['🏋️ Balance por pilar', 'Horas acumuladas en Cancha, GYM, Filosofía, Psicología y Nutrición'],
                ['🎯 Evaluaciones del coach', 'Scores en 6 dimensiones + fortalezas, debilidades y objetivos'],
                ['📊 Progreso personal', 'Dashboard histórico de todas sus sesiones'],
                ['🔔 Notificaciones push', 'Nueva clase, nueva evaluación, cambio de coach'],
                ['🎾 Reservar canchas', 'En ODpro y otros complejos de la red NarvoQ'],
                ['🏆 Torneos', 'Inscripción y seguimiento de torneos propios y externos'],
                ['📰 Feed + Smashe@', 'Comunidad de pádel de la zona + chat 24hs']
              ].map(([k, v]) => (
                <tr key={k} className="border-b border-gray-200">
                  <td className="py-2 pr-4 font-bold align-top w-[220px]">{k}</td>
                  <td className="py-2">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* PLANES */}
        <section className="mt-10">
          <h2 className="text-2xl font-black">5. Planes y precios</h2>
          <table className="w-full mt-4 text-[14px] border-2 border-black">
            <thead>
              <tr className="bg-black text-white">
                <th className="p-3 text-left">Plan</th>
                <th className="p-3 text-left">Alumnos</th>
                <th className="p-3 text-left">Features</th>
                <th className="p-3 text-right">Precio ARS/mes</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-bold">🥉 Basic</td>
                <td className="p-3">Hasta 15</td>
                <td className="p-3 text-xs">Features core</td>
                <td className="p-3 text-right font-black">$10.000</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-3 font-bold">🥈 Starter</td>
                <td className="p-3">Hasta 30</td>
                <td className="p-3 text-xs">Core + Coaching</td>
                <td className="p-3 text-right font-black">$25.000</td>
              </tr>
              <tr className="border-b border-gray-200 bg-lime-50">
                <td className="p-3 font-bold">🥇 PRO <span className="text-xs text-lime-700">(recomendado)</span></td>
                <td className="p-3">Hasta 80</td>
                <td className="p-3 text-xs">Todo + Confirmaciones WA semi-manuales + Coordinación</td>
                <td className="p-3 text-right font-black">$55.000</td>
              </tr>
              <tr>
                <td className="p-3 font-bold">💎 Elite</td>
                <td className="p-3">Ilimitado</td>
                <td className="p-3 text-xs">PRO + WhatsApp Auto incluido + Alumnos reciben Perfil Pro gratis</td>
                <td className="p-3 text-right font-black">$120.000</td>
              </tr>
            </tbody>
          </table>

          <p className="mt-4 text-sm text-gray-600">
            Todos los planes incluyen: setup gratuito, carga de datos iniciales, soporte por WhatsApp, actualizaciones continuas.
          </p>
        </section>

        {/* ADD-ONS */}
        <section className="mt-8">
          <h2 className="text-2xl font-black">6. Add-ons opcionales</h2>
          <table className="w-full mt-3 text-[14px]">
            <tbody>
              {[
                ['WhatsApp Business API automático (hasta 1000 msgs/mes)', '+ $35.000 / mes'],
                ['Cobro mensual a alumnos vía Mercado Pago (comisión)', '5% sobre lo cobrado'],
                ['Branded app con dominio propio (ej: app.odpro.com.ar)', '+ $150.000 / mes'],
                ['Capacitación 1-a-1 completa al equipo', '$80.000 one-time'],
                ['Soporte prioritario 24hs', '+ $20.000 / mes']
              ].map(([k, v]) => (
                <tr key={k} className="border-b border-gray-200">
                  <td className="py-2 pr-4 font-bold align-top">{k}</td>
                  <td className="py-2 text-right">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="page-break" />

        {/* ONBOARDING */}
        <section className="mt-8">
          <h2 className="text-2xl font-black">7. Puesta en marcha</h2>
          <ol className="mt-3 space-y-3 text-[15px] list-decimal pl-6">
            <li>
              <b>Semana 1 — Setup:</b> creamos el centro ODpro Experience en NarvoQ. Dejamos cargada la jerarquía (vos como Master Coach + tus 4 coaches). Configuramos los 5 pilares y la grilla de disponibilidad del complejo.
            </li>
            <li>
              <b>Semana 1 — Carga de alumnos:</b> importás tu Excel/CSV con los 70 alumnos (nombre, apellido, celular, categoría). El sistema crea sus cuentas y les manda WhatsApp con el link de activación. En menos de 1 hora todos tus alumnos están en la app.
            </li>
            <li>
              <b>Semana 2 — Entrenamiento del equipo:</b> capacitación en vivo de 1hs con vos y los 4 coaches. Les mostramos cómo registrar sesiones, evaluar, coordinar turnos y confirmar asistencia.
            </li>
            <li>
              <b>Semanas 3 a 8 — Trial 60 días gratis:</b> uso real sin pagar un peso. Soporte diario por WhatsApp. Si algo no te gusta, lo ajustamos.
            </li>
            <li>
              <b>Semana 9 — Decisión:</b> si funciona, arrancamos con el plan elegido (recomendado: PRO $55.000/mes). Si no, chau sin costo.
            </li>
          </ol>
        </section>

        {/* OFERTA CERRADA */}
        <section className="mt-8 rounded-2xl bg-black text-white p-6">
          <h2 className="text-2xl font-black">8. Nuestra oferta para ODpro</h2>
          <div className="mt-4 space-y-2 text-[15px]">
            <p>✅ <b>Plan PRO</b> — hasta 80 alumnos, todas las features</p>
            <p>✅ <b>Trial 60 días GRATIS</b> para probar con los 70 alumnos reales</p>
            <p>✅ <b>Setup y carga de datos sin costo</b> (incluye capacitación al equipo)</p>
            <p>✅ <b>Soporte diario por WhatsApp</b> durante el trial</p>
            <p>✅ Después del trial: <b>$55.000 ARS/mes</b> facturado mensual</p>
            <p>✅ Opción anual con <b>20% off: $528.000/año</b> (ahorrás $132.000)</p>
          </div>
        </section>

        {/* FIRMA */}
        <section className="mt-10 pt-6 border-t-2 border-black">
          <div className="grid grid-cols-2 gap-10">
            <div>
              <p className="text-sm text-gray-500">POR NARVOQ</p>
              <div className="mt-16 border-b border-black" />
              <p className="font-black mt-1">Matías Hernandez</p>
              <p className="text-xs text-gray-500">Fundador · NarvoQ</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">POR ODPRO EXPERIENCE</p>
              <div className="mt-16 border-b border-black" />
              <p className="font-black mt-1">Marcelo Terre</p>
              <p className="text-xs text-gray-500">Director · ODpro Experience</p>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="mt-10 pt-4 border-t border-gray-300 text-center text-xs text-gray-500">
          NarvoQ — Narvoqapp@gmail.com — narvoq.com.ar<br />
          Propuesta válida por 30 días desde la fecha de emisión
        </footer>
      </article>
    </main>
  );
}
