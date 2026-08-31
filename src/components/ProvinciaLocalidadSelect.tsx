'use client';
import { useEffect, useState } from 'react';
import { PROVINCIAS_AR, fetchLocalidades } from '@/lib/argentina';

// 2 dropdowns cascade: provincia → localidad. La lista de localidades se
// pide a la API oficial GeoRef cuando cambia la provincia.
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

  useEffect(() => {
    if (!provincia) { setLoc([]); return; }
    setLoading(true);
    fetchLocalidades(provincia)
      .then(setLoc)
      .finally(() => setLoading(false));
  }, [provincia]);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="label">Provincia</label>
        <select className="input" value={provincia}
          onChange={e => onChange({ provincia: e.target.value, localidad: '' })}
          required={required}>
          <option value="">Elegí…</option>
          {PROVINCIAS_AR.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Localidad</label>
        {loc.length > 0 ? (
          <select className="input" value={localidad}
            onChange={e => onChange({ provincia, localidad: e.target.value })}
            required={required} disabled={!provincia}>
            <option value="">{loading ? 'Cargando…' : 'Elegí…'}</option>
            {loc.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        ) : (
          <input className="input" value={localidad}
            placeholder={loading ? 'Cargando…' : provincia ? 'Escribí tu localidad' : 'Elegí provincia'}
            onChange={e => onChange({ provincia, localidad: e.target.value })}
            required={required} disabled={!provincia || loading} />
        )}
      </div>
    </div>
  );
}
