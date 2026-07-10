'use client';
import { useRef, useState } from 'react';
import { uploadImage } from '@/lib/upload';

interface Props {
  folder: string;                       // carpeta en el bucket: avatars | logos | courts | posts
  current?: string | null;              // URL actual (para mostrar preview)
  onUploaded: (url: string) => void;    // callback con la URL pública
  shape?: 'circle' | 'wide';            // círculo (avatar/logo) o rectángulo (cancha/post)
  label?: string;
}

export default function PhotoPicker({ folder, current, onUploaded, shape = 'circle', label }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(current ?? null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const url = await uploadImage(file, folder);
    setBusy(false);
    if (url) { setPreview(url); onUploaded(url); }
    else alert('No pudimos subir la imagen. Verificá que ejecutaste update-01-fotos.sql en Supabase.');
  }

  const base = shape === 'circle'
    ? 'w-24 h-24 rounded-full'
    : 'w-full aspect-video rounded-xl';

  return (
    <div>
      {label && <p className="label">{label}</p>}
      <button type="button" onClick={() => input.current?.click()}
        className={`${base} overflow-hidden border-2 border-dashed border-slate-300 bg-white/5
          flex items-center justify-center relative active:scale-95 transition`}>
        {preview
          ? <img src={preview} alt="" className="absolute inset-0 w-full h-full object-cover" />
          : <span className="text-white/50 text-sm font-semibold">📷 Subir foto</span>}
        {busy && (
          <span className="absolute inset-0 bg-black/50 text-white flex items-center justify-center text-sm font-bold">
            Subiendo…
          </span>
        )}
      </button>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={pick} />
    </div>
  );
}
