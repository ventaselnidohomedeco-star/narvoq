// Genera un archivo .xls a partir de filas — usando el formato HTML que Excel
// abre nativo (con estilos: negrita, fondo, alineación). Sin dependencias.
// También parsea .xls (HTML) para importar.

export function parseXlsHtml(html: string): Record<string, string>[] {
  // Extrae las filas del primer <table> del HTML de Excel
  const clean = html.replace(/\r?\n/g, ' ');
  const tableMatch = clean.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return [];
  const trs = Array.from(tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi));
  if (trs.length === 0) return [];

  const rows: string[][] = trs.map(tr => {
    const cells = Array.from(tr[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi))
      .map(c => stripHtml(c[1]).trim());
    return cells;
  });

  if (rows.length === 0) return [];
  const headers = rows[0];
  return rows.slice(1)
    .filter(r => r.some(v => v))
    .map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

type Cell = { value: string | number; header?: boolean };
type Row = Cell[];

const BALL_GREEN = '#C6FF00';       // color ball de NarvoQ
const HEADER_BG = '#C6FF00';
const HEADER_FG = '#0B0F16';

export function downloadXls(filename: string, headers: string[], rows: (string | number)[][]) {
  const style = `
    <style>
      table { border-collapse: collapse; font-family: Arial, sans-serif; }
      th { background: ${HEADER_BG}; color: ${HEADER_FG}; font-weight: bold; padding: 10px 12px; text-align: left; border: 1px solid #666; font-size: 12pt; }
      td { padding: 8px 12px; border: 1px solid #ccc; font-size: 11pt; }
      td.num { text-align: right; }
      tr.guide td { background: #FFF9C4; font-style: italic; color: #666; }
    </style>
  `;
  const th = headers.map(h => `<th>${escape(h)}</th>`).join('');
  const trs = rows.map((r, idx) => {
    const isGuide = String(r[0] ?? '').startsWith('👉');
    const cls = isGuide ? 'guide' : '';
    const cells = r.map((v, i) => {
      const isNum = typeof v === 'number';
      return `<td class="${isNum ? 'num' : ''}">${escape(String(v ?? ''))}</td>`;
    }).join('');
    return `<tr class="${cls}">${cells}</tr>`;
  }).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">${style}</head><body>
    <table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>
  </body></html>`;

  // BOM + type application/vnd.ms-excel para que Excel lo reconozca
  const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
