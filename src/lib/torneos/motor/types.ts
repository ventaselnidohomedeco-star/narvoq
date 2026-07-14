// Tipos compartidos del motor de torneos.

export type MatchFormat = 'best_of_3_super_tb' | 'best_of_3_full' | 'single_set' | 'super_tiebreak';
export type SpecialResult = null | 'walkover' | 'abandono' | 'dq' | 'suspendido';
export type Round =
  | 'zona'       // fase de grupos
  | '16avos'     // preliminar (3º y 4º)
  | '8vos'
  | 'cuartos'
  | 'semi'
  | 'final';

export interface PairRef {
  id: string;
  seed?: number | null;
  label?: string;   // nombre corto para logs (opcional)
}

export interface SetScore { t1: number; t2: number; t1TieBreak?: number; t2TieBreak?: number; isSuperTB?: boolean; }

export interface MatchInput {
  id: string;
  round: Round;
  pair1_id: string | null;
  pair2_id: string | null;
  group_id?: string | null;
  order_index: number;
  sets?: SetScore[];
  winner_pair_id?: string | null;
  special_result?: SpecialResult;
  special_winner_pair_id?: string | null;
}

export interface GroupStanding {
  pair_id: string;
  pj: number; pg: number; pp: number;
  sf: number; sc: number; ds: number;   // sets a favor / en contra / diferencia
  gf: number; gc: number; dg: number;   // games
  pts: number;
  tied_with?: string[];                 // ids empatados en pts
  final_position?: number;              // se llena al finalizar el grupo
}

export interface RecommendedFormat {
  totalPairs: number;
  groups: { count: number; sizes: number[] };  // ej: {count: 4, sizes: [4,4,4,4]}
  qualifiersPerGroup: 2;                        // siempre 2 pasan directo o via preliminar
  preliminaryRound: boolean;                    // true si 3º y 4º juegan 16avos
  firstKnockoutRound: Round;                    // '8vos' | 'cuartos' | 'semi' | 'final'
  totalKnockoutRounds: Round[];
  notes: string[];
}
