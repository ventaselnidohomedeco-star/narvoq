'use client';
import { sharePlaca, type PlacaData } from '@/lib/placas';

export default function PlacaButton({ data, children }: { data: PlacaData; children?: React.ReactNode }) {
  return (
    <button onClick={() => sharePlaca(data)} className="btn-ball text-sm">
      {children ?? '📸 Compartir placa'}
    </button>
  );
}
