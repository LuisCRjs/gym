import type { Unit } from '../types.ts';

export const STEP: Record<Unit, number> = { kg: 2.5, lb: 5, pin: 1 };
export const KG_TO_LB = 2.2046;

// kg <-> lb se convierte; `pin` no es un peso, así que no se convierte (null).
export function convertWeight(value: number, from: Unit, to: Unit): number | null {
  if (from === to) return value;
  if (from === 'pin' || to === 'pin') return null;
  const converted = from === 'kg' ? value * KG_TO_LB : value / KG_TO_LB;
  return Math.round(converted * 10) / 10;
}
