import type { Entry } from '../types.ts';
import { STEP } from './units.ts';

export interface Suggestion {
  kind: 'up' | 'down';
  weight: number; // en la unidad de la última entrada
  reps: number; // con el peso nuevo se vuelve al mínimo del rango
}

const doneSets = (e: Entry) => e.sets.filter((s) => s.done);
const workingWeight = (e: Entry) => Math.max(...doneSets(e).map((s) => s.weight));
const failedMin = (e: Entry) => doneSets(e).some((s) => s.value < e.repMin);
const isPin = (e: Entry) => e.unit === 'pin';

// `history`: entradas de UN ejercicio en sesiones terminadas, la más reciente primero.
// Sin sugerencia en semanas de descarga ni si la última entrada no tiene series hechas.
export function suggest(history: Entry[], deload: boolean): Suggestion | null {
  const last = history[0];
  if (deload || !last || doneSets(last).length === 0) return null;

  const weight = workingWeight(last);
  const step = STEP[last.unit];

  // Subir: todas las series hechas llegaron a repMax.
  if (doneSets(last).every((s) => s.value >= last.repMax)) {
    return { kind: 'up', weight: weight + step, reps: last.repMin };
  }

  // Bajar: falló repMin en 2 sesiones seguidas. Si la anterior fue en otra "familia"
  // de unidad (pin vs kg/lb) no son comparables, así que no cuenta.
  const prev = history[1];
  if (prev && isPin(prev) === isPin(last) && failedMin(last) && failedMin(prev) && weight > 0) {
    const lower = isPin(last)
      ? weight - 1
      : Math.min(Math.round((weight * 0.925) / step) * step, weight - step); // ~7.5%, a múltiplo del salto
    return { kind: 'down', weight: Math.max(lower, 0), reps: last.repMin };
  }

  return null;
}
