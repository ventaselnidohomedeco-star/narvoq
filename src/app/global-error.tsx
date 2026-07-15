'use client';

// Next.js global-error: catch de último recurso para errores no manejados.
// Reemplaza la pantalla genérica "Application error: a client-side exception".
export default function GlobalError({
  error, reset
}: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ background: '#000', color: '#fff', fontFamily: 'system-ui, sans-serif', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: 480, padding: 32, textAlign: 'center' }}>
          <p style={{ fontSize: 48, marginBottom: 8 }}>⚠️</p>
          <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 12 }}>Algo se rompió</h1>
          <p style={{ opacity: 0.7, marginBottom: 12 }}>Copiá este mensaje y compártelo con el equipo:</p>
          <pre style={{
            background: '#111', color: '#ff8888', padding: 12, borderRadius: 8,
            textAlign: 'left', fontSize: 12, overflow: 'auto', maxHeight: 200, whiteSpace: 'pre-wrap', wordBreak: 'break-word'
          }}>
            {error?.message ?? 'Sin detalles'}
            {error?.digest ? `\nDigest: ${error.digest}` : ''}
            {error?.stack ? `\n\nStack:\n${error.stack.split('\n').slice(0, 6).join('\n')}` : ''}
          </pre>
          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <button onClick={reset}
              style={{ flex: 1, padding: '12px', background: '#333', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 900, cursor: 'pointer' }}>
              Reintentar
            </button>
            <button onClick={() => (typeof window !== 'undefined') && (window.location.href = '/jugador/dashboard')}
              style={{ flex: 1, padding: '12px', background: '#D8F646', color: '#000', border: 'none', borderRadius: 8, fontWeight: 900, cursor: 'pointer' }}>
              Ir al inicio
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
