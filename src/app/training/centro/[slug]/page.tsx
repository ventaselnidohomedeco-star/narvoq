'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

export default function CentroPanel() {
  const { slug } = useParams<{ slug: string }>();
  const [me, setMe] = useState<any>(null);
  const [centro, setCentro] = useState<any>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [stats, setStats] = useState({ coaches: 0, assistants: 0, students: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
        setMe(p);
      }
      const { data: c } = await supabase.from('training_centers')
        .select('*').eq('slug', slug).maybeSingle();
      if (!c) { setLoading(false); return; }
      setCentro(c);

      if (user) {
        const { data: cm } = await supabase.from('center_members')
          .select('role').eq('center_id', c.id).eq('profile_id', user.id).maybeSingle();
        setMyRole(cm?.role ?? null);
      }

      // Contar miembros por rol
      const { data: members } = await supabase.from('center_members')
        .select('role').eq('center_id', c.id).eq('active', true);
      const s = { coaches: 0, assistants: 0, students: 0 };
      (members ?? []).forEach((m: any) => {
        if (m.role === 'coach') s.coaches++;
        else if (m.role === 'assistant') s.assistants++;
        else if (m.role === 'student') s.students++;
      });
      setStats(s);
      setLoading(false);
    })();
  }, [slug]);

  if (loading) return <main className="p-8 text-white/60">Cargando centro…</main>;
  if (!centro) return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-8 text-center">
      <span className="text-6xl">🏫</span>
      <p className="mt-4 text-xl font-black">Centro no encontrado</p>
      <Link href="/training/dashboard" className="mt-6 text-ball font-black">← Volver</Link>
    </main>
  );

  const isMaster = myRole === 'master';
  const isStaff = myRole === 'master' || myRole === 'coach' || myRole === 'assistant';

  return (
    <main className="min-h-dvh max-w-2xl mx-auto text-white pb-16">
      {/* Portada */}
      <div className="relative">
        {centro.cover_url ? (
          <img src={centro.cover_url} alt="" className="w-full h-48 object-cover" />
        ) : (
          <div className="w-full h-48 bg-gradient-to-br from-ball/30 to-grafito" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5 flex items-end gap-3">
          {centro.logo_url ? (
            <img src={centro.logo_url} alt="" className="w-20 h-20 rounded-2xl object-cover border-2 border-white/20 shrink-0" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-ball/20 flex items-center justify-center text-3xl shrink-0">🏫</div>
          )}
          <div className="min-w-0">
            <p className="text-ball text-[11px] font-black tracking-widest">CENTRO DE ENTRENAMIENTO</p>
            <h1 className="font-display font-black text-2xl leading-tight">{centro.name}</h1>
            {centro.brand && <p className="text-white/70 text-sm">{centro.brand}</p>}
          </div>
        </div>
      </div>

      <div className="px-5 pt-5 space-y-4">
        {centro.address && (
          <p className="text-white/70 text-sm">📍 {centro.address}{centro.locality ? `, ${centro.locality}` : ''}</p>
        )}
        {centro.bio && <p className="text-white/80 text-sm">{centro.bio}</p>}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
            <p className="font-display font-black text-2xl text-ball">{stats.students}</p>
            <p className="text-white/60 text-[10px] font-black uppercase mt-0.5">Alumnos</p>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
            <p className="font-display font-black text-2xl text-ball">{stats.coaches}</p>
            <p className="text-white/60 text-[10px] font-black uppercase mt-0.5">Coaches</p>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
            <p className="font-display font-black text-2xl text-ball">{stats.assistants}</p>
            <p className="text-white/60 text-[10px] font-black uppercase mt-0.5">Asistentes</p>
          </div>
        </div>

        {/* Acciones según rol */}
        {isMaster && (
          <div className="mt-4">
            <p className="text-ball text-[11px] font-black tracking-widest mb-2">PANEL DE MASTER</p>
            <div className="grid grid-cols-2 gap-2">
              <Link href={`/training/centro/${slug}/equipo`} className="rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 p-4">
                <p className="text-2xl">👥</p>
                <p className="font-black text-sm mt-1">Equipo</p>
                <p className="text-white/50 text-[11px]">Invitar coaches y asistentes</p>
              </Link>
              <Link href={`/training/centro/${slug}/alumnos`} className="rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 p-4">
                <p className="text-2xl">🎓</p>
                <p className="font-black text-sm mt-1">Alumnos</p>
                <p className="text-white/50 text-[11px]">Alta y seguimiento</p>
              </Link>
              <Link href={`/training/centro/${slug}/coordinar`} className="rounded-xl bg-ball/10 hover:bg-ball/20 border border-ball/40 p-4">
                <p className="text-2xl">✨</p>
                <p className="font-black text-sm mt-1 text-ball">Coordinar turno</p>
                <p className="text-white/60 text-[11px]">Cross-info mágico</p>
              </Link>
              <Link href={`/training/centro/${slug}/dashboard`} className="rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 p-4">
                <p className="text-2xl">📊</p>
                <p className="font-black text-sm mt-1">Dashboard</p>
                <p className="text-white/50 text-[11px]">Ingresos, ausentismo, KPIs</p>
              </Link>
              <Link href={`/training/centro/${slug}/pilares`} className="rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 p-4">
                <p className="text-2xl">🏋️</p>
                <p className="font-black text-sm mt-1">Pilares</p>
                <p className="text-white/50 text-[11px]">Registrar sesiones</p>
              </Link>
              <div className="rounded-xl bg-white/5 border border-white/10 p-4 opacity-50">
                <p className="text-2xl">💰</p>
                <p className="font-black text-sm mt-1">Bonos</p>
                <p className="text-white/40 text-[11px]">Próximamente</p>
              </div>
            </div>
          </div>
        )}

        {!isMaster && isStaff && (
          <div className="mt-4">
            <p className="text-ball text-[11px] font-black tracking-widest mb-2">PANEL DE {myRole?.toUpperCase()}</p>
            <div className="grid grid-cols-2 gap-2">
              <Link href={`/training/centro/${slug}/alumnos`} className="rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 p-4">
                <p className="text-2xl">🎓</p>
                <p className="font-black text-sm mt-1">Mis alumnos</p>
              </Link>
              <Link href={`/training/centro/${slug}/pilares`} className="rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 p-4">
                <p className="text-2xl">🏋️</p>
                <p className="font-black text-sm mt-1">Registrar sesión</p>
              </Link>
            </div>
          </div>
        )}

        {!isStaff && me && (
          <div className="mt-4 rounded-2xl bg-ball/10 border border-ball/30 p-5">
            <p className="font-black text-ball">¿Sos alumno del centro?</p>
            <p className="text-white/70 text-sm mt-1">Pedile al Master Coach que te agregue con tu usuario <b className="text-white">@{me.username}</b></p>
          </div>
        )}

        {/* Botón SEED demo (solo super_admin) */}
        {me?.role === 'super_admin' && (
          <div className="mt-6 rounded-2xl bg-purple-500/10 border border-purple-500/40 p-4">
            <p className="text-purple-300 text-[11px] font-black tracking-widest">🧪 SUPER ADMIN · DEMO ODPRO</p>
            <p className="font-black mt-1">Cargar simulacro completo</p>
            <p className="text-white/60 text-xs mt-1 mb-3">
              • 1 Master (Marcelo Terre) + 4 Coaches con dispos variadas<br/>
              • 70 alumnos categoría 5-8 con horarios de entrenamiento<br/>
              • ~1200 sesiones de los últimos 60 días en los 5 pilares<br/>
              • Vinculación automática con las canchas de tu complejo<br/>
              <b className="text-yellow-300">⚠ Limpia y vuelve a cargar si ya hay demo</b>
            </p>
            <button onClick={async () => {
              if (!confirm('¿Cargar DEMO completo? Esto borra y reemplaza cualquier dato DEMO previo. Puede tardar ~1-2 min.')) return;
              const btn = document.activeElement as HTMLButtonElement;
              if (btn) { btn.disabled = true; btn.textContent = '⏳ Cargando (puede tardar 1-2 min)…'; }
              const r = await fetch('/api/admin/seed-centro', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ center_slug: slug, clean: true })
              });
              const j = await r.json();
              if (!r.ok) { alert('Error: ' + (j.error ?? 'desconocido')); if (btn) btn.disabled = false; return; }
              alert(`✓ DEMO cargado:\n\n👥 ${j.coaches ?? 0} coaches\n🎓 ${j.students ?? 0} alumnos\n🏋️ ${j.sessions ?? 0} sesiones\n⏰ ${j.availability ?? 0} horarios de dispo\n🏟 Complejo vinculado: ${j.complex_linked ? '✓ sí' : '✕ no'}\n\nAndá a Coordinar turno y probá!`);
              window.location.reload();
            }}
              className="w-full py-3 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-200 font-black text-sm active:scale-95 transition">
              🚀 Cargar simulacro ODpro (1-2 min)
            </button>

            <Link href={`/training/centro/${slug}/demo-usuarios`}
              className="mt-3 block text-center py-3 rounded-xl bg-blue-500/15 border border-blue-500/40 text-blue-200 font-black text-sm active:scale-95 transition">
              🧪 Ver credenciales de usuarios DEMO →
            </Link>
            <p className="text-white/50 text-[11px] text-center mt-2">
              Loguéate con cada rol para ver todas las vistas
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
