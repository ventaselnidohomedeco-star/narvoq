import type { Booking } from './types';

export interface Slot { start: Date; end: Date; free: boolean; }

/**
 * Disponibilidad calculada: horario del complejo − reservas − bloqueos.
 * Nunca se guardan slots en la base: se derivan siempre.
 */
export function buildSlots(
  date: Date, openTime: string, closeTime: string,
  slotMinutes: number, bookings: Booking[]
): Slot[] {
  const [oh, om] = openTime.split(':').map(Number);
  const [ch, cm] = closeTime.split(':').map(Number);
  const start = new Date(date); start.setHours(oh, om, 0, 0);
  const end = new Date(date); end.setHours(ch, cm, 0, 0);
  if (end <= start) end.setDate(end.getDate() + 1); // cierra pasada la medianoche

  const slots: Slot[] = [];
  for (let t = new Date(start); t < end; t = new Date(t.getTime() + slotMinutes * 60000)) {
    const slotEnd = new Date(t.getTime() + slotMinutes * 60000);
    const taken = bookings.some(b =>
      b.status !== 'cancelada' &&
      new Date(b.starts_at) < slotEnd && new Date(b.ends_at) > t
    );
    slots.push({ start: new Date(t), end: slotEnd, free: !taken && t > new Date() });
  }
  return slots;
}
