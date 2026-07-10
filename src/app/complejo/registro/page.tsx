'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Brand from '@/components/Brand';

export default function RegistroComplejo() {
  const router = useRouter();
  const [cities, setCities] = useState<any[]>([]);
  const [f, setF] = useState({
    name: '', responsible: '', phone: '', email: '', password: '',
    city_id: '', address: '', courts: '2', open_time: '09:00', close_time: '23:59',
    slot_minutes: '90', price: '20000'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  useEffect(() => { supabase.from('cities').select('id,name').then(({ data }) => setCities(data ?? [])); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('');
    const { data, error } = await supabase.auth.signUp({ email: f.email, password: f.password });
    if (error || !data.user) { setError(error?.message ?? 'No pudimos crear la cuenta.'); setLoading(false); return; }

    await supabase.from('profiles').insert({
      id: data.user.id, role: 'complex_admin',
      username: `cx_${f.name.toLowerCase().replace(/\W+/g, '')}`.slice(0, 24),
      first_name: f.responsible.split(' ')[0] ?? f.responsible,
      last_name: f.responsible.split(' ').slice(1).join(' ') || '-',
      phone: f.phone, age: 30, sex: 'X', category: 8
    });
    const { data: cx, error: cErr } = await supabase.from('complexes').insert({
      owner_id: data.user.id, name: f.name, responsible: f.responsible,
      phone: f.phone, email: f.email, city_id: f.city_id, address: f.address,
      open_time: f.open_time, close_time: f.close_time, slot_minutes: Number(f.slot_minutes)
    }).select().single();
    if (cErr) { setError('Revisá los datos del complejo.'); setLoading(false); return; }

    const courts = Array.from({ length: Number(f.courts) }, (_, i) => ({
      complex_id: cx.id, name: `Cancha ${i + 1}`, price_per_slot: Number(f.price)
    }));
    await supabase.from('courts').insert(courts);
    router.push('/complejo/dashboard');
  }

  return (
    <main className="px-6 py-10">
      <Brand variant="full" size={36} className="mb-4" />
      <h1 className="font-display font-black text-3xl">Registrar complejo</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <input className="input" placeholder="Nombre del complejo" value={f.name} onChange={set('name')} required />
        <input className="input" placeholder="Responsable" value={f.responsible} onChange={set('responsible')} required />
        <div className="grid grid-cols-2 gap-3">
          <input className="input" placeholder="Celular" value={f.phone} onChange={set('phone')} required />
          <select className="input" value={f.city_id} onChange={set('city_id')} required>
            <option value="">Ciudad</option>
            {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <input className="input" placeholder="Dirección" value={f.address} onChange={set('address')} required />
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label text-white/60">Cant. de canchas</label>
            <input className="input" type="number" min={1} max={12} value={f.courts} onChange={set('courts')} /></div>
          <div><label className="label text-white/60">Precio por turno ($)</label>
            <input className="input" type="number" value={f.price} onChange={set('price')} /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label text-white/60">Abre</label>
            <input className="input" type="time" value={f.open_time} onChange={set('open_time')} /></div>
          <div><label className="label text-white/60">Cierra</label>
            <input className="input" type="time" value={f.close_time} onChange={set('close_time')} /></div>
          <div><label className="label text-white/60">Turno (min)</label>
            <select className="input" value={f.slot_minutes} onChange={set('slot_minutes')}>
              <option>60</option><option>90</option><option>120</option>
            </select></div>
        </div>
        <input className="input" type="email" placeholder="Email de acceso" value={f.email} onChange={set('email')} required />
        <input className="input" type="password" placeholder="Contraseña" minLength={6} value={f.password} onChange={set('password')} required />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button className="btn-ball w-full text-lg" disabled={loading}>{loading ? 'Creando…' : 'Crear complejo'}</button>
      </form>
    </main>
  );
}
