import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

type CookieToSet = { name: string; value: string; options?: any };

// POST /api/admin/seed-centro { center_slug: "odpro-experience" }
// Solo super_admin. Crea coaches y alumnos ficticios para demo.
export async function POST(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (all: CookieToSet[]) => all.forEach(({ name, value }) => req.cookies.set(name, value))
      }
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
  const { data: meProf } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (meProf?.role !== 'super_admin') return NextResponse.json({ error: 'solo super_admin' }, { status: 403 });

  const { center_slug } = await req.json();
  if (!center_slug) return NextResponse.json({ error: 'falta center_slug' }, { status: 400 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: centro } = await admin.from('training_centers').select('id').eq('slug', center_slug).maybeSingle();
  if (!centro) return NextResponse.json({ error: 'centro no encontrado' }, { status: 404 });

  const centerId = centro.id;

  // Coaches ficticios
  const COACHES = [
    { first: 'Diego', last: 'Cerúndolo', title: 'PRO COACH', specialty: 'Competición · Adultos · Táctica', years: 12, rate: 6000, cat: 2 },
    { first: 'Lucía', last: 'Sainz', title: 'PRO COACH', specialty: 'Menores · Técnica · Iniciación', years: 8, rate: 5000, cat: 3 },
    { first: 'Martín', last: 'Di Nenno', title: 'ASISTENTE', specialty: 'Físico · GYM', years: 4, rate: 3500, cat: 4, role: 'assistant' }
  ];
  const ALUMNOS: Array<[string, string, string, number]> = [
    ['Federico', 'Pérez', '2271456123', 4],
    ['Sofía', 'Martínez', '2271456124', 5],
    ['Juan', 'García', '2271456125', 3],
    ['Camila', 'López', '2271456126', 6],
    ['Nicolás', 'Rodríguez', '2271456127', 4],
    ['Valentina', 'Gómez', '2271456128', 5],
    ['Matías', 'Fernández', '2271456129', 3],
    ['Julieta', 'Sánchez', '2271456130', 6],
    ['Tomás', 'Ruiz', '2271456131', 5],
    ['Emma', 'Díaz', '2271456132', 7],
    ['Bruno', 'Torres', '2271456133', 4],
    ['Isabella', 'Ramírez', '2271456134', 6],
    ['Franco', 'Molina', '2271456135', 3],
    ['Delfina', 'Silva', '2271456136', 5],
    ['Santiago', 'Castro', '2271456137', 4]
  ];

  const createdIds: string[] = [];
  const results: any = { coaches: [], students: [], sessions: 0, availability: 0 };

  async function ensureUser(email: string, first: string, last: string, phone: string, category: number, role: 'player' | 'coach') {
    // Buscar si ya existe
    const { data: existing } = await admin.from('profiles').select('id').eq('phone', phone).maybeSingle();
    if (existing) return existing.id;
    // Crear en auth
    const { data: newUser, error: uErr } = await admin.auth.admin.createUser({
      email, password: 'demoODpro2026!', email_confirm: true,
      user_metadata: { first_name: first, last_name: last }
    });
    if (uErr || !newUser?.user) return null;
    // Crear profile
    const { error: pErr } = await admin.from('profiles').insert({
      id: newUser.user.id,
      first_name: first, last_name: last, phone,
      username: `${first.toLowerCase()}${last.toLowerCase().slice(0,3)}${Math.floor(Math.random()*99)}`,
      category, role, sex: 'M', locality: 'San Miguel del Monte', province: 'Buenos Aires'
    });
    if (pErr) console.error('profile err', pErr);
    return newUser.user.id;
  }

  // Coaches
  const coachIds: string[] = [];
  for (const c of COACHES) {
    const email = `demo.${c.first.toLowerCase()}.${c.last.toLowerCase()}@odpro.test`;
    const id = await ensureUser(email, c.first, c.last, `227150000${coachIds.length}`, c.cat, 'coach');
    if (!id) continue;
    coachIds.push(id);
    createdIds.push(id);
    // Insertar como coach en el centro
    await admin.from('center_members').upsert({
      center_id: centerId, profile_id: id, role: (c as any).role ?? 'coach',
      title: c.title, specialty: c.specialty, years_experience: c.years, hourly_rate: c.rate
    }, { onConflict: 'center_id,profile_id' });
    results.coaches.push({ id, first: c.first });
    // Disponibilidad: L-V 15hs-22hs
    for (const d of [1,2,3,4,5]) {
      await admin.from('weekly_availability').insert({
        profile_id: id, center_id: centerId, day_of_week: d, start_time: '15:00', end_time: '22:00'
      });
      results.availability++;
    }
  }

  // Alumnos
  const studentIds: string[] = [];
  for (const [first, last, phone, cat] of ALUMNOS) {
    const email = `demo.${first.toLowerCase()}.${last.toLowerCase()}@odpro.test`;
    const id = await ensureUser(email, first, last, phone, cat, 'player');
    if (!id) continue;
    studentIds.push(id);
    createdIds.push(id);
    const nextBilling = new Date(); nextBilling.setDate(1); nextBilling.setMonth(nextBilling.getMonth() + 1);
    await admin.from('center_members').upsert({
      center_id: centerId, profile_id: id, role: 'student',
      monthly_fee: 1000, payment_status: 'al_dia',
      next_billing_date: nextBilling.toISOString().slice(0, 10)
    }, { onConflict: 'center_id,profile_id' });
    results.students.push({ id, first });
    // Disponibilidad aleatoria: 3 días random L-Sab, 17-21hs
    const dias = [1,2,3,4,5,6].sort(() => Math.random() - 0.5).slice(0, 3);
    for (const d of dias) {
      const start = 16 + Math.floor(Math.random() * 3); // 16-18
      const end = start + 2 + Math.floor(Math.random() * 2); // 2-3hs
      await admin.from('weekly_availability').insert({
        profile_id: id, center_id: centerId, day_of_week: d,
        start_time: `${start.toString().padStart(2,'0')}:00`,
        end_time: `${Math.min(end, 23).toString().padStart(2,'0')}:00`
      });
      results.availability++;
    }
  }

  // Sesiones de los últimos 30 días
  const pilares = ['cancha', 'cancha', 'cancha', 'gym', 'psicologia', 'nutricion', 'filosofia'];
  for (let d = 0; d < 30; d++) {
    const date = new Date(); date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().slice(0, 10);
    // 3-5 sesiones por día
    const nSesiones = 3 + Math.floor(Math.random() * 3);
    for (let s = 0; s < nSesiones; s++) {
      const student = studentIds[Math.floor(Math.random() * studentIds.length)];
      const coach = coachIds[Math.floor(Math.random() * coachIds.length)];
      const pilar = pilares[Math.floor(Math.random() * pilares.length)];
      const attended = Math.random() > 0.1; // 10% ausentismo
      await admin.from('pillar_sessions').insert({
        center_id: centerId,
        student_id: student, coach_id: coach,
        pillar, date: dateStr,
        hours: 1 + (Math.random() > 0.6 ? 0.5 : 0),
        attended,
        compliance_pct: pilar === 'nutricion' ? 60 + Math.floor(Math.random() * 40) : null
      });
      results.sessions++;
    }
  }

  return NextResponse.json({ ok: true, ...results });
}
