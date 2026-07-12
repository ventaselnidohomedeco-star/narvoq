// Utilidades para calcular descuentos de horarios de baja demanda.

export type OffpeakRule = {
  id: string;
  complex_id: string;
  name: string;
  weekdays: number[];       // 0=domingo, 6=sábado
  from_time: string;        // 'HH:MM' o 'HH:MM:SS'
  to_time: string;
  discount_pct: number;     // 1..90
  active: boolean;
};

function toMinutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m ?? 0);
}

// Devuelve la regla aplicable al turno (si hay), sino null.
export function ruleFor(date: Date, rules: OffpeakRule[]): OffpeakRule | null {
  const dow = date.getDay();
  const minutes = date.getHours() * 60 + date.getMinutes();
  return rules.find(r =>
    r.active &&
    r.weekdays.includes(dow) &&
    minutes >= toMinutes(r.from_time) &&
    minutes < toMinutes(r.to_time)
  ) ?? null;
}

export function priceWithRule(base: number, rule: OffpeakRule | null): number {
  if (!rule) return base;
  return Math.round(base * (100 - rule.discount_pct) / 100);
}
