export type Role = 'player' | 'complex_admin' | 'super_admin' | 'coach';
export type Sex = 'M' | 'F' | 'X';

export interface Profile {
  id: string; role: Role; username: string; first_name: string; last_name: string;
  phone: string; age: number; sex: Sex; city_id: string | null; zone: string | null;
  category: number; avatar_url: string | null;
}
export interface Complex {
  id: string; owner_id: string; name: string; responsible: string; phone: string;
  email: string; city_id: string; address: string; logo_url: string | null;
  open_time: string; close_time: string; slot_minutes: number; cancel_hours: number;
}
export interface Court {
  id: string; complex_id: string; name: string; surface: string;
  covered: boolean; price_per_slot: number; active: boolean;
}
export interface Booking {
  id: string; court_id: string; player_id: string | null; type: 'reserva' | 'block';
  status: 'pendiente' | 'confirmada' | 'completa' | 'cancelada' | 'jugada';
  starts_at: string; ends_at: string; price: number | null;
}
