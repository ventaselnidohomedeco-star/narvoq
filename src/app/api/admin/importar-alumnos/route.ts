import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

type CookieToSet = { name: string; value: string; options?: any };

// POST /api/admin/importar-alumnos
// Body: { center_slug, alumnos: [{nombre, apellido, celular, categoria?, email?, assigned_coach_id?}] }
// Crea auth.users + profiles + center_members en lote. Genera link de recovery para que cada uno elija password.
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

  const body = await req.json();
  const { center_slug, alumnos } = body;
  if (!center_slug) return NextResponse.json({ error: 'falta center_slug' }, { status: 400 });
  if (!Array.isArray(alumnos) || alumnos.length === 0) return NextResponse.json({ error: 'alumnos vacio' }, { status: 400 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: centro } = await admin.from('training_centers').select('id, name, slug').eq('slug', center_slug).maybeSingle();
  if (!centro) return NextResponse.json({ error: 'centro no encontrado' }, { status: 404 });

  // Verificar que el user sea master o super_admin del centro
  if (meProf?.role !== 'super_admin') {
    const { data: cm } = await admin.from('center_members')
      .select('role').eq('center_id', centro.id).eq('profile_id', user.id).maybeSingle();
    if (cm?.role !== 'master') return NextResponse.json({ error: 'solo master o super_admin' }, { status: 403 });
  }

  const results: any = { creados: [], existentes: [], errores: [] };

  for (const a of alumnos) {
    const nombre = (a.nombre ?? '').trim();
    const apellido = (a.apellido ?? '').trim();
    const celular = (a.celular ?? '').toString().replace(/\D/g, '');
    const email = (a.email ?? '').trim().toLowerCase() || `nq.${celular}@odpro.narvoq`;
    const categoria = a.categoria ? Number(a.categoria) : 5;
    const assignedCoachId = a.assigned_coach_id || null;

    if (!nombre || !apellido || celular.length < 8) {
      results.errores.push({ nombre, apellido, celular, error: 'datos invalidos (nombre, apellido o celular)' });
      continue;
    }

    try {
      // ¿ya existe por teléfono?
      let userId: string | null = null;
      let yaExistia = false;
      const { data: existProf } = await admin.from('profiles').select('id').eq('phone', celular).maybeSingle();
      if (existProf) {
        userId = existProf.id;
        yaExistia = true;
      } else {
        // Crear auth user con password aleatoria larga
        const randomPwd = 'narvoq_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        const { data: newUser, error: uErr } = await admin.auth.admin.createUser({
          email, password: randomPwd, email_confirm: true,
          user_metadata: { first_name: nombre, last_name: apellido }
        });
        if (uErr || !newUser?.user) {
          results.errores.push({ nombre, apellido, celular, error: uErr?.message ?? 'error creando user' });
          continue;
        }
        userId = newUser.user.id;
        // Crear profile
        const username = `${nombre.toLowerCase().replace(/[^a-z]/g,'')}${apellido.toLowerCase().replace(/[^a-z]/g,'').slice(0,4)}${Math.floor(Math.random()*999)}`;
        const { error: pErr } = await admin.from('profiles').insert({
          id: userId,
          first_name: nombre, last_name: apellido, phone: celular, username,
          category: categoria, role: 'player', sex: 'M',
          locality: 'San Miguel del Monte', province: 'Buenos Aires'
        });
        if (pErr) {
          results.errores.push({ nombre, apellido, celular, error: 'profile: ' + pErr.message });
          continue;
        }
      }

      if (!userId) continue;

      // Insertar en center_members (upsert)
      await admin.from('center_members').upsert({
        center_id: centro.id, profile_id: userId, role: 'student',
        assigned_coach_id: assignedCoachId,
        active: true
      }, { onConflict: 'center_id,profile_id' });

      // Generar link de recovery para que elija password
      let recoveryLink: string | null = null;
      try {
        const { data: linkData } = await admin.auth.admin.generateLink({
          type: 'recovery',
          email
        });
        recoveryLink = linkData?.properties?.action_link ?? null;
      } catch {}

      // Mensaje WhatsApp pre-escrito
      const waMsg = encodeURIComponent(
        `¡Hola ${nombre}! 👋\n\n` +
        `${centro.name} te sumó a NarvoQ, la app donde vas a ver tus clases, confirmar asistencias, ver evaluaciones y mucho más.\n\n` +
        `📲 Entrá acá para activar tu cuenta y elegir tu password:\n` +
        (recoveryLink ?? `https://narvoq.com.ar/recuperar`) +
        `\n\n¡Nos vemos en la cancha! 🎾`
      );
      const waLink = `https://wa.me/${celular.startsWith('54') ? celular : '54' + celular}?text=${waMsg}`;

      (yaExistia ? results.existentes : results.creados).push({
        nombre, apellido, celular, email, userId, waLink, recoveryLink
      });
    } catch (e: any) {
      results.errores.push({ nombre, apellido, celular, error: e?.message ?? 'desconocido' });
    }
  }

  return NextResponse.json({
    ok: true,
    centro: centro.name,
    total_procesados: alumnos.length,
    nuevos: results.creados.length,
    existentes: results.existentes.length,
    errores: results.errores.length,
    detalle: results
  });
}
