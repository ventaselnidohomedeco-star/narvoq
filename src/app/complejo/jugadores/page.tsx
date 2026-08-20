'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

// Jugadores del club: ranking interno + roster CSV importado + ascensos.
export default function Jugadores() {
  const [cx, setCx] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [roster, setRoster] = useState<any[]>([]);
  const [watch, setWatch] = useState<string[]>([]);
  const [importMsg, setImportMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'ranking' | 'roster'>('ranking');

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: complex } = await supabase.from('complexes').select('*').eq('owner_id', user!.id).single();
    setCx(complex);
    const { data: r } = await supabase.from('v_ranking').select('*')
      .eq('complex_id', complex.id).order('points', { ascending: false }).limit(60);
    setRows(r ?? []);
    const { data: w } = await supabase.from('watchlist').select('player_id').eq('complex_id', complex.id);
    setWatch((w ?? []).map(x => x.player_id));
    const { data: ros } = await supabase.from('club_player_roster')
      .select('*').eq('complex_id', complex.id).order('created_at', { ascending: false });
    setRoster(ros ?? []);
  }
  useEffect(() => { load(); }, []);

  async function toggleWatch(pid: string) {
    if (watch.includes(pid)) {
      await supabase.from('watchlist').delete().eq('complex_id', cx.id).eq('player_id', pid);
      setWatch(watch.filter(x => x !== pid));
    } else {
      await supabase.from('watchlist').insert({ complex_id: cx.id, player_id: pid });
      setWatch([...watch, pid]);
    }
  }

  async function ascender(p: any) {
    if (p.category <= 1) return alert('Ya está en la máxima categoría.');
    const nueva = p.category - 1;
    if (!confirm(`¿Ascender a ${p.first_name} ${p.last_name} de categoría ${p.category} a ${nueva}?`)) return;
    const { error } = await supabase.rpc('promote_player', { pid: p.player_id, new_cat: nueva });
    if (error) return alert(`No se pudo: ${error.message}. ¿Ejecutaste update-06-pro.sql?`);
    await supabase.from('posts').insert({
      author_complex_id: cx.id, kind: 'manual',
      text_content: `📈 ¡Ascenso! ${p.first_name} ${p.last_name} sube a categoría ${nueva}. ¡Felicitaciones!`
    });
    load();
  }

  function descargarPlantilla() {
    const csv = [
      'nombre,apellido,celular,dni,email,categoria,puntos,notas',
      'Ejemplo,Jugador,1122334455,30123456,ejemplo@correo.com,4,50,Categoría según ranking interno',
      'Otro,Ejemplo,1155667788,,,,3,120,'
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plantilla-jugadores-${cx?.name ?? 'club'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importarCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMsg('Procesando…');
    try {
      const text = await file.text();
      // Split lines, ignore empty
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) throw new Error('El archivo está vacío o solo tiene encabezado.');
      // Parse header
      const header = lines[0].toLowerCase().split(',').map(h => h.trim());
      const idx = (name: string) => header.indexOf(name);
      const nameIdx = idx('nombre');
      const lastIdx = idx('apellido');
      const phoneIdx = idx('celular');
      const dniIdx = idx('dni');
      const emailIdx = idx('email');
      const catIdx = idx('categoria');
      const pointsIdx = idx('puntos');
      const notesIdx = idx('notas');
      if (nameIdx < 0) throw new Error('Falta la columna "nombre". Descargá la plantilla nueva.');

      const { data: { user } } = await supabase.auth.getUser();
      const inserted: any[] = [];
      let skipped = 0;
      for (let i = 1; i < lines.length; i++) {
        const cells = parseCsvLine(lines[i]);
        const first = cells[nameIdx]?.trim();
        if (!first) { skipped++; continue; }
        inserted.push({
          complex_id: cx.id,
          first_name: first,
          last_name: cells[lastIdx]?.trim() || null,
          phone: cells[phoneIdx]?.replace(/\D/g, '') || null,
          dni: cells[dniIdx]?.replace(/\D/g, '') || null,
          email: cells[emailIdx]?.trim().toLowerCase() || null,
          category: catIdx >= 0 && cells[catIdx] ? Number(cells[catIdx]) || null : null,
          points: pointsIdx >= 0 && cells[pointsIdx] ? Number(cells[pointsIdx]) || 0 : 0,
          notes: notesIdx >= 0 ? cells[notesIdx]?.trim() || null : null,
          created_by: user!.id
        });
      }
      if (inserted.length === 0) throw new Error('No se pudo leer ninguna fila válida.');
      const { error } = await supabase.from('club_player_roster').insert(inserted);
      if (error) throw error;
      setImportMsg(`✓ Importados: ${inserted.length}${skipped ? ` (${skipped} filas vacías omitidas)` : ''}`);
      load();
    } catch (err: any) {
      setImportMsg(`❌ ${err.message}`);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function eliminarRoster(id: string) {
    if (!confirm('¿Eliminar este jugador del roster?')) return;
    await supabase.from('club_player_roster').delete().eq('id', id);
    load();
  }

  const Row = ({ p, i }: any) => (
    <div className="bg-white/5 rounded-2xl p-3 flex items-center gap-3">
      <span className="font-display font-black text-ball w-6 text-center">{i + 1}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{p.first_name} {p.last_name}</p>
        <p className="text-white/40 text-xs">@{p.username} · cat. {p.category} · {p.points} pts torneo</p>
      </div>
      <button onClick={() => toggleWatch(p.player_id)} title="Observar"
        className={`text-xl ${watch.includes(p.player_id) ? '' : 'grayscale opacity-40'}`}>⭐</button>
      <button onClick={() => ascender(p)}
        className="btn-ball !py-1.5 !px-3 text-xs shrink-0">↑ Ascender</button>
    </div>
  );

  if (!cx) return <main className="p-8 text-white/70">Cargando…</main>;
  const candidatos = rows.filter(r => watch.includes(r.player_id));

  return (
    <main className="px-5 py-6">
      <h1 className="font-display font-black text-xl">Jugadores del complejo</h1>

      {/* Tabs */}
      <div className="mt-3 flex gap-2 border-b border-white/10">
        <button onClick={() => setTab('ranking')}
          className={`pb-2 px-3 text-sm font-black ${tab === 'ranking' ? 'text-ball border-b-2 border-ball' : 'text-white/50'}`}>
          🏆 Ranking en NarvoQ
        </button>
        <button onClick={() => setTab('roster')}
          className={`pb-2 px-3 text-sm font-black ${tab === 'roster' ? 'text-ball border-b-2 border-ball' : 'text-white/50'}`}>
          📋 Roster del club ({roster.length})
        </button>
      </div>

      {tab === 'ranking' && (
        <>
          <p className="text-white/50 text-sm mt-3">⭐ Marcá candidatos a ascenso · ↑ Ascendé con un clic.</p>
          {candidatos.length > 0 && (
            <section className="mt-4">
              <p className="font-display font-bold text-ball text-sm">⭐ En observación ({candidatos.length})</p>
              <div className="mt-2 space-y-2">
                {candidatos.map(p => <Row key={p.player_id} p={p} i={rows.indexOf(p)} />)}
              </div>
            </section>
          )}
          <section className="mt-4">
            <p className="font-display font-bold text-ball text-sm">Ranking interno (puntos de torneos acá)</p>
            <div className="mt-2 space-y-2">
              {rows.map((p, i) => <Row key={p.player_id} p={p} i={i} />)}
              {rows.length === 0 && <p className="text-white/40 text-sm">Todavía nadie sumó puntos de torneo en tu complejo.</p>}
            </div>
          </section>
        </>
      )}

      {tab === 'roster' && (
        <>
          <p className="text-white/60 text-sm mt-3">
            Cargá una planilla con jugadores del club (aunque no estén en NarvoQ todavía).
            Cuando se registren en la app y su celular/DNI/email coincida, les aplicamos su categoría automáticamente.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={descargarPlantilla}
              className="py-3 rounded-xl bg-white/10 border border-white/20 text-white font-black text-sm">
              📥 Descargar plantilla CSV
            </button>
            <label className="py-3 rounded-xl bg-ball text-courtdark font-black text-sm text-center cursor-pointer">
              📤 Importar planilla
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={importarCsv} />
            </label>
          </div>
          {importMsg && (
            <p className={`mt-2 text-sm ${importMsg.startsWith('✓') ? 'text-ball' : 'text-yellow-300'}`}>
              {importMsg}
            </p>
          )}

          <p className="text-white/40 text-[11px] mt-3">
            Formato: nombre,apellido,celular,dni,email,categoria,puntos,notas
          </p>

          <section className="mt-4">
            <p className="font-display font-bold text-ball text-sm">Jugadores cargados ({roster.length})</p>
            <div className="mt-2 space-y-2">
              {roster.map(r => (
                <div key={r.id} className={`rounded-xl p-3 flex items-center gap-3 ${r.matched_player_id ? 'bg-ball/5 border border-ball/30' : 'bg-white/5'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">
                      {r.first_name} {r.last_name}
                      {r.matched_player_id && <span className="ml-2 text-ball text-[10px] font-black">✓ EN NARVOQ</span>}
                    </p>
                    <p className="text-white/50 text-xs">
                      {r.category ? `cat. ${r.category} · ` : ''}
                      {r.points ? `${r.points} pts · ` : ''}
                      {r.phone && `📱 ${r.phone} · `}
                      {r.dni && `DNI ${r.dni} · `}
                      {r.email}
                    </p>
                    {r.notes && <p className="text-white/40 text-xs mt-1">📝 {r.notes}</p>}
                  </div>
                  <button onClick={() => eliminarRoster(r.id)}
                    className="text-red-400/70 text-xs font-bold px-2 py-1 hover:bg-red-500/10 rounded">
                    Eliminar
                  </button>
                </div>
              ))}
              {roster.length === 0 && (
                <div className="card text-center py-8">
                  <p className="text-3xl">📋</p>
                  <p className="text-white/50 mt-2 text-sm">Todavía no importaste ningún jugador.</p>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

// Parser simple de una línea CSV con soporte para valores con comillas.
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      out.push(current); current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}
