import { describe, it, expect } from 'vitest';
import { validateBracket, ValidatorMatch } from '../validator';
import { buildBracket, Qualifier } from '../bracket';

function mkQ(sizes: number[]): Qualifier[] {
  const out: Qualifier[] = [];
  sizes.forEach((size, gi) => {
    const label = String.fromCharCode(65 + gi);
    for (let pos = 1; pos <= size; pos++) {
      out.push({ pair_id: `g${label}p${pos}`, group_label: label, group_position: pos });
    }
  });
  return out;
}

describe('validateBracket - bloqueantes', () => {
  it('detecta pareja duplicada en la misma ronda', () => {
    const bracket: ValidatorMatch[] = [
      { round: '8vos', order_index: 0, pair1_id: 'P1', pair2_id: 'P2' },
      { round: '8vos', order_index: 1, pair1_id: 'P1', pair2_id: 'P3' }
    ];
    const r = validateBracket({ bracket });
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.code === 'DUPLICATE_PAIR')).toBe(true);
  });

  it('detecta octavos con cantidad distinta de 16 parejas (18 → error)', () => {
    // 9 matches × 2 parejas = 18. Rechaza.
    const bracket: ValidatorMatch[] = [];
    for (let i = 0; i < 9; i++) {
      bracket.push({ round: '8vos', order_index: i, pair1_id: `A${i}`, pair2_id: `B${i}` });
    }
    const r = validateBracket({ bracket });
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.code === 'ROUND_WRONG_SIZE')).toBe(true);
  });

  it('acepta octavos con exactamente 16 parejas', () => {
    const bracket: ValidatorMatch[] = [];
    for (let i = 0; i < 8; i++) {
      bracket.push({ round: '8vos', order_index: i, pair1_id: `A${i}`, pair2_id: `B${i}` });
    }
    // Agregamos rondas siguientes para que ganadores tengan destino
    for (let i = 0; i < 4; i++) {
      bracket.push({ round: 'cuartos', order_index: i, pair1_id: null, pair2_id: null,
        pair1_from: `8vos:${i * 2}`, pair2_from: `8vos:${i * 2 + 1}` });
    }
    for (let i = 0; i < 2; i++) {
      bracket.push({ round: 'semi', order_index: i, pair1_id: null, pair2_id: null,
        pair1_from: `cuartos:${i * 2}`, pair2_from: `cuartos:${i * 2 + 1}` });
    }
    bracket.push({ round: 'final', order_index: 0, pair1_id: null, pair2_id: null,
      pair1_from: `semi:0`, pair2_from: `semi:1` });

    const r = validateBracket({ bracket });
    const roundSizeErrors = r.errors.filter(e => e.code === 'ROUND_WRONG_SIZE');
    expect(roundSizeErrors).toHaveLength(0);
  });

  it('detecta ganador sin destino (partido intermedio huérfano)', () => {
    const bracket: ValidatorMatch[] = [
      { round: '8vos', order_index: 0, pair1_id: 'A', pair2_id: 'B' },
      // No hay ningún cuartos ni siguiente que referencie 8vos:0
    ];
    const r = validateBracket({ bracket });
    expect(r.errors.some(e => e.code === 'WINNER_WITHOUT_DESTINATION')).toBe(true);
  });

  it('la FINAL no requiere destino (es el último match)', () => {
    const bracket: ValidatorMatch[] = [
      { round: 'final', order_index: 0, pair1_id: 'A', pair2_id: 'B' }
    ];
    const r = validateBracket({ bracket });
    expect(r.errors.some(e => e.code === 'WINNER_WITHOUT_DESTINATION')).toBe(false);
  });

  it('detecta partido totalmente incompleto (sin parejas ni from)', () => {
    const bracket: ValidatorMatch[] = [
      { round: '8vos', order_index: 0, pair1_id: null, pair2_id: null }
    ];
    const r = validateBracket({ bracket });
    expect(r.errors.some(e => e.code === 'INCOMPLETE_MATCH')).toBe(true);
  });

  it('detecta pareja inscripta sin destino', () => {
    const bracket: ValidatorMatch[] = [
      { round: 'final', order_index: 0, pair1_id: 'A', pair2_id: 'B' }
    ];
    const r = validateBracket({
      bracket,
      allPairIds: ['A', 'B', 'C'],   // C está inscripta pero no ubicada
      eliminatedInGroups: []
    });
    expect(r.errors.some(e => e.code === 'PAIR_WITHOUT_DESTINATION')).toBe(true);
  });

  it('detecta pareja eliminada que reaparece', () => {
    const bracket: ValidatorMatch[] = [
      { round: 'final', order_index: 0, pair1_id: 'A', pair2_id: 'X' }
    ];
    const r = validateBracket({
      bracket,
      eliminatedInGroups: ['X']
    });
    expect(r.errors.some(e => e.code === 'ELIMINATED_PAIR_REAPPEARS')).toBe(true);
  });
});

describe('validateBracket - advertencias', () => {
  it('detecta revancha del mismo grupo', () => {
    const bracket: ValidatorMatch[] = [
      { round: 'semi', order_index: 0, pair1_id: 'A', pair2_id: 'B' },
      { round: 'final', order_index: 0, pair1_id: null, pair2_id: null,
        pair1_from: `semi:0`, pair2_from: 'semi:1' },
      { round: 'semi', order_index: 1, pair1_id: 'C', pair2_id: 'D' },
    ];
    const r = validateBracket({
      bracket,
      groupMatches: [{ pair1_id: 'A', pair2_id: 'B' }]  // A vs B ya se jugó en grupos
    });
    expect(r.warnings.some(w => w.code === 'GROUP_REMATCH')).toBe(true);
  });

  it('detecta dos primeros enfrentándose en primera KO', () => {
    const bracket: ValidatorMatch[] = [
      { round: '8vos', order_index: 0, pair1_id: 'A', pair2_id: 'B',
        pair1_path_hint: 'direct_from_1st', pair2_path_hint: 'direct_from_1st' }
    ];
    const r = validateBracket({ bracket });
    expect(r.warnings.some(w => w.code === 'TWO_FIRSTS_MEETING')).toBe(true);
  });
});

describe('validateBracket - integración con buildBracket', () => {
  it('el bracket generado para 22 parejas PASA la validación (sin bloqueantes)', () => {
    const qs = mkQ([4, 4, 4, 4, 3, 3]);
    const bracket = buildBracket(qs);
    // Todos los pair_from se preservan tal cual, validator los acepta.
    const r = validateBracket({ bracket: bracket as ValidatorMatch[] });
    // No debe haber errores bloqueantes
    if (!r.ok) {
      // Log útil si falla
      console.log('Errores:', r.errors);
    }
    expect(r.ok).toBe(true);
  });

  it('el bracket generado para 16 parejas (sin preliminar) PASA', () => {
    const qs = mkQ([4, 4, 4, 4]);
    const bracket = buildBracket(qs);
    const r = validateBracket({ bracket: bracket as ValidatorMatch[] });
    expect(r.ok).toBe(true);
  });

  it('el bracket generado para 8 parejas PASA', () => {
    const qs = mkQ([4, 4]);
    const bracket = buildBracket(qs);
    const r = validateBracket({ bracket: bracket as ValidatorMatch[] });
    expect(r.ok).toBe(true);
  });

  it('el bracket generado para 12 parejas PASA', () => {
    const qs = mkQ([4, 4, 4]);
    const bracket = buildBracket(qs);
    const r = validateBracket({ bracket: bracket as ValidatorMatch[] });
    expect(r.ok).toBe(true);
  });
});
