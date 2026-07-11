import Link from 'next/link';
import Brand from '@/components/Brand';
import InstallButton from '@/components/InstallButton';

export default function Landing() {
  return (
    <main className="min-h-dvh bg-[#0B0F16] text-white overflow-x-hidden">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-[#0B0F16]/95 backdrop-blur border-b border-white/5">
        <div className="max-w-md mx-auto flex items-center justify-between px-5 py-3">
          <Brand variant="inline" size={26} />
          <div className="flex items-center gap-2">
            <InstallButton variant="ghost" />
            <Link href="/login" className="text-white/60 text-sm font-bold px-3 py-2">Entrar</Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute -right-10 -top-16 w-16 h-[420px] bg-ball rotate-[24deg] opacity-90" />
        <div className="absolute right-14 -top-16 w-5 h-[320px] bg-ball/40 rotate-[24deg]" />
        <div className="absolute -left-16 bottom-10 w-56 h-56 rounded-full opacity-70"
          style={{ background: 'radial-gradient(circle at 32% 30%, #F4FF9E 0%, #DCEF52 35%, #A8C22E 72%, #5F7414 100%)' }} />

        <div className="relative max-w-md mx-auto px-6 pt-8 pb-10">
          <span className="font-display font-bold text-white/40 text-xs tracking-[0.3em]">ELEVÁ TU JUEGO · ELEVÁ TU NIVEL</span>
          <h1 className="font-display font-black text-5xl leading-[1.05] mt-4 uppercase">
            Reservá.<br />Jugá.<br /><span className="text-ball">Subí en el ranking.</span>
          </h1>
          <p className="mt-4 text-white/70 text-base max-w-sm">
            Canchas, partidos con amigos, torneos con fixture automático, entrenamientos y ranking de tu ciudad.
            Todo en una app.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <InstallButton variant="primary" className="w-full !justify-center" />
            <Link href="/registro" className="bg-white/10 text-white font-display font-black rounded-xl px-5 py-3 text-center">Crear cuenta gratis</Link>
          </div>
        </div>
      </section>

      {/* JUGADOR */}
      <section className="max-w-md mx-auto px-6 py-10">
        <p className="text-ball text-xs font-black tracking-widest">PARA VOS QUE JUGÁS</p>
        <h2 className="font-display font-black text-3xl mt-1 leading-tight">Tu pádel, ordenado en un solo lugar.</h2>

        <div className="mt-6 space-y-4">
          <Beneficio emoji="🎾" title="Reservá tu cancha en 3 toques" text="Buscá por ciudad y complejo, ves qué horarios están libres y reservás sin llamar ni escribir." />
          <Beneficio emoji="🤝" title="Armá el partido con tus amigos" text="Compartís un link, tus amigos se suman y quedan avisados del turno. Lista de espera automática." />
          <Beneficio emoji="🥇" title="Torneos con fixture automático" text="Anotate en cualquier torneo de tu zona. La app arma zonas y cruces sola." />
          <Beneficio emoji="📊" title="Ranking real de tu localidad" text="Ganás torneos, subís puntos. Filtrás por categoría, sexo, ciudad o complejo." />
          <Beneficio emoji="🎓" title="Entrenamientos con tu profe" text="Tu profe carga la sesión: foco, tarea y evaluación. Vos lo ves y seguís tu progreso." />
          <Beneficio emoji="🛒" title="Marketplace de la comunidad" text="Vendé o comprá paletas, ropa y accesorios directo entre jugadores." />
        </div>

        {/* Mocks visuales */}
        <div className="mt-8 space-y-3">
          <MockTitle>Ejemplos de lo que vas a ver:</MockTitle>
          <MockReserva />
          <MockRanking />
          <MockStats />
          <MockFixture />
        </div>
      </section>

      {/* COMPLEJO */}
      <section className="max-w-md mx-auto px-6 py-10 border-t border-white/5">
        <p className="text-ball text-xs font-black tracking-widest">SI TENÉS COMPLEJO</p>
        <h2 className="font-display font-black text-3xl mt-1 leading-tight">Menos WhatsApps, más canchas llenas.</h2>

        <div className="mt-6 space-y-4">
          <Beneficio emoji="📅" title="Calendario 7 días × canchas" text="Ves todos los turnos de tu complejo en una sola grilla. Cargás bloqueos y reservas manuales." />
          <Beneficio emoji="✅" title="Aprobás pagos por transferencia" text="El jugador sube el comprobante, vos lo mirás y aprobás con un tap. Se avisa solo." />
          <Beneficio emoji="🏆" title="Publicás torneos con plantillas" text="Suma 13, Cat. 4ta, mixto… Elegís y ya. Se abre inscripción y llegan los pagos." />
          <Beneficio emoji="👥" title="Membresías y socios" text="Planes de socio con beneficios, cobrás por transferencia, controlás vencimientos." />
          <Beneficio emoji="📢" title="Publicás promos al feed" text="Happy hour, evento, torneo abierto. Tus clientes lo ven en el feed y se anotan." />
        </div>

        <Link href="/complejo/login"
          className="mt-6 block text-center bg-grafito text-ball font-display font-black rounded-xl py-4">
          Entrar al portal de complejos →
        </Link>
      </section>

      {/* PROFE */}
      <section className="max-w-md mx-auto px-6 py-10 border-t border-white/5">
        <p className="text-ball text-xs font-black tracking-widest">SI SOS PROFE</p>
        <h2 className="font-display font-black text-3xl mt-1 leading-tight">Un dashboard por alumno. En serio.</h2>

        <div className="mt-6 space-y-4">
          <Beneficio emoji="👨‍🏫" title="Registrás sesiones por alumno" text="Tipo de clase, foco técnico, tarea y evaluación 0-10 en técnica, táctica y físico." />
          <Beneficio emoji="📈" title="Ves el progreso del grupo" text="Métricas de los últimos 30 días: sesiones, minutos, promedio de intensidad y balance técnico." />
          <Beneficio emoji="📤" title="Compartís el dashboard con tu alumno" text="Un botón: le mandás su progreso al alumno por WhatsApp o link. Él lo ve en su propia cuenta." />
        </div>

        <Link href="/training/login"
          className="mt-6 block text-center bg-ball text-courtdark font-display font-black rounded-xl py-4">
          Entrar al portal Training →
        </Link>
      </section>

      {/* CTA final */}
      <section className="max-w-md mx-auto px-6 py-10 border-t border-white/5 text-center">
        <p className="font-display font-black text-3xl leading-tight">Instalá Narvoq y arrancá.</p>
        <p className="text-white/60 text-sm mt-2">Gratis. Sin descargar de tienda. Ocupa lo mismo que 3 fotos.</p>
        <div className="mt-6 flex flex-col gap-3">
          <InstallButton variant="primary" className="w-full !justify-center" />
          <Link href="/registro" className="bg-white/10 text-white font-display font-black rounded-xl px-5 py-3">Crear cuenta gratis</Link>
          <Link href="/login" className="text-white/60 text-sm underline">Ya tengo cuenta</Link>
        </div>
      </section>

      <footer className="max-w-md mx-auto px-6 py-6 text-center text-white/30 text-xs border-t border-white/5">
        © {new Date().getFullYear()} Narvoq · Elevá tu juego. Elevá tu nivel.
      </footer>
    </main>
  );
}

function Beneficio({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center text-2xl shrink-0">{emoji}</span>
      <div>
        <p className="font-display font-black text-base">{title}</p>
        <p className="text-white/60 text-sm mt-0.5">{text}</p>
      </div>
    </div>
  );
}

function MockTitle({ children }: any) {
  return <p className="font-display font-black text-ball text-xs tracking-widest">{children}</p>;
}

/* ===== MOCKS: cards que representan lo que verá el usuario adentro ===== */

function MockReserva() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#141A24] p-4">
      <p className="text-white/40 text-[10px] font-bold uppercase">Reservar cancha · San Miguel del Monte</p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {['19:00', '20:30', '21:00'].map((h, i) => (
          <div key={h} className={`py-3 rounded-xl font-display font-black text-sm
            ${i === 2 ? 'bg-ball text-courtdark' : 'bg-white/5 text-white/60'}`}>
            {h}
          </div>
        ))}
      </div>
      <p className="text-white/50 text-xs mt-2">Cancha 2 · Techada · $18.000 · Hoy</p>
    </div>
  );
}

