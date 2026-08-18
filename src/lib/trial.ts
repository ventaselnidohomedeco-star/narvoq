// Trial automático Premium al registrarse.
// Todos los usuarios nuevos reciben TRIAL_DAYS días de Premium gratis.

export const TRIAL_DAYS = 60;

// Devuelve la fecha ISO de vencimiento del trial (now + TRIAL_DAYS).
export function trialExpiresAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + TRIAL_DAYS);
  return d.toISOString();
}

// Fields para insertar en profiles (nuevo user).
export function trialProfileFields() {
  return { is_premium: true, premium_expires_at: trialExpiresAt() };
}

// Fields para insertar en complexes (nuevo complejo).
export function trialComplexFields() {
  return { is_premium: true, premium_expires_at: trialExpiresAt() };
}

// Días restantes del trial. Devuelve null si no está en trial.
export function daysLeft(premiumExpiresAt: string | null | undefined): number | null {
  if (!premiumExpiresAt) return null;
  const ms = new Date(premiumExpiresAt).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 3600 * 1000));
}
