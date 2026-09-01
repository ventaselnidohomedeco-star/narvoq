// Genera y parsea archivos Excel reales (.xlsx) con exceljs.
// Headers en negrita con fondo verde NarvoQ. Sin warnings al abrir.

import ExcelJS from 'exceljs';

const BALL_GREEN = 'FFC6FF00';    // ARGB: verde NarvoQ
const HEADER_TEXT = 'FF0B0F16';   // grafito
const GUIDE_BG   = 'FFFFF9C4';    // amarillo suave

export async function downloadXls(filename: string, headers: string[], rows: (string | number)[][]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Productos');

  // Header
  ws.addRow(headers);
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: HEADER_TEXT }, size: 12 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BALL_GREEN } };
  headerRow.alignment = { horizontal: 'left', vertical: 'middle' };
  headerRow.height = 22;
  headerRow.eachCell(cell => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF666666' } },
      bottom: { style: 'thin', color: { argb: 'FF666666' } },
      left: { style: 'thin', color: { argb: 'FF666666' } },
      right: { style: 'thin', color: { argb: 'FF666666' } }
    };
  });

  // Filas de datos
  rows.forEach((r, idx) => {
    const row = ws.addRow(r);
    const isGuide = String(r[0] ?? '').startsWith('👉');
    if (isGuide) {
      row.font = { italic: true, color: { argb: 'FF666666' } };
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GUIDE_BG } };
    }
    row.eachCell(cell => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
      };
    });
  });

  // Auto-width por columna
  headers.forEach((h, i) => {
    const col = ws.getColumn(i + 1);
    const maxLen = Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length));
    col.width = Math.min(60, Math.max(12, maxLen + 2));
  });

  // Congelar la primera fila
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  // Descargar
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : filename.replace(/\.xls$/, '.xlsx').replace(/(\.xlsx)?$/, '.xlsx');
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Parsea un .xlsx a array de objetos { Header: value, ... }
export async function parseXlsxFile(file: File): Promise<Record<string, string>[]> {
  const buffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];

  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: false }, row => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cells[colNumber - 1] = cell.value == null ? '' : String((cell.value as any).text ?? cell.value);
    });
    rows.push(cells);
  });

  if (rows.length === 0) return [];
  const headers = rows[0].map(h => (h ?? '').trim());
  return rows.slice(1)
    .filter(r => r.some(v => (v ?? '').trim() !== ''))
    .map(r => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()])));
}