function MockRanking() {
  const players = [
    { n: 'JP', name: 'Juan P.', pts: 342, cat: 3 },
    { n: 'MG', name: 'María G.', pts: 298, cat: 3 },
    { n: 'FR', name: 'Fede R.', pts: 271, cat: 4 }
  ];
  return (
    <div className="rounded-2xl border border-white/10 bg-[#141A24] p-4">
      <p className="text-white/40 text-[10px] font-bold uppercase">Ranking zonal · Cat. 3–4</p>
      <div className="mt-3 space-y-2">
        {players.map((p, i) => (
          <div key={p.n} className="flex items-center gap-3">
            <span className={`font-display font-black w-6 text-center ${i === 0 ? 'text-ball' : 'text-white/60'}`}>{i + 1}</span>
            <span className="w-8 h-8 rounded-full bg-grafito text-ball flex items-center justify-center text-xs font-black">{p.n}</span>
            <span className="flex-1 text-sm font-semibold">{p.name}</span>
            <span className="text-ball font-display font-black text-sm">{p.pts} pts</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockStats() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#141A24] p-4">
      <p className="text-white/40 text-[10px] font-bold uppercase">Tus estadísticas · últimos 30 días</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat n="18" l="Jugados" />
        <Stat n="12" l="Ganados" />
        <Stat n="342" l="Pts. torneo" />
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-[10px] font-bold text-white/60"><span>TÉCNICA</span><span>7/10</span></div>
        <div className="mt-1 h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-ball" style={{ width: '70%' }} /></div>
      </div>
    </div>
  );
}

function Stat({ n, l }: any) {
  return (
    <div className="text-center bg-white/5 rounded-xl py-2">
      <p className="font-display font-black text-2xl text-ball">{n}</p>
      <p className="text-white/50 text-[9px] font-bold uppercase">{l}</p>
    </div>
  );
}

function MockFixture() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#141A24] p-4">
      <p className="text-white/40 text-[10px] font-bold uppercase">Torneo Suma 13 · Zona A</p>
      <div className="mt-3 space-y-2">
        {[
          { a: 'Juan & Mati', b: 'Fede & Pablo', score: '6-4  6-2' },
          { a: 'Sofi & Cami', b: 'Nico & Lucho', score: '6-1  6-3' }
        ].map((m, i) => (
          <div key={i} className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 text-xs">
            <span className="flex-1 font-semibold">{m.a}</span>
            <span className="text-ball font-display font-black">{m.score}</span>
            <span className="flex-1 text-right text-white/50">{m.b}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
