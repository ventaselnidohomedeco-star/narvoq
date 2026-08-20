'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import ExcelJS from 'exceljs';

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
      .select('*, matched:profiles!matched_player_id(username, first_name, last_name, avatar_url, category)')
      .eq('complex_id', complex.id).order('created_at', { ascending: false });
    setRoster(ros ?? []);
  }

  // Picker manual: buscar y vincular un roster con un usuario existente
  const [linkFor, setLinkFor] = useState<any>(null);  // roster row a vincular
  const [linkQuery, setLinkQuery] = useState('');
  const [linkResults, setLinkResults] = useState<any[]>([]);
  useEffect(() => {
    if (!linkFor || !linkQuery.trim() || linkQuery.length < 2) { setLinkResults([]); return; }
    const t = setTimeout(async () => {
      const q = linkQuery.trim();
      const { data } = await supabase.from('profiles')
        .select('id, username, first_name, last_name, avatar_url, category, phone')
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,username.ilike.%${q}%,phone.ilike.%${q}%`)
        .eq('role', 'player').limit(15);
      setLinkResults(data ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [linkQuery, linkFor]);

  async function vincularManual(rosterId: string, profile: any) {
    const { error } = await supabase.from('club_player_roster')
      .update({ matched_player_id: profile.id, matched_at: new Date().toISOString() })
      .eq('id', rosterId);
    if (error) return alert(`No se pudo vincular: ${error.message}`);
    // Si el roster trae categoría, aplicarla al perfil
    const rosterRow = roster.find(r => r.id === rosterId);
    if (rosterRow?.category) {
      await supabase.from('profiles').update({ category: rosterRow.category }).eq('id', profile.id);
    }
    setLinkFor(null); setLinkQuery(''); setLinkResults([]);
    load();
  }

  async function desvincular(rosterId: string) {
    if (!confirm('¿Desvincular este jugador?')) return;
    await supabase.from('club_player_roster')
      .update({ matched_player_id: null, matched_at: null }).eq('id', rosterId);
    load();
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

  async function descargarPlantilla() {
    // Plantilla .xlsx con encabezados en color de marca (ball verde) sobre grafito
    const wb = new ExcelJS.Workbook();
    wb.creator = 'NarvoQ';
    wb.title = `Plantilla ${cx?.name ?? 'Club'}`;
    const ws = wb.addWorksheet('Jugadores', { views: [{ state: 'frozen', ySplit: 1 }] });

    const headers = ['nombre', 'apellido', 'celular', 'dni', 'email', 'categoria', 'puntos', 'notas'];
    ws.columns = [
      { key: 'nombre', width: 16 }, { key: 'apellido', width: 16 },
      { key: 'celular', width: 15 }, { key: 'dni', width: 13 },
      { key: 'email', width: 28 }, { key: 'categoria', width: 11 },
      { key: 'puntos', width: 9 }, { key: 'notas', width: 32 }
    ];
    ws.addRow(headers);
    ws.addRow(['Ejemplo', 'Jugador', '1122334455', '30123456', 'ejemplo@correo.com', 4, 50, 'Cargar según ranking del club']);
    ws.addRow(['Otro', 'Ejemplo', '1155667788', '', '', 3, 120, '']);

    // Estilo del header: verde ball (#B8FF3D) sobre grafito (#161C24), bold, centrado
    const header = ws.getRow(1);
    header.height = 26;
    header.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB8FF3D' } };
      cell.font = { bold: true, size: 12, color: { argb: 'FF161C24' }, name: 'Calibri' };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        bottom: { style: 'medium', color: { argb: 'FF161C24' } }
      };
    });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plantilla-jugadores-${cx?.name ?? 'club'}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importarPlanilla(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMsg('Procesando…');
    try {
      const buf = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      // Detectar formato por extensión
      if (file.name.toLowerCase().endsWith('.csv')) {
        const text = new TextDecoder('utf-8').decode(buf);
        // exceljs no lee CSV desde buffer; usamos un parser mínimo inline
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) throw new Error('El CSV está vacío o solo tiene encabezado.');
        const ws = wb.addWorksheet('csv');
        lines.forEach(line => ws.addRow(parseCsvLine(line)));
      } else {
        await wb.xlsx.load(buf);
      }
      const ws = wb.worksheets[0];
      if (!ws || ws.rowCount < 2) throw new Error('El archivo está vacío o solo tiene encabezado.');

      // Normalizar keys (lowercase, sin acentos)
      const norm = (s: string) => s
        .toLowerCase().trim()
        .normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '');

      const headers: string[] = [];
      ws.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
        headers[col - 1] = norm(String(cell.value ?? ''));
      });

      const rows: Record<string, string>[] = [];
      for (let r = 2; r <= ws.rowCount; r++) {
        const rowObj: Record<string, string> = {};
        const row = ws.getRow(r);
        let hasData = false;
        headers.forEach((h, i) => {
          const v = row.getCell(i + 1).value;
          const s = v == null ? '' : String(typeof v === 'object' && 'text' in (v as any) ? (v as any).text : v).trim();
          if (s) hasData = true;
          rowObj[h] = s;
        });
        if (hasData) rows.push(rowObj);
      }
      if (rows.length === 0) throw new Error('No hay filas con datos.');

      const { data: { user } } = await supabase.auth.getUser();
      const inserted: any[] = [];
      let skipped = 0;
      for (const clean of rows) {
        const first = clean['nombre'];
        if (!first) { skipped++; continue; }
        inserted.push({
          complex_id: cx.id,
          first_name: first,
          last_name: clean['apellido'] || null,
          phone: clean['celular']?.replace(/\D/g, '') || null,
          dni: clean['dni']?.replace(/\D/g, '') || null,
          email: clean['email']?.toLowerCase() || null,
          category: clean['categoria'] ? Number(clean['categoria']) || null : null,
          points: clean['puntos'] ? Number(clean['puntos']) || 0 : 0,
          notes: clean['notas'] || null,
          created_by: user!.id
        });
      }
      if (inserted.length === 0) throw new Error('No se pudo leer ninguna fila válida. Verificá que la columna "nombre" tenga datos.');
      const { error } = await supabase.from('club_player_roster').insert(inserted);
      if (error) throw error;

      // Matchear con usuarios que ya están en NarvoQ (por celular / DNI / email)
      const { data: matches } = await supabase.rpc('apply_roster_matches_for_complex', { p_complex_id: cx.id });
      const matchedNow = Number(matches ?? 0);

      setImportMsg(
        `✓ Importados: ${inserted.length}` +
        (matchedNow > 0 ? ` · ${matchedNow} vinculados a NarvoQ` : '') +
        (skipped ? ` · ${skipped} filas vacías omitidas` : '')
      );
      load();
    } catch (err: any) {
      setImportMsg(`❌ ${err.message}`);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function revincular() {
    setImportMsg('Buscando coincidencias en NarvoQ…');
    const { data, error } = await supabase.rpc('apply_roster_matches_for_complex', { p_complex_id: cx.id });
    if (error) return setImportMsg(`❌ ${error.message}`);
    const n = Number(data ?? 0);
    setImportMsg(n > 0 ? `✓ Vinculados ${n} jugador${n > 1 ? 'es' : ''} nuevo${n > 1 ? 's' : ''}` : 'Ningún jugador nuevo para vincular.');
    load();
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
              📥 Descargar plantilla Excel
            </button>
            <label className="py-3 rounded-xl bg-ball text-courtdark font-black text-sm text-center cursor-pointer">
              📤 Importar planilla
              <input ref={fileRef} type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden" onChange={importarPlanilla} />
            </label>
          </div>
          {importMsg && (
            <p className={`mt-2 text-sm ${importMsg.startsWith('✓') ? 'text-ball' : 'text-yellow-300'}`}>
              {importMsg}
            </p>
          )}

          <p className="text-white/40 text-[11px] mt-3">
            Columnas: <b>nombre</b> · apellido · celular · dni · email · categoria · puntos · notas.
            Acepta Excel (.xlsx) y CSV.
          </p>

          {roster.length > 0 && (
            <button onClick={revincular}
              className="mt-3 w-full py-2.5 rounded-xl border border-ball/40 bg-ball/10 text-ball font-black text-sm">
              🔗 Re-vincular con NarvoQ (buscar cambios)
            </button>
          )}

          <section className="mt-4">
            <p className="font-display font-bold text-ball text-sm">Jugadores cargados ({roster.length})</p>
            <div className="mt-2 space-y-2">
              {roster.map(r => (
                <div key={r.id}
                  className={`rounded-xl p-3 ${r.matched_player_id ? 'bg-ball/5 border border-ball/30' : 'bg-white/5'}`}>
                  <div className="flex items-center gap-3">
                    {r.matched?.avatar_url
                      ? <img src={r.matched.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border border-ball/40" />
                      : <span className="w-10 h-10 rounded-full bg-white/10 text-white/50 font-black flex items-center justify-center">
                          {r.first_name?.[0]?.toUpperCase()}
                        </span>}
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
                    <button onClick={() => eliminarRoster(r.id)} title="Eliminar del roster"
                      className="text-red-400/70 text-lg font-bold w-8 h-8 hover:bg-red-500/10 rounded">
                      ✕
                    </button>
                  </div>
                  {/* Acciones */}
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {r.matched_player_id ? (
                      <>
                        {r.matched?.username && (
                          <Link href={`/u/${r.matched.username}`}
                            className="btn-ball !py-1.5 !px-3 text-xs font-black">
                            👤 Ver perfil
                          </Link>
                        )}
                        <button onClick={() => desvincular(r.id)}
                          className="py-1.5 px-3 rounded-lg border border-white/10 text-white/60 text-xs font-bold">
                          🔓 Desvincular
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setLinkFor(r)}
                        className="w-full py-2 rounded-lg border border-ball/40 bg-ball/10 text-ball text-xs font-black">
                        🔍 Vincular a un jugador de NarvoQ
                      </button>
                    )}
                  </div>
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

      {/* Modal: vincular manualmente un roster con un usuario existente */}
      {linkFor && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-end lg:items-center overflow-y-auto"
          onClick={() => { setLinkFor(null); setLinkQuery(''); setLinkResults([]); }}>
          <div className="bg-[#0B0F16] border-2 border-white/15 rounded-t-3xl lg:rounded-2xl w-full max-w-lg mx-auto p-5 pb-10"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-display font-black text-lg">🔍 Vincular con NarvoQ</p>
              <button onClick={() => { setLinkFor(null); setLinkQuery(''); setLinkResults([]); }}
                className="w-9 h-9 rounded-full bg-white/10 text-white font-bold">✕</button>
            </div>
            <p className="text-white/60 text-sm mt-1">
              Buscá al jugador <b>{linkFor.first_name} {linkFor.last_name}</b> en NarvoQ para vincular.
            </p>

            <input autoFocus type="text" className="input mt-3"
              placeholder="Nombre, @usuario o celular…"
              value={linkQuery} onChange={e => setLinkQuery(e.target.value)} />

            {linkQuery.length >= 2 && (
              <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
                {linkResults.map(a => (
                  <div key={a.id} className="flex items-center gap-3 bg-white/5 rounded-xl p-2.5">
                    {a.avatar_url
                      ? <img src={a.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                      : <span className="w-10 h-10 rounded-full bg-grafito text-white text-sm font-display font-black flex items-center justify-center">
                          {a.first_name?.[0]?.toUpperCase()}
                        </span>}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{a.first_name} {a.last_name}</p>
                      <p className="text-white/50 text-xs truncate">
                        @{a.username} · cat. {a.category ?? '-'}
                        {a.phone ? ` · 📱 ${a.phone}` : ''}
                      </p>
                    </div>
                    <button onClick={() => vincularManual(linkFor.id, a)}
                      className="btn-ball !py-1.5 !px-3 text-xs shrink-0">
                      Vincular →
                    </button>
                  </div>
                ))}
                {linkResults.length === 0 && (
                  <p className="text-white/40 text-sm text-center py-4">Sin resultados</p>
                )}
              </div>
            )}
            {linkQuery.length < 2 && (
              <p className="text-white/40 text-xs mt-3 text-center">Escribí al menos 2 letras para buscar…</p>
            )}
          </div>
        </div>
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
