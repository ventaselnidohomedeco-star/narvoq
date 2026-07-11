'use client';
import { sharePlaca, type PlacaData } from '@/lib/placas';

export default function PlacaButton({ data, children }: { data: PlacaData; children?: React.ReactNode }) {
  return (
    <button onClick={() => sharePlaca(data)}
      className="inline-flex items-center gap-1 bg-ball text-courtdark font-display font-bold rounded-lg px-3 py-1.5 text-xs active:scale-95 transition">
      {children ?? '📸 Placa'}
    </button>
  );
}
