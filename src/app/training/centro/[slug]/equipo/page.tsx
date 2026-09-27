'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

const ROLES = [
  { key: 'master', label: 'Master Coach', title: 'MASTER COACH', color: 'bg-purple-500/20 text-purple-200 border-purple-500/40', icon: '⭐' },
  { key: 'coach', label: 'Coach', title: 'PRO COACH', color: 'bg-ball/20 text-ball border-ball/40', icon: '🎾' },
  { key: 'assistant', label: 'Asistente', title: 'ASISTENTE', color: 'bg-blue-500/20 text-blue-200 border-blue-500/40', icon: '📝' }
];

export default function CentroEquipo() {
  const { slug } = useParams<{ slug: string }>();
  const [centro, setCentro] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal invitación
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [chosen, setChosen] = useState<any>(null);
  const [chosenRole, setChosenRole] = useState<'coach' | 'assistant'>('coach');
  const [chosenTitle, setChosenTitle] = useState('');
  const [chosenSpecialty, setChosenSpecialty] = useState('');
  const [chosenYears, setChosenYears] = useState('');
  const [chosenRate, setChosenRate] = useState('');
  const [chosenReportsTo, setChosenReportsTo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      setMe(p);
    }
    const { data: c } = await supabase.from('training_centers').select('*').eq('slug', slug).maybeSingle();
    if (!c) { setLoading(false); return; }
    setCentro(c);
    const { data: m } = await supabase.from('center_members')
      .select('*, profile:profiles!profile_id(id, first_name, last_name, username, avatar_url, category, phone), reports:profiles!reports_to(first_name, last_name)')
      .eq('center_id', c.id)
      .in('role', ['master', 'coach', 'assistant'])
      .order('role');
    setMembers(m ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [slug]);

  // Buscar jugador para invitar
  useEffect(() => {
    if (!search.trim() || search.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const q = search.trim();
      const { data } = await supabase.from('profiles')
        .select('id, first_name, last_name, username, avatar_url, category, phone')
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,username.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(10);
      // Excluir los que ya son miembros
      const memberIds = new Set(members.map(m => m.profile_id));
      setResults((data ?? []).filter((p: any) => !memberIds.has(p.id)));
    }, 300);
    return () => clearTimeout(t);
  }, [search, members]);

  async function invitar() {
    if (!centro || !chosen) return;
    setSaving(true); setError('');
    const { error: err } = await supabase.from('center_members').insert({
      center_id: centro.id,
      profile_id: chosen.id,
      role: chosenRole,
      title: chosenTitle.trim() || (chosenRole === 'coach' ? 'PRO COACH' : 'ASISTENTE'),
      specialty: chosenSpecialty.trim() || null,
      years_experience: chosenYears ? Number(chosenYears) : null,
      hourly_rate: chosenRate ? Number(chosenRate) : null,
      reports_to: chosenReportsTo || null
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    // Limpiar y refrescar
    setAddOpen(false); setChosen(null); setSearch(''); setChosenTitle('');
    setChosenSpecialty(''); setChosenYears(''); setChosenRate(''); setChosenReportsTo('');
    load();
  }

  async function quitar(memberId: string, nombre: string) {
    if (!confirm(`¿Quitar a ${nombre} del centro?`)) return;
    await supabase.from('center_members').delete().eq('id', memberId);
    load();
  }

  if (loading) return <main className="p-8 text-white/60">Cargando…</main>;
  if (!centro) return <main className="p-8"><p className="text-white/60">Centro no encontrado</p></main>;

  const isMaster = members.some(m => m.profile_id === me?.id && m.role === 'master');
  const master = members.find(m => m.role === 'master');
  const coaches = members.filter(m => m.role === 'coach');
  const assistants = members.filter(m => m.role === 'assistant');

  return (
    <main className="min-h-dvh max-w-2xl mx-auto text-white px-5 py-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/training/centro/${slug}`} className="text-white/50 text-xs font-black">← {centro.name}</Link>
          <h1 className="font-display font-black text-2xl mt-1">👥 Equipo</h1>
          <p className="text-white/50 text-sm">{coaches.length} coaches · {assistants.length} asistentes</p>
        </div>
        {isMaster && (
          <button onClick={() => setAddOpen(true)}
            className="btn-ball !py-2 !px-4 text-sm">+ Invitar</button>
        )}
      </div>

      <div className="mt-6 space-y-6">
        {/* Master */}
        {master && (
          <section>
            <p className="text-purple-300 text-[11px] font-black tracking-widest mb-2">⭐ DIRECTOR</p>
            <PerfilCard member={master} isMaster={isMaster} onRemove={quitar} highlight="master" />
          </section>
        )}

        {/* Coaches */}
        <section>
          <p className="text-ball text-[11px] font-black tracking-widest mb-2">🎾 COACHES ({coaches.length})</p>
          {coaches.length === 0 ? (
            <p className="text-white/40 text-sm py-4 text-center bg-white/5 rounded-xl">Todavía no hay coaches</p>
          ) : (
            <div className="space-y-3">
              {coaches.map(c => <PerfilCard key={c.id} member={c} isMaster={isMaster} onRemove={quitar} highlight="coach" />)}
            </div>
          )}
        </section>

        {/* Asistentes */}
        <section>
          <p className="text-blue-300 text-[11px] font-black tracking-widest mb-2">📝 ASISTENTES ({assistants.length})</p>
          {assistants.length === 0 ? (
            <p className="text-white/40 text-sm py-4 text-center bg-white/5 rounded-xl">Todavía no hay asistentes</p>
          ) : (
            <div className="space-y-3">
              {assistants.map(a => <PerfilCard key={a.id} member={a} isMaster={isMaster} onRemove={quitar} highlight="assistant" />)}
            </div>
          )}
        </section>
      </div>

      {/* Modal invitar */}
      {addOpen && isMaster && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-end lg:items-center overflow-y-auto"
          onClick={() => { setAddOpen(false); setChosen(null); }}>
          <div className="bg-[#0B0F16] border-2 border-white/15 rounded-t-3xl lg:rounded-2xl w-full max-w-lg mx-auto p-5 pb-10"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-display font-black text-lg">➕ Invitar al equipo</p>
              <button onClick={() => { setAddOpen(false); setChosen(null); }}
                className="w-9 h-9 rounded-full bg-white/10 text-white font-bold">✕</button>
            </div>

            {!chosen ? (
              <>
                <input autoFocus type="text" className="input mt-3 w-full"
                  placeholder="🔍 Buscar por nombre, usuario o celular…"
                  value={search} onChange={e => setSearch(e.target.value)} />
                <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
                  {search.length < 2 && <p className="text-white/40 text-sm text-center py-4">Escribí al menos 2 letras…</p>}
                  {search.length >= 2 && results.length === 0 && (
                    <p className="text-white/40 text-sm text-center py-4">Sin resultados. ¿La persona ya tiene cuenta en NarvoQ?</p>
                  )}
                  {results.map(r => (
                    <button key={r.id} onClick={() => setChosen(r)}
                      className="w-full flex items-center gap-3 bg-white/5 hover:bg-white/10 rounded-xl p-3 text-left">
                      {r.avatar_url
                        ? <img src={r.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                        : <span className="w-10 h-10 rounded-full bg-grafito text-white font-black flex items-center justify-center">{r.first_name?.[0]}</span>}
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm truncate">{r.first_name} {r.last_name}</p>
                        <p className="text-white/50 text-xs truncate">@{r.username} · cat {r.category ?? '-'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="mt-3 flex items-center gap-3 bg-white/5 rounded-xl p-3">
                  {chosen.avatar_url
                    ? <img src={chosen.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                    : <span className="w-12 h-12 rounded-full bg-grafito text-white font-black text-lg flex items-center justify-center">{chosen.first_name?.[0]}</span>}
                  <div className="flex-1 min-w-0">
                    <p className="font-black">{chosen.first_name} {chosen.last_name}</p>
                    <p className="text-white/50 text-xs">@{chosen.username}</p>
                  </div>
                  <button onClick={() => setChosen(null)} className="text-white/50 text-xs font-black">Cambiar</button>
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <p className="text-white/70 text-xs font-black uppercase mb-1.5">Rango</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(['coach', 'assistant'] as const).map(r => (
                        <button key={r} onClick={() => setChosenRole(r)}
                          className={`py-2.5 rounded-xl font-black text-sm ${chosenRole === r ? 'bg-ball text-black' : 'bg-white/5 text-white/70'}`}>
                          {r === 'coach' ? '🎾 Coach' : '📝 Asistente'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-white/70 text-xs font-black uppercase mb-1.5">Título público</p>
                    <input value={chosenTitle} onChange={e => setChosenTitle(e.target.value)}
                      placeholder={chosenRole === 'coach' ? 'PRO COACH' : 'ASISTENTE'} className="input w-full" />
                  </div>

                  <div>
                    <p className="text-white/70 text-xs font-black uppercase mb-1.5">Especialidad</p>
                    <input value={chosenSpecialty} onChange={e => setChosenSpecialty(e.target.value)}
                      placeholder="Ej: Competición · Menores · Técnica" className="input w-full" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-white/70 text-xs font-black uppercase mb-1.5">Años exp.</p>
                      <input type="number" value={chosenYears} onChange={e => setChosenYears(e.target.value)}
                        placeholder="8" className="input w-full" />
                    </div>
                    <div>
                      <p className="text-white/70 text-xs font-black uppercase mb-1.5">$/hora</p>
                      <input type="number" value={chosenRate} onChange={e => setChosenRate(e.target.value)}
                        placeholder="5000" className="input w-full" />
                    </div>
                  </div>

                  {chosenRole === 'assistant' && coaches.length > 0 && (
                    <div>
                      <p className="text-white/70 text-xs font-black uppercase mb-1.5">Reporta a</p>
                      <select value={chosenReportsTo} onChange={e => setChosenReportsTo(e.target.value)}
                        className="input w-full">
                        <option value="">(Sin asignar)</option>
                        {coaches.map(c => (
                          <option key={c.profile_id} value={c.profile_id}>
                            {c.profile?.first_name} {c.profile?.last_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {error && <p className="text-red-300 text-sm">{error}</p>}

                  <button onClick={invitar} disabled={saving}
                    className="btn-ball w-full mt-2 disabled:opacity-50">
                    {saving ? 'Agregando…' : `+ Agregar como ${chosenRole === 'coach' ? 'Coach' : 'Asistente'}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function PerfilCard({ member, isMaster, onRemove, highlight }: {
  member: any; isMaster: boolean; onRemove: (id: string, nombre: string) => void; highlight: string;
}) {
  const p = member.profile;
  if (!p) return null;
  const nombre = `${p.first_name} ${p.last_name ?? ''}`.trim();
  const titleColor = highlight === 'master' ? 'text-purple-300' : highlight === 'coach' ? 'text-ball' : 'text-blue-300';
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4 relative">
      {isMaster && member.role !== 'master' && (
        <button onClick={() => onRemove(member.id, nombre)}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500/20 text-red-300 text-xs font-bold">✕</button>
      )}
      <div className="flex items-start gap-3">
        {p.avatar_url
          ? <img src={p.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover shrink-0" />
          : <span className="w-16 h-16 rounded-full bg-grafito text-white font-display font-black text-2xl flex items-center justify-center shrink-0">
              {p.first_name?.[0]}
            </span>}
        <div className="flex-1 min-w-0">
          <p className="font-display font-black text-lg leading-tight">{nombre}</p>
          <p className={`${titleColor} text-[11px] font-black tracking-widest mt-0.5`}>
            {highlight === 'master' && '⭐ '}{member.title ?? 'COACH'}
          </p>
          {member.specialty && <p className="text-white/80 text-sm mt-1.5">{member.specialty}</p>}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-white/60 text-xs">
            {p.category != null && <span>🎾 Jugador cat. {p.category}</span>}
            {member.years_experience && <span>📅 {member.years_experience} años exp.</span>}
            {member.hourly_rate && <span>💰 ${Number(member.hourly_rate).toLocaleString('es-AR')}/h</span>}
          </div>
          {member.reports && (
            <p className="text-white/50 text-[11px] mt-1.5">↑ Reporta a {member.reports.first_name} {member.reports.last_name}</p>
          )}
          {p.phone && (
            <a href={`https://wa.me/${p.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener"
              className="inline-flex items-center gap-1 mt-2 text-emerald-300 text-xs font-black">
              💬 WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
