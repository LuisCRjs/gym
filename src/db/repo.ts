import { db } from './db';
import { buildEntry, lastEntryFor, preferredExerciseId, slotsFor } from '../domain/entry.ts';
import { planWeek, setsForWeek, todayISO } from '../domain/plan-week.ts';
import type { Entry, Plan, SessionKey, Settings, Workout } from '../types';

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

// ~55 sesiones en 12 semanas: leerlas todas es instantáneo.
function getFinishedWorkouts(): Promise<Workout[]> {
  return db.workouts.orderBy('finishedAt').reverse().toArray();
}

export function getWorkout(id: string): Promise<Workout | undefined> {
  return db.workouts.get(id);
}

export async function saveWorkout(workout: Workout): Promise<void> {
  await db.workouts.put(workout);
}

export async function deleteWorkout(id: string): Promise<void> {
  await db.workouts.delete(id);
}

export async function getLastEntry(exerciseId: string): Promise<Entry | undefined> {
  return lastEntryFor(await getFinishedWorkouts(), exerciseId);
}

// crypto.randomUUID solo existe en HTTPS/localhost; probando por IP en el celular no.
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export async function startWorkout(sessionKey: SessionKey, mode: 'full' | 'short'): Promise<Workout> {
  const [plan, settings, history] = await Promise.all([getPlan(), getSettings(), getFinishedWorkouts()]);
  if (!plan) throw new Error('El plan no está cargado');

  const week = planWeek(settings.planStartDate, todayISO());
  const entries = slotsFor(plan.slots, sessionKey, mode).map((slot) => {
    const id = preferredExerciseId(slot, history, sessionKey);
    const exercise = plan.exercises.find((e) => e.id === id)!;
    return buildEntry(slot, exercise, setsForWeek(slot.sets, week), lastEntryFor(history, id));
  });

  const workout: Workout = { id: newId(), sessionKey, mode, startedAt: Date.now(), entries };
  await db.workouts.put(workout);
  return workout;
}
