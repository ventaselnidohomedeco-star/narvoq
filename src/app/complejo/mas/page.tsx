import Link from 'next/link';

const items = [
  { href: '/complejo/perfil', icon: 'CFG', title: 'Perfil del complejo', desc: 'Logo, fotos, redes, pagos, horarios y servicios' },
  { href: '/complejo/empleados', icon: '👥', title: 'Equipo', desc: 'Sumá empleados para gestionar calendario y aprobaciones' },
  { href: '/complejo/rentabilidad', icon: '$', title: 'Rentabilidad', desc: 'Ocupación y facturación por cancha + descuentos por baja demanda' },
  { href: '/smash', icon: '💬', title: 'Smashe@', desc: 'Chat efímero (24hs) con jugadores y otros complejos' },
  { href: '/complejo/amigos', icon: 'RED', title: 'Comunidad', desc: 'Buscá y seguí jugadores, profes u otros complejos' },
  { href: '/marketplace', icon: 'MKT', title: 'Marketplace', desc: 'Comprá y vendé paletas, ropa y accesorios' },
  { href: '/complejo/clientes', icon: 'CLI', title: 'Clientes', desc: 'Historial, frecuentes y facturacion' },
  { href: '/complejo/entrenamientos', icon: 'TR', title: 'Entrenamientos', desc: 'Registro tecnico, tareas y dashboard por jugador' },
  { href: '/complejo/jugadores', icon: 'RK', title: 'Observar y ascender', desc: 'Ranking interno, candidatos y ascensos' },
  { href: '/complejo/socios', icon: 'MEM', title: 'Membresias', desc: 'Planes, solicitudes, comprobantes y socios' },
  { href: '/complejo/canchas', icon: 'CAN', title: 'Canchas', desc: 'Fotos, precios y descripciones' }
];

export default function Mas() {
  return (
    <main className="px-5 py-6">
      <h1 className="font-display font-black text-xl">Mas</h1>
      <div className="mt-4 space-y-3">
        {items.map(i => (
          <Link key={i.href} href={i.href} className="bg-white/5 rounded-2xl p-4 flex items-center gap-4">
            <span className="w-11 h-11 rounded-xl bg-white/10 text-ball font-display font-black flex items-center justify-center text-xs">{i.icon}</span>
            <span className="flex-1">
              <span className="font-display font-bold block">{i.title}</span>
              <span className="text-white/50 text-sm">{i.desc}</span>
            </span>
            <span className="text-ball font-black">+</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
