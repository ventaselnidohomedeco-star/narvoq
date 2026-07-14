'use client';
import { Component, ReactNode } from 'react';

// Error boundary muy simple. Captura errores de renderizado en cualquier
// hijo y muestra un mensaje amigable con la posibilidad de recargar la
// página o reportar el problema.
export default class ErrorBoundary extends Component<
  { children: ReactNode; label?: string },
  { hasError: boolean; error?: Error }
> {
  state = { hasError: false, error: undefined as Error | undefined };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary', this.props.label, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-md mx-auto">
          <div className="card !p-6 space-y-3 text-center">
            <p className="text-4xl">⚠️</p>
            <p className="font-display font-black text-lg">Se rompió algo en esta sección.</p>
            <p className="text-white/60 text-sm">
              {this.props.label ? `Contexto: ${this.props.label}` : ''}
            </p>
            {this.state.error?.message && (
              <p className="text-red-400 text-xs font-mono bg-black/30 rounded p-3 text-left break-words">
                {this.state.error.message}
              </p>
            )}
            <div className="flex gap-2 pt-2">
              <button onClick={() => { this.setState({ hasError: false, error: undefined }); }}
                className="flex-1 py-2 rounded-lg bg-white/10 font-black text-sm">
                Reintentar
              </button>
              <button onClick={() => (typeof window !== 'undefined') && window.location.reload()}
                className="flex-1 py-2 rounded-lg bg-ball text-courtdark font-black text-sm">
                Recargar página
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
