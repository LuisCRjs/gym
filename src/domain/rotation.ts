import type { SessionKey } from '../types.ts';

const CYCLE: SessionKey[] = ['UPPER_A', 'LOWER_A', 'UPPER_B', 'LOWER_B'];

// `lastKey` = sesión de la última Workout terminada (undefined si no hay historial).
export function nextSession(lastKey: SessionKey | undefined, includeUpperC: boolean): SessionKey {
  const cycle: SessionKey[] = includeUpperC ? [...CYCLE, 'UPPER_C'] : CYCLE;
  if (!lastKey) return cycle[0];
  const i = cycle.indexOf(lastKey);
  // Si la última no está en el ciclo (UPPER_C y luego se desactivó), se reinicia.
  return i === -1 ? cycle[0] : cycle[(i + 1) % cycle.length];
}
