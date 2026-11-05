import { db } from './db';
import { todayISO } from '../domain/plan-week.ts';
import type { Plan, Settings, Workout } from '../types';

// plan.json es la fuente de verdad: se vuelve a copiar a la base en cada arranque.
export async function syncPlan(): Promise<void> {
  const res = await fetch('/plan.json');
  const { exercises, slots } = await res.json();
  await db.plan.put({ id: 1, exercises, slots });
}

export function getPlan(): Promise<Plan | undefined> {
  return db.plan.get(1);
}

// Si aún no hay ajustes (antes de la pantalla de Bienvenida), crea unos por defecto:
// el plan arranca hoy y sin Upper C.
export async function getSettings(): Promise<Settings> {
  const saved = await db.settings.get(1);
  if (saved) return saved;
  const defaults: Settings = { id: 1, planStartDate: todayISO(), includeUpperC: false };
  await db.settings.put(defaults);
  return defaults;
}

// finishedAt está indexado; las sesiones sin terminar no entran al índice, así que
// orderBy('finishedAt') solo recorre las terminadas.
export function getLastFinishedWorkout(): Promise<Workout | undefined> {
  return db.workouts.orderBy('finishedAt').last();
}

export function getInProgressWorkout(): Promise<Workout | undefined> {
  return db.workouts.filter((w) => w.finishedAt === undefined).first();
}
