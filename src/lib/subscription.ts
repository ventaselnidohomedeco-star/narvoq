'use client';
import { useEffect, useState } from 'react';
import { supabase } from './supabase/client';

// Estado de suscripción de un usuario. Fuente de verdad rápida: los campos
// is_premium + premium_expires_at en profiles (los mantiene el trigger SQL).
// Para info detallada (plan, próxima renovación) hay que ir a la tabla subscriptions.

export type SubscriptionStatus = {
  isPremium: boolean;
  expiresAt: string | null;
  loading: boolean;
};

// Hook que devuelve el estado de suscripción del usuario logueado.
export function useSubscription(): SubscriptionStatus {
  const [state, setState] = useState<SubscriptionStatus>({ isPremium: false, expiresAt: null, loading: true });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setState({ isPremium: false, expiresAt: null, loading: false }); return; }
      const { data } = await supabase.from('profiles')
        .select('is_premium, premium_expires_at')
        .eq('id', user.id).maybeSingle();
      setState({
        isPremium: !!data?.is_premium,
        expiresAt: data?.premium_expires_at ?? null,
        loading: false
      });
    })();
  }, []);

  return state;
}

// Chequeo NO-hook (dentro de funciones async, sin React).
export async function isPremiumUser(userId?: string): Promise<boolean> {
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    userId = user.id;
  }
  const { data } = await supabase.from('profiles').select('is_premium').eq('id', userId).maybeSingle();
  return !!data?.is_premium;
}

export async function isPremiumComplex(complexId: string): Promise<boolean> {
  const { data } = await supabase.from('complexes').select('is_premium').eq('id', complexId).maybeSingle();
  return !!data?.is_premium;
}
