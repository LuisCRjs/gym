import { db } from './db';
import type { Plan } from '../types';

// plan.json es la fuente de verdad: se vuelve a copiar a la base en cada arranque.
export async function syncPlan(): Promise<void> {
  const res = await fetch('/plan.json');
  const { exercises, slots } = await res.json();
  await db.plan.put({ id: 1, exercises, slots });
}

export function getPlan(): Promise<Plan | undefined> {
  return db.plan.get(1);
}
