// Punto único de entrada del motor de torneos.
export { recommendFormat, distributeGroups } from './recommend';
export { buildGroups, roundRobinMatches } from './groups';
export { computeStandings } from './standings';
export { buildBracket, type Qualifier, type BracketMatchSpec } from './bracket';
export { determineWinner, validateSets, propagateWinner, roundOrder } from './advance';
export type * from './types';
