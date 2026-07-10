import Link from 'next/link';
import Brand from '@/components/Brand';

export default function Landing() {
  return (
    <main className="min-h-dvh bg-[#0B0F16] text-white flex flex-col overflow-hidden relative">
      {/* Diagonales lima de marca */}
      <div className="absolute -right-10 -top-16 w-16 h-[420px] bg-ball rotate-[24deg]" />
      <div className="absolute right-14 -top-16 w-5 h-[320px] bg-ball/40 rotate-[24deg]" />
      {/* Pelota con volumen */}
      <div className="absolute -left-16 bottom-40 w-56 h-56 rounded-full opacity-90"
        style={{ background: 'radial-gradient(circle at 32% 30%, #F4FF9E 0%, #DCEF52 35%, #A8C22E 72%, #5F7414 100%)' }} />

      <div className="relative flex-1 flex flex-col justify-center px-6 max-w-md mx-auto w-full">
        <Brand variant="full" size={44} />
        <span className="font-display font-bold text-white/40 text-xs tracking-[0.3em] mt-2">ELEVATE YOUR GAME · ELEVATE YOUR LIFE</span>
        <h1 className="font-display font-black text-5xl leading-[1.05] mt-6 uppercase">
          Reservá.<br />Jugá.<br /><span className="text-ball">Subí en el ranking.</span>
        </h1>
        <p className="mt-4 text-white/60 text-lg max-w-sm">
          Canchas, partidos con amigos, torneos con fixture automático y el ranking de tu ciudad.
        </p>
        <div className="mt-8 flex flex-col gap-3 max-w-sm relative z-10">
          <Link href="/registro" className="btn-ball text-center text-lg">Crear cuenta de jugador</Link>
          <Link href="/login" className="text-center py-3 rounded-xl border border-white/15 font-semibold">
            Ya tengo cuenta
          </Link>
        </div>
      </div>
      <footer className="relative px-6 py-5 border-t border-white/10 max-w-md mx-auto w-full space-y-2">
        <Link href="/complejo/login" className="block text-ball font-semibold">
          ¿Tenés un complejo de pádel? Entrá acá →
        </Link>
        <Link href="/training/login" className="block text-ball font-semibold">
          ¿Sos profe / entrenador? Ingresá al portal Training →
        </Link>
      </footer>
    </main>
  );
}
