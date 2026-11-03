import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

type CookieToSet = { name: string; value: string; options?: any };

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'NarvoQ <noreply@narvoq.com.ar>';

async function sendActivationEmail(toEmail: string, nombre: string, centroName: string, link: string) {
  if (!resend) return { sent: false, reason: 'RESEND_API_KEY no configurado' };
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: `${centroName} te sumó a NarvoQ 🎾`,
      html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;font-family:-apple-system,sans-serif;background:#0a0a0a;color:#fff;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;background:#111;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#B4FF39;font-size:32px;margin:0;font-weight:900;letter-spacing:-1px;">NARVOQ</h1>
      <p style="color:#999;font-size:12px;margin-top:4px;">La app de pádel</p>
    </div>
    <div style="background:#1a1a1a;border-radius:16px;padding:32px;border:1px solid #333;">
      <p style="color:#fff;font-size:16px;margin:0;">¡Hola <strong>${nombre}</strong>! 👋</p>
      <p style="color:#ccc;font-size:15px;margin-top:16px;line-height:1.6;">
        <strong>${centroName}</strong> te sumó a su centro de entrenamiento en <strong>NarvoQ</strong>.
      </p>
      <p style="color:#ccc;font-size:15px;line-height:1.6;">
        En la app vas a poder:
      </p>
      <ul style="color:#ccc;font-size:14px;line-height:1.8;">
        <li>Ver tus clases y confirmar asistencia</li>
        <li>Seguir tu progreso en los 5 pilares</li>
        <li>Ver las evaluaciones de tu coach</li>
        <li>Reservar canchas</li>
        <li>Chatear y conocer otros jugadores</li>
      </ul>
      <div style="text-align:center;margin-top:32px;">
        <a href="${link}" style="display:inline-block;background:#B4FF39;color:#000;padding:14px 32px;border-radius:12px;font-weight:900;text-decoration:none;font-size:16px;">
          Activar mi cuenta →
        </a>
      </div>
      <p style="color:#666;font-size:12px;text-align:center;margin-top:24px;">
        O copiá este link: <br/>
        <span style="color:#999;word-break:break-all;">${link}</span>
      </p>
    </div>
    <p style="color:#555;font-size:11px;text-align:center;margin-top:24px;">
      ¡Nos vemos en la cancha! 🎾<br/>
      NarvoQ · narvoq.com.ar
    </p>
  </div>
</body>
</html>`,
      text: `¡Hola ${nombre}! ${centroName} te sumó a NarvoQ. Activá tu cuenta: ${link}`
    });
    if (error) return { sent: false, reason: error.message };
    return { sent: true };
  } catch (e: any) {
    return { sent: false, reason: e?.message ?? 'error' };
  }
}

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

      // Enviar email de activación (solo si tenemos un email real, no el autogenerado)
      let emailResult: any = { sent: false, reason: 'sin email real' };
      const emailReal = a.email && a.email.trim() && !email.endsWith('@odpro.narvoq');
      if (emailReal && recoveryLink) {
        emailResult = await sendActivationEmail(email, nombre, centro.name, recoveryLink);
      }

      // Fallback WhatsApp (siempre disponible como backup)
      const waMsg = encodeURIComponent(
        `¡Hola ${nombre}! 👋\n\n` +
        `${centro.name} te sumó a NarvoQ, la app donde vas a ver tus clases, confirmar asistencias, ver evaluaciones y mucho más.\n\n` +
        `📲 Entrá acá para activar tu cuenta y elegir tu password:\n` +
        (recoveryLink ?? `https://narvoq.com.ar/recuperar`) +
        `\n\n¡Nos vemos en la cancha! 🎾`
      );
      const waLink = `https://wa.me/${celular.startsWith('54') ? celular : '54' + celular}?text=${waMsg}`;

      (yaExistia ? results.existentes : results.creados).push({
        nombre, apellido, celular, email, userId, waLink, recoveryLink,
        emailSent: emailResult.sent,
        emailError: emailResult.sent ? null : emailResult.reason
      });
    } catch (e: any) {
      results.errores.push({ nombre, apellido, celular, error: e?.message ?? 'desconocido' });
    }
  }

  const emailsEnviados = results.creados.filter((c: any) => c.emailSent).length;
  const sinEmail = results.creados.filter((c: any) => !c.emailSent).length;

  return NextResponse.json({
    ok: true,
    centro: centro.name,
    total_procesados: alumnos.length,
    nuevos: results.creados.length,
    existentes: results.existentes.length,
    errores: results.errores.length,
    emails_enviados: emailsEnviados,
    sin_email: sinEmail,
    resend_configurado: !!resend,
    detalle: results
  });
}
