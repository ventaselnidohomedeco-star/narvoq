'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function ImportarAlumnos() {
  const { slug } = useParams<{ slug: string }>();
  const [raw, setRaw] = useState('');
  const [preview, setPreview] = useState<any[]>([]);
  const [resultado, setResultado] = useState<any>(null);
  const [enviando, setEnviando] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  function parse() {
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return setPreview([]);
    // Detectar separador (coma o tab o punto y coma)
    const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
    // Detectar si la primera línea es header
    const first = lines[0].toLowerCase();
    const hasHeader = first.includes('nombre') || first.includes('apellido') || first.includes('name');
    const start = hasHeader ? 1 : 0;
    const rows = lines.slice(start).map(line => {
      const parts = line.split(sep).map(p => p.trim().replace(/^"|"$/g, ''));
      return {
        nombre: parts[0] ?? '',
        apellido: parts[1] ?? '',
        celular: parts[2] ?? '',
        categoria: parts[3] ?? '5',
        email: parts[4] ?? ''
      };
    });
    setPreview(rows);
    setResultado(null);
  }

  async function importar() {
    if (preview.length === 0) return;
    if (!confirm(`¿Importar ${preview.length} alumnos a este centro? Se van a crear cuentas y generar links de activación por WhatsApp.`)) return;
    setEnviando(true);
    const r = await fetch('/api/admin/importar-alumnos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ center_slug: slug, alumnos: preview })
    });
    const j = await r.json();
    setEnviando(false);
    if (!r.ok) { alert('Error: ' + (j.error ?? 'desconocido')); return; }
    setResultado(j);
  }

  function enviarWaMasivo() {
    if (!resultado?.detalle?.creados) return;
    // Solo los que no tienen email enviado
    const pendientes = resultado.detalle.creados.filter((c: any) => !c.emailSent);
    const total = pendientes.length;
    if (total === 0) return alert('¡Todos recibieron email! No hace falta WhatsApp.');
    if (!confirm(`Se van a abrir ${total} ventanas de WhatsApp. Vas a tener que tocar "Enviar" en cada una. ¿Seguir?`)) return;
    let i = 0;
    const int = setInterval(() => {
      if (i >= total) { clearInterval(int); return; }
      window.open(pendientes[i].waLink, '_blank');
      setSentCount(i + 1);
      i++;
    }, 500);
  }

  return (
    <main className="min-h-dvh max-w-3xl mx-auto text-white px-5 py-6">
      <Link href={`/training/centro/${slug}`} className="text-white/50 text-xs font-black">← Volver</Link>
      <h1 className="font-display font-black text-2xl mt-1">📥 Importar alumnos</h1>
      <p className="text-white/60 text-sm">Pegá tu lista de alumnos (desde Excel, Google Sheets, Contactos) y los subimos todos de una.</p>

      {!resultado && (
        <>
          {/* Instrucciones */}
          <div className="mt-5 rounded-2xl bg-blue-500/10 border border-blue-500/40 p-4">
            <p className="text-blue-200 text-[11px] font-black tracking-widest">📋 FORMATO</p>
            <p className="text-white/80 text-sm mt-1">Una línea por alumno, columnas separadas por coma, punto y coma o tabulación:</p>
            <code className="block mt-2 bg-black/50 rounded p-2 text-xs font-mono text-white/90">
              Nombre, Apellido, Celular, Categoría, Email
            </code>
            <p className="text-white/60 text-xs mt-2">Ejemplo:</p>
            <code className="block mt-1 bg-black/50 rounded p-2 text-xs font-mono text-white/90">
              Juan, Pérez, 2271-555123, 5, juan@gmail.com<br/>
              María, López, 2271-555124, 6<br/>
              Pedro, García, 11-5555-9876
            </code>
            <p className="text-white/50 text-[11px] mt-2">
              ✓ Categoría y Email son opcionales<br/>
              ✓ Si tenés header (primera fila "Nombre,Apellido,..."), lo detecta solo
            </p>
          </div>

          {/* Textarea */}
          <div className="mt-5">
            <p className="text-white/70 text-xs font-black uppercase mb-1.5">Pegá tu lista acá</p>
            <textarea value={raw} onChange={e => setRaw(e.target.value)}
              rows={12} placeholder="Juan, Pérez, 2271-555123, 5&#10;María, López, 2271-555124, 6&#10;..."
              className="input w-full font-mono text-sm" />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={parse}
              className="py-3 rounded-xl bg-white/10 border border-white/20 text-white font-black">
              👁 Previsualizar
            </button>
            <button onClick={importar} disabled={preview.length === 0 || enviando}
              className="py-3 rounded-xl bg-ball text-black font-black disabled:opacity-40">
              {enviando ? '⏳ Importando...' : `✓ Importar ${preview.length || ''}`}
            </button>
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="mt-5 rounded-xl bg-white/5 border border-white/10 overflow-hidden">
              <div className="bg-white/5 p-3 border-b border-white/10">
                <p className="font-black">Preview: {preview.length} alumnos a importar</p>
              </div>
              <div className="divide-y divide-white/10 max-h-96 overflow-y-auto">
                {preview.map((p, i) => (
                  <div key={i} className="p-3 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-black">{p.nombre} {p.apellido}</p>
                      <p className="text-white/50 text-xs">📱 {p.celular} · cat {p.categoria}{p.email ? ` · ✉️ ${p.email}` : ''}</p>
                    </div>
                    <span className="text-ball text-xs">#{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Resultado */}
      {resultado && (
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/40 p-4">
            <p className="text-emerald-200 text-[11px] font-black tracking-widest">✓ IMPORTACIÓN COMPLETA</p>
            <div className="mt-2 grid grid-cols-4 gap-2 text-center">
              <div className="bg-black/30 rounded p-2">
                <p className="font-display font-black text-2xl text-ball">{resultado.nuevos}</p>
                <p className="text-white/60 text-[10px]">NUEVOS</p>
              </div>
              <div className="bg-black/30 rounded p-2">
                <p className="font-display font-black text-2xl text-blue-300">{resultado.emails_enviados ?? 0}</p>
                <p className="text-white/60 text-[10px]">EMAILS ✉️</p>
              </div>
              <div className="bg-black/30 rounded p-2">
                <p className="font-display font-black text-2xl text-yellow-300">{resultado.existentes}</p>
                <p className="text-white/60 text-[10px]">YA EXISTÍAN</p>
              </div>
              <div className="bg-black/30 rounded p-2">
                <p className="font-display font-black text-2xl text-red-300">{resultado.errores}</p>
                <p className="text-white/60 text-[10px]">ERRORES</p>
              </div>
            </div>
          </div>

          {/* Email: enviado automático */}
          {resultado.emails_enviados > 0 && (
            <div className="rounded-2xl bg-blue-500/10 border border-blue-500/40 p-4">
              <p className="font-black text-blue-200 text-sm">✉️ {resultado.emails_enviados} emails de activación enviados</p>
              <p className="text-white/70 text-xs mt-1">
                Cada alumno con email recibió un link único para elegir su password y activar la cuenta.
                No necesitás hacer nada más por ellos.
              </p>
            </div>
          )}

          {/* Resend no configurado */}
          {resultado.resend_configurado === false && (
            <div className="rounded-2xl bg-yellow-500/10 border border-yellow-500/40 p-4">
              <p className="font-black text-yellow-200 text-sm">⚠ Email automático NO configurado</p>
              <p className="text-white/70 text-xs mt-1">
                Para enviar emails automáticos, agregá <code className="bg-black/40 px-1 rounded">RESEND_API_KEY</code> y <code className="bg-black/40 px-1 rounded">RESEND_FROM_EMAIL</code> a las env vars de Vercel.
                Mientras tanto, usá los links de WhatsApp abajo.
              </p>
            </div>
          )}

          {/* WhatsApp fallback (solo para alumnos sin email) */}
          {resultado.detalle?.creados?.some((c: any) => !c.emailSent) && (
            <div className="rounded-2xl bg-[#25D366]/10 border border-[#25D366]/40 p-4">
              <p className="font-black text-[#25D366] text-sm">💬 Backup: Enviar por WhatsApp a los que no tienen email</p>
              <p className="text-white/70 text-xs mt-1">
                {resultado.detalle.creados.filter((c: any) => !c.emailSent).length} alumnos no tienen email o el envío falló. Mandales el link por WhatsApp:
              </p>
              <button onClick={enviarWaMasivo}
                className="mt-3 w-full py-3 rounded-xl bg-[#25D366] text-white font-black">
                📱 Abrir WhatsApp para los que faltan
              </button>
              {sentCount > 0 && (
                <p className="text-emerald-300 text-xs text-center mt-2">
                  ✓ {sentCount} ventanas abiertas
                </p>
              )}
              <details className="mt-3">
                <summary className="text-white/60 text-xs cursor-pointer">Ver lista completa</summary>
                <div className="mt-2 space-y-1 max-h-72 overflow-y-auto">
                  {resultado.detalle.creados.map((c: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 bg-black/30 rounded p-2 text-xs">
                      <span className="flex-1 truncate">
                        {c.nombre} {c.apellido} · {c.celular}
                        {c.emailSent ? <span className="text-blue-300 ml-2">✉️ email</span> : <span className="text-yellow-300 ml-2">📱 wa</span>}
                      </span>
                      {!c.emailSent && (
                        <a href={c.waLink} target="_blank" rel="noopener"
                          className="shrink-0 px-2 py-1 rounded bg-[#25D366] text-white font-black">📱</a>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}

          {resultado.detalle?.errores?.length > 0 && (
            <div className="rounded-2xl bg-red-500/10 border border-red-500/40 p-4">
              <p className="font-black text-red-300 text-sm">⚠ Errores ({resultado.detalle.errores.length})</p>
              <div className="mt-2 space-y-1 text-xs">
                {resultado.detalle.errores.map((e: any, i: number) => (
                  <div key={i} className="bg-black/30 rounded p-2">
                    <p className="font-black">{e.nombre} {e.apellido}</p>
                    <p className="text-red-300">{e.error}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => { setResultado(null); setPreview([]); setRaw(''); setSentCount(0); }}
            className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white font-black">
            📥 Importar más alumnos
          </button>
        </div>
      )}
    </main>
  );
}
