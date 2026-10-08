import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

type CookieToSet = { name: string; value: string; options?: any };

// POST /api/admin/seed-centro { center_slug: "master-padel-centro-de-entranamiento", clean: true? }
// Solo super_admin. Carga demo DURA: 1 Master 100%, 4 Coaches, 70 alumnos cat 5-8, 60d de sesiones.
// Si el centro tiene complex_id, también lo cruza con las canchas del complejo.
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

  const { center_slug, clean = true } = await req.json();
  if (!center_slug) return NextResponse.json({ error: 'falta center_slug' }, { status: 400 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: centro } = await admin.from('training_centers').select('id, complex_id').eq('slug', center_slug).maybeSingle();
  if (!centro) return NextResponse.json({ error: 'centro no encontrado' }, { status: 404 });
  const centerId = centro.id;

  // Si el centro no tiene complex_id, lo asociamos al complejo del super_admin si lo tiene
  let complexId: string | null = centro.complex_id;
  if (!complexId) {
    const { data: cx } = await admin.from('complexes').select('id').eq('owner_id', user.id).maybeSingle();
    if (cx) {
      complexId = cx.id;
      await admin.from('training_centers').update({ complex_id: cx.id }).eq('id', centerId);
    }
  }

  // Limpieza previa de demo
  if (clean) {
    const { data: oldMembers } = await admin.from('center_members').select('profile_id')
      .eq('center_id', centerId);
    const ids = (oldMembers ?? []).map((m: any) => m.profile_id);
    if (ids.length > 0) {
      // Borrar sesiones
      await admin.from('pillar_sessions').delete().eq('center_id', centerId);
      // Borrar disponibilidades
      await admin.from('weekly_availability').delete().eq('center_id', centerId);
      // Borrar members (excepto el master real que creó el centro, para no romper su acceso)
      await admin.from('center_members').delete().eq('center_id', centerId).neq('role', 'master');
      // Borrar profiles demo (que terminan en @odpro.test)
      const { data: demoProfs } = await admin.from('profiles').select('id').in('id', ids);
      for (const p of (demoProfs ?? [])) {
        try {
          const { data: u } = await admin.auth.admin.getUserById(p.id);
          if (u?.user?.email?.endsWith('@odpro.test')) {
            await admin.auth.admin.deleteUser(p.id);
          }
        } catch {}
      }
    }
  }

  // ============ STAFF ============
  // 1 Master (100% dispo L-D 8-22) + 4 coaches con dispos variadas
  const STAFF: Array<{ first: string; last: string; role: 'master' | 'coach'; title: string; specialty: string; years: number; rate: number; cat: number; days: number[]; hours: [number, number] }> = [
    { first: 'Marcelo',  last: 'Terre',       role: 'master', title: 'MASTER COACH ⭐', specialty: 'Director · Competición · Formación integral', years: 20, rate: 15000, cat: 1, days: [1,2,3,4,5,6,0], hours: [8, 22] },
    { first: 'Lucas',    last: 'Bergamín',    role: 'coach',  title: 'PRO COACH',       specialty: 'Competición · Adultos · Táctica',             years: 12, rate: 8000,  cat: 2, days: [1,2,3,4,5],      hours: [15, 22] },
    { first: 'Carolina', last: 'Navarro',     role: 'coach',  title: 'PRO COACH',       specialty: 'Menores · Técnica · Iniciación',              years: 8,  rate: 7000,  cat: 3, days: [1,3,5,6],        hours: [9, 18] },
    { first: 'Agustín',  last: 'Tapia',       role: 'coach',  title: 'COACH',           specialty: 'Físico · GYM · Preparación',                  years: 6,  rate: 6000,  cat: 3, days: [2,4,6],          hours: [10, 20] },
    { first: 'Delfina',  last: 'Brea',        role: 'coach',  title: 'COACH',           specialty: 'Mujeres · Mini padel · Perfeccionamiento',    years: 5,  rate: 6500,  cat: 4, days: [1,2,4,5,6],      hours: [16, 22] }
  ];

  // ============ ALUMNOS (70) ============
  const NOMBRES_M = ['Federico','Juan','Nicolás','Matías','Tomás','Bruno','Franco','Santiago','Lautaro','Benjamín','Agustín','Ignacio','Facundo','Joaquín','Mateo','Felipe','Dante','Thiago','Ciro','Valentín','Bautista','Lorenzo','Simón','Gael','Noah'];
  const NOMBRES_F = ['Sofía','Camila','Valentina','Julieta','Emma','Isabella','Delfina','Lola','Mía','Catalina','Olivia','Victoria','Martina','Pilar','Francesca','Guadalupe','Josefina','Antonia','Renata','Zoe'];
  const APELLIDOS = ['Pérez','Martínez','García','López','Rodríguez','González','Fernández','Sánchez','Ruiz','Díaz','Torres','Ramírez','Molina','Silva','Castro','Méndez','Álvarez','Romero','Suárez','Vega','Aguirre','Herrera','Benítez','Ortiz','Núñez','Peralta','Sosa','Giménez','Luna','Ríos','Acosta','Medina','Flores','Bianchi','Quiroga','Morales','Villegas','Figueroa','Ponce','Caballero'];

  function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

  const ALUMNOS: Array<{ first: string; last: string; cat: number; phone: string; days: number[]; hours: [number, number] }> = [];
  const used = new Set<string>();
  for (let i = 0; i < 70; i++) {
    const isM = Math.random() > 0.4;
    const first = pick(isM ? NOMBRES_M : NOMBRES_F);
    const last = pick(APELLIDOS);
    const key = `${first}-${last}`;
    if (used.has(key)) { i--; continue; }
    used.add(key);
    // Categorías 5-8 con sesgo hacia 5-6
    const cat = Math.random() < 0.4 ? 5 : Math.random() < 0.7 ? 6 : Math.random() < 0.9 ? 7 : 8;
    const phone = `227145${(6000 + i).toString().padStart(4, '0')}`;
    // Días disponibles: 2-4 días random
    const allDays = [1,2,3,4,5,6,0];
    const nDays = 2 + Math.floor(Math.random() * 3);
    const days = allDays.sort(() => Math.random() - 0.5).slice(0, nDays).sort((a,b) => a-b);
    // Horario: franja matutina, vespertina o nocturna
    const franja = Math.random();
    const hours: [number, number] = franja < 0.2 ? [9, 12] : franja < 0.7 ? [17, 22] : [19, 22];
    ALUMNOS.push({ first, last, cat, phone, days, hours });
  }

  // ============ EJECUCIÓN ============
  const results = { coaches: 0, students: 0, sessions: 0, availability: 0, complex_linked: complexId };
  const allStaffIds: string[] = [];
  const allStudentIds: string[] = [];

  async function ensureUser(email: string, first: string, last: string, phone: string, category: number, role: 'player' | 'coach') {
    const { data: existing } = await admin.from('profiles').select('id').eq('phone', phone).maybeSingle();
    if (existing) return existing.id;
    const { data: newUser, error: uErr } = await admin.auth.admin.createUser({
      email, password: 'demoODpro2026!', email_confirm: true,
      user_metadata: { first_name: first, last_name: last }
    });
    if (uErr || !newUser?.user) {
      console.error('createUser err', email, uErr?.message);
      return null;
    }
    const username = `${first.toLowerCase().replace(/[^a-z]/g,'')}${last.toLowerCase().replace(/[^a-z]/g,'').slice(0,4)}${Math.floor(Math.random()*999)}`;
    const { error: pErr } = await admin.from('profiles').insert({
      id: newUser.user.id,
      first_name: first, last_name: last, phone, username,
      category, role, sex: 'M',
      locality: 'San Miguel del Monte', province: 'Buenos Aires'
    });
    if (pErr) console.error('profile err', pErr.message);
    return newUser.user.id;
  }

  // STAFF
  for (const s of STAFF) {
    const email = `demo.${s.first.toLowerCase()}.${s.last.toLowerCase().replace(/[^a-z]/g,'')}@odpro.test`;
    const id = await ensureUser(email, s.first, s.last, `22715${allStaffIds.length}${Math.floor(Math.random()*999)}`, s.cat, 'coach');
    if (!id) continue;
    allStaffIds.push(id);
    await admin.from('center_members').upsert({
      center_id: centerId, profile_id: id, role: s.role,
      title: s.title, specialty: s.specialty, years_experience: s.years, hourly_rate: s.rate
    }, { onConflict: 'center_id,profile_id' });
    // Disponibilidad
    for (const d of s.days) {
      await admin.from('weekly_availability').insert({
        profile_id: id, center_id: centerId, day_of_week: d,
        start_time: `${s.hours[0].toString().padStart(2,'0')}:00`,
        end_time: `${s.hours[1].toString().padStart(2,'0')}:00`
      });
      results.availability++;
    }
    results.coaches++;
  }

  // ALUMNOS
  for (const a of ALUMNOS) {
    const email = `demo.${a.first.toLowerCase().replace(/[^a-z]/g,'')}.${a.last.toLowerCase().replace(/[^a-z]/g,'')}${allStudentIds.length}@odpro.test`;
    const id = await ensureUser(email, a.first, a.last, a.phone, a.cat, 'player');
    if (!id) continue;
    allStudentIds.push(id);
    const nextBilling = new Date(); nextBilling.setDate(1); nextBilling.setMonth(nextBilling.getMonth() + 1);
    await admin.from('center_members').upsert({
      center_id: centerId, profile_id: id, role: 'student',
      monthly_fee: 1000, payment_status: Math.random() > 0.1 ? 'al_dia' : 'vencido',
      next_billing_date: nextBilling.toISOString().slice(0, 10)
    }, { onConflict: 'center_id,profile_id' });
    for (const d of a.days) {
      await admin.from('weekly_availability').insert({
        profile_id: id, center_id: centerId, day_of_week: d,
        start_time: `${a.hours[0].toString().padStart(2,'0')}:00`,
        end_time: `${a.hours[1].toString().padStart(2,'0')}:00`
      });
      results.availability++;
    }
    results.students++;
  }

  // SESIONES: 60 días hacia atrás, repartidas en los 5 pilares
  // Pesos realistas: Cancha mucho más que los demás
  const PILARES_WEIGHTED = [
    ...Array(10).fill('cancha'),
    ...Array(4).fill('gym'),
    ...Array(2).fill('filosofia'),
    ...Array(2).fill('psicologia'),
    ...Array(2).fill('nutricion')
  ];

  for (let d = 0; d < 60; d++) {
    const date = new Date(); date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().slice(0, 10);
    // 15-25 sesiones por día (para 70 alumnos activos)
    const nSesiones = 15 + Math.floor(Math.random() * 11);
    for (let s = 0; s < nSesiones; s++) {
      if (allStudentIds.length === 0 || allStaffIds.length === 0) break;
      const student = pick(allStudentIds);
      const coach = pick(allStaffIds);
      const pilar = pick(PILARES_WEIGHTED);
      const attended = Math.random() > 0.08; // 8% ausentismo
      await admin.from('pillar_sessions').insert({
        center_id: centerId,
        student_id: student, coach_id: coach,
        pillar: pilar, date: dateStr,
        hours: pilar === 'cancha' ? 1 + (Math.random() > 0.5 ? 0.5 : 0) : 1,
        attended,
        compliance_pct: pilar === 'nutricion' ? 55 + Math.floor(Math.random() * 45) : null
      });
      results.sessions++;
    }
  }

  return NextResponse.json({ ok: true, ...results });
}
