'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { notify } from '@/lib/notify';

export default function Socios() {
  const [cx, setCx] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [f, setF] = useState({ name: '', price: '', benefits: '' });
  const [newMember, setNewMember] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: complex } = await supabase.from('complexes').select('*').eq('owner_id', user!.id).single();
    setCx(complex);
    const { data } = await supabase.from('memberships')
      .select('*, members:membership_members(status, payment_status, payment_proof_url, since, player:profiles!player_id(id, username, first_name, last_name, avatar_url, phone))')
      .eq('complex_id', complex.id).order('created_at');
    setPlans(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function crear() {
    setError('');
    if (!f.name.trim()) return setError('Pone un nombre al plan.');
    const { error: err } = await supabase.from('memberships').insert({
      complex_id: cx.id,
      name: f.name.trim(),
      price: Number(f.price || 0),
      benefits: f.benefits.trim() || null
    });
    if (err) return setError(`${err.message}. Ejecutaste update-06-pro.sql y update-08-pagos-entrenamientos.sql?`);
    setF({ name: '', price: '', benefits: '' }); load();
  }

  async function agregarSocio(plan: any) {
    setError('');
    const username = (newMember[plan.id] ?? '').toLowerCase().trim();
    if (!username) return;
    const { data: p } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
    if (!p) return setError(`No existe el usuario "${username}".`);
    const { error: err } = await supabase.from('membership_members')
      .insert({ membership_id: plan.id, player_id: p.id, status: 'activa', payment_status: 'pagado' });
    if (err) return setError('Ese jugador ya es socio de este plan.');
    setNewMember({ ...newMember, [plan.id]: '' }); load();
  }

  async function quitarSocio(plan: any, pid: string) {
    await supabase.from('membership_members').delete()
      .eq('membership_id', plan.id).eq('player_id', pid);
    load();
  }

  async function togglePlan(plan: any) {
    await supabase.from('memberships').update({ active: !plan.active }).eq('id', plan.id);
    load();
  }

  async function aprobarSocio(plan: any, pid: string) {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('membership_members').update({
      status: 'activa',
      payment_status: 'pagado',
      payment_confirmed_at: new Date().toISOString(),
      payment_confirmed_by: user!.id
    }).eq('membership_id', plan.id).eq('player_id', pid);
    await notify({
      user_id: pid, kind: 'membresia_ok',
      title: `Membresía confirmada en ${cx?.name ?? 'el complejo'}`,
      body: `Ya sos socio del plan ${plan.name}.`,
      link: `/club/${cx.id}`
    });
    load();
  }

  if (!cx) return <main className="p-8 text-white/70">Cargando...</main>;

  return (
    <main className="px-5 py-6">
      <h1 className="font-display font-black text-xl">Membresias y socios</h1>

      <section className="mt-4 bg-white/5 rounded-2xl p-4 space-y-3">
        <p className="font-display font-bold text-ball text-sm">Crear plan de socio</p>
        <div className="grid grid-cols-2 gap-3">
          <input className="input" placeholder="Nombre (ej: Socio Full)"
            value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
          <input className="input" type="number" placeholder="Costo mensual $"
            value={f.price} onChange={e => setF({ ...f, price: e.target.value })} />
        </div>
        <textarea className="input resize-none" rows={2}
          placeholder="Beneficios: 10% off en turnos, prioridad en torneos, 1 clase grupal por mes..."
          value={f.benefits} onChange={e => setF({ ...f, benefits: e.target.value })} />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button onClick={crear} className="btn-ball w-full text-sm">Crear membresia</button>
      </section>

      <section className="mt-4 space-y-3">
        {plans.map(plan => {
          const pending = plan.members.filter((m: any) => m.status !== 'activa');
          return (
            <div key={plan.id} className="bg-white/5 rounded-2xl p-4">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="font-display font-black">
                    {plan.name} <span className="text-ball">${Number(plan.price).toLocaleString('es-AR')}/mes</span>
                  </p>
                  {plan.benefits && <p className="text-white/60 text-sm mt-0.5">{plan.benefits}</p>}
                </div>
                <button onClick={() => togglePlan(plan)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg shrink-0 ${plan.active ? 'bg-ball text-courtdark' : 'bg-white/10 text-white/50'}`}>
                  {plan.active ? 'Activo' : 'Pausado'}
                </button>
              </div>

              <p className="text-white/40 text-xs font-bold mt-3 uppercase">Socios ({plan.members.length})</p>
              <ul className="mt-1 space-y-1.5">
                {plan.members.map((m: any) => (
                  <li key={m.player.id} className="flex items-center gap-2 text-sm">
                    {m.player.avatar_url
                      ? <img src={m.player.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                      : <span className="w-7 h-7 rounded-full bg-court text-xs font-display font-black flex items-center justify-center">{m.player.first_name[0]}</span>}
                    <span className="flex-1 truncate">{m.player.first_name} {m.player.last_name}</span>
                    {m.status !== 'activa' && <span className="text-[10px] font-black text-yellow-300">PEND</span>}
                    <button onClick={() => quitarSocio(plan, m.player.id)} className="text-white/40 text-xs">x</button>
                  </li>
                ))}
              </ul>

              {pending.map((m: any) => (
                <div key={`proof-${m.player.id}`} className="mt-3 rounded-2xl bg-white/5 p-3">
                  <p className="text-sm font-semibold">{m.player.first_name} {m.player.last_name} solicito esta membresia</p>
                  {m.payment_proof_url
                    ? <a href={m.payment_proof_url} target="_blank">
                        <img src={m.payment_proof_url} alt="Comprobante de membresia" className="mt-2 rounded-xl w-full max-h-60 object-cover" />
                      </a>
                    : <p className="text-yellow-300 text-xs mt-1">Todavia no subio comprobante.</p>}
                  {m.payment_proof_url && (
                    <button onClick={() => aprobarSocio(plan, m.player.id)} className="btn-ball w-full mt-2 text-sm">
                      Aprobar membresia y marcar pagada
                    </button>
                  )}
                </div>
              ))}

              <div className="flex gap-2 mt-2">
                <input className="input !py-2 text-sm" placeholder="Usuario del jugador"
                  value={newMember[plan.id] ?? ''}
                  onChange={e => setNewMember({ ...newMember, [plan.id]: e.target.value })} />
                <button onClick={() => agregarSocio(plan)} className="btn-ball !py-2 text-sm shrink-0">+ Socio</button>
              </div>
            </div>
          );
        })}
        {plans.length === 0 && <p className="text-white/40 text-sm">Crea tu primer plan de socios arriba.</p>}
      </section>
    </main>
  );
}
