'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PROVINCIAS_AR, fetchLocalidades } from '@/lib/argentina';

// Provincia (dropdown) + Localidad (typeahead con filtro en vivo).
// La lista de localidades viene de la API GeoRef cuando cambia la provincia.
// El usuario tipea y ve solo las coincidencias — nunca navega 400 items.
export default function ProvinciaLocalidadSelect({
  provincia, localidad, onChange, required = false
}: {
  provincia: string;
  localidad: string;
  onChange: (p: { provincia: string; localidad: string }) => void;
  required?: boolean;
}) {
  const [loc, setLoc] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState(localidad);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(localidad); }, [localidad]);

  useEffect(() => {
    if (!provincia) { setLoc([]); return; }
    setLoading(true);
    fetchLocalidades(provincia)
      .then(setLoc)
      .finally(() => setLoading(false));
  }, [provincia]);

  // Cerrar al click afuera
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Normaliza para búsqueda: sin acentos, minúsculas
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const filtered = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return loc.slice(0, 50);
    return loc.filter(l => norm(l).includes(q)).slice(0, 50);
  }, [loc, query]);

  function pick(l: string) {
    onChange({ provincia, localidad: l });
    setQuery(l);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHighlight(h => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(0, h - 1)); }
    else if (e.key === 'Enter') {
      if (open && filtered[highlight]) { e.preventDefault(); pick(filtered[highlight]); }
    } else if (e.key === 'Escape') setOpen(false);
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className="label">Provincia</label>
        <select className="input" value={provincia}
          onChange={e => { onChange({ provincia: e.target.value, localidad: '' }); setQuery(''); }}
          required={required}>
          <option value="">Elegí…</option>
          {PROVINCIAS_AR.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div ref={boxRef} className="relative">
        <label className="label">Localidad</label>
        <input className="input" value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setHighlight(0); onChange({ provincia, localidad: e.target.value }); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={loading ? 'Cargando…' : provincia ? 'Escribí y elegí…' : 'Elegí provincia primero'}
          required={required} disabled={!provincia || loading}
          autoComplete="off" />
        {open && provincia && !loading && filtered.length > 0 && (
          <div className="absolute z-30 left-0 right-0 mt-1 rounded-xl bg-[#0F141D] border border-white/15 shadow-xl max-h-64 overflow-y-auto">
            {filtered.map((l, i) => (
              <button key={l} type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(l)}
                className={`w-full text-left px-3 py-2 text-sm ${i === highlight ? 'bg-ball/15 text-ball' : 'text-white/80 hover:bg-white/5'}`}>
                {l}
              </button>
            ))}
            {loc.length > 50 && query.trim() === '' && (
              <p className="px-3 py-2 text-white/40 text-xs">Escribí para filtrar entre {loc.length} localidades…</p>
            )}
          </div>
        )}
        {open && provincia && !loading && filtered.length === 0 && query.trim() && (
          <div className="absolute z-30 left-0 right-0 mt-1 rounded-xl bg-[#0F141D] border border-white/15 shadow-xl p-3 text-white/50 text-sm">
            Sin coincidencias. Podés dejar el texto que escribiste si es una localidad menor.
          </div>
        )}
      </div>
    </div>
  );
}
