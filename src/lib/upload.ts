'use client';
import { supabase } from './supabase/client';

/**
 * Sube una imagen al bucket "media" (achicada a máx 1200px para que cargue rápido)
 * y devuelve su URL pública. Devuelve null si falla.
 */
export async function uploadImage(file: File, folder: string): Promise<string | null> {
  try {
    const resized = await resize(file, 1200);
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await supabase.storage.from('media').upload(path, resized, {
      contentType: 'image/jpeg', upsert: false
    });
    if (error) { console.error(error); return null; }
    const { data } = supabase.storage.from('media').getPublicUrl(path);
    return data.publicUrl;
  } catch (e) { console.error(e); return null; }
}

async function resize(file: File, maxSide: number): Promise<Blob> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise(res => canvas.toBlob(b => res(b!), 'image/jpeg', 0.85));
}
