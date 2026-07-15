import type { Round, RoundName } from './types';

// Mapeo Round (motor legacy) ↔ RoundName (canónico spec).
// El motor internamente sigue trabajando con Round; RoundName se usa para
// validaciones estrictas y presentación.

export function toCanonical(r: Round): RoundName {
  switch (r) {
    case 'zona': return 'GROUP';
    case '32avos': return 'PLAY_IN';
    case '16avos': return 'PRELIMINARY';
    case '8vos': return 'ROUND_OF_16';
    case 'cuartos': return 'QUARTERFINAL';
    case 'semi': return 'SEMIFINAL';
    case 'final': return 'FINAL';
  }
}

export function fromCanonical(r: RoundName): Round | null {
  switch (r) {
    case 'GROUP': return 'zona';
    case 'PLAY_IN': return '32avos';
    case 'PRELIMINARY': return '16avos';
    case 'MAIN_ACCESS': return '8vos';         // alias práctico
    case 'ROUND_OF_32': return null;           // no soportado hoy
    case 'ROUND_OF_16': return '8vos';
    case 'QUARTERFINAL': return 'cuartos';
    case 'SEMIFINAL': return 'semi';
    case 'FINAL': return 'final';
    case 'CUSTOM': return null;
  }
}

// Nombre legible en español para la UI.
export function displayRound(r: Round | RoundName): string {
  const canonical: RoundName = isCanonical(r) ? r as RoundName : toCanonical(r as Round);
  switch (canonical) {
    case 'GROUP': return 'Fase de grupos';
    case 'PLAY_IN': return 'Play-in';
    case 'PRELIMINARY': return 'Preliminar';
    case 'MAIN_ACCESS': return 'Acceso principal';
    case 'ROUND_OF_32': return '16avos';
    case 'ROUND_OF_16': return 'Octavos';
    case 'QUARTERFINAL': return 'Cuartos';
    case 'SEMIFINAL': return 'Semifinal';
    case 'FINAL': return 'Final';
    case 'CUSTOM': return 'Ronda';
  }
}

// Etiqueta SQL/DB (compatible con lo persistido hoy en tournament_matches.round)
export function toSqlRound(r: Round): string {
  switch (r) {
    case 'zona': return 'Zona';
    case '32avos': return 'Play-in';
    case '16avos': return 'Preliminar';
    case '8vos': return 'Octavos';
    case 'cuartos': return 'Cuartos';
    case 'semi': return 'Semifinal';
    case 'final': return 'Final';
  }
}

function isCanonical(r: string): boolean {
  return /^(GROUP|PLAY_IN|PRELIMINARY|MAIN_ACCESS|ROUND_OF_32|ROUND_OF_16|QUARTERFINAL|SEMIFINAL|FINAL|CUSTOM)$/.test(r);
}
