import { supabase } from './supabase/client';

// Helper para crear una notificación. Se puede llamar desde cualquier
// componente cliente después de un evento (like, comentario, etc.).
export type NotifyKind =
  | 'like' | 'comment' | 'reserva_ok' | 'membresia_ok'
  | 'coach_add' | 'training_new' | 'torneo_nuevo' | 'mencion';

export async function notify(input: {
  user_id: string;
  kind: NotifyKind;
  title: string;
  body?: string | null;
  link?: string | null;
  ref_id?: string | null;
}) {
  if (!input.user_id) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.id === input.user_id) return; // no notificar sobre uno mismo
  await supabase.from('notifications').insert({
    user_id: input.user_id,
    kind: input.kind,
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
    ref_id: input.ref_id ?? null
  });
}
