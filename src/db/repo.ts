import { db } from './db';
import { buildEntry, entriesFor, lastEntryFor, preferredExerciseId, slotsFor } from '../domain/entry.ts';
import { planWeek, setsForWeek, todayISO } from '../domain/plan-week.ts';
import type { Backup, Entry, Measurement, Plan, SessionKey, Settings, Workout } from '../types';

// plan.json es la fuente de verdad: se vuelve a copiar a la base en cada arranque.
export async function syncPlan(): Promise<void> {
  // BASE_URL = '/gym/' en GitHub Pages (la app vive en una subruta), '/' en local.
  const res = await fetch(`${import.meta.env.BASE_URL}plan.json`);
  const { exercises, slots } = await res.json();
  await db.plan.put({ id: 1, exercises, slots });
}

export function getPlan(): Promise<Plan | undefined> {
  return db.plan.get(1);
}

// Sin ajustes guardados = primera vez que se abre la app (se muestra la Bienvenida).
export async function hasSettings(): Promise<boolean> {
  return (await db.settings.get(1)) !== undefined;
}

// Si aún no hay ajustes, crea unos por defecto: el plan arranca hoy y sin Upper C.
export async function getSettings(): Promise<Settings> {
  const saved = await db.settings.get(1);
  if (saved) return saved;
  const defaults: Settings = { id: 1, planStartDate: todayISO(), includeUpperC: false };
  await db.settings.put(defaults);
  return defaults;
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await db.settings.put(next);
  return next;
}

// ---------- Respaldo ----------
const SCHEMA_VERSION = 1;

export async function exportBackup(): Promise<Backup> {
  const [settings, workouts, measurements] = await Promise.all([
    getSettings(),
    db.workouts.toArray(),
    db.measurements.toArray(),
  ]);
  return { schemaVersion: SCHEMA_VERSION, exportedAt: Date.now(), settings, workouts, measurements };
}

// Revisión mínima antes de borrar nada: que tenga la forma esperada.
export function parseBackup(data: unknown): Backup {
  const b = data as Backup;
  if (!b || typeof b !== 'object' || typeof b.schemaVersion !== 'number') {
    throw new Error('El archivo no es un respaldo de Gym Tracker.');
  }
  if (b.schemaVersion > SCHEMA_VERSION) {
    throw new Error('El respaldo es de una versión más nueva de la app. Actualízala primero.');
  }
  if (!b.settings || !Array.isArray(b.workouts) || !Array.isArray(b.measurements)) {
    throw new Error('El respaldo está incompleto.');
  }
  return b;
}

// Copia de los datos justo antes de una importación, para poder deshacerla. Vive en
// localStorage (es pequeña) y se borra al deshacer. Si el guardado falla, no se importa.
const UNDO_KEY = 'gym-tracker-undo-import';

export async function saveUndoBackup(): Promise<void> {
  localStorage.setItem(UNDO_KEY, JSON.stringify(await exportBackup()));
}

export function getUndoBackup(): Backup | undefined {
  const raw = localStorage.getItem(UNDO_KEY);
  return raw ? (JSON.parse(raw) as Backup) : undefined;
}

export function clearUndoBackup(): void {
  localStorage.removeItem(UNDO_KEY);
}

// Reemplaza todo. La transacción garantiza que, si algo falla a mitad, no se borra nada.
export async function importBackup(backup: Backup): Promise<void> {
  await db.transaction('rw', db.workouts, db.measurements, db.settings, async () => {
    await Promise.all([db.workouts.clear(), db.measurements.clear(), db.settings.clear()]);
    await db.workouts.bulkPut(backup.workouts);
    await db.measurements.bulkPut(backup.measurements);
    await db.settings.put({ ...backup.settings, id: 1 });
  });
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
export function getFinishedWorkouts(): Promise<Workout[]> {
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

export function getMeasurements(): Promise<Measurement[]> {
  return db.measurements.orderBy('date').reverse().toArray();
}

export async function addMeasurement(date: string, type: Measurement['type'], value: number) {
  await db.measurements.put({ id: newId(), date, type, value });
}

export async function deleteMeasurement(id: string): Promise<void> {
  await db.measurements.delete(id);
}

export async function getEntryHistory(exerciseId: string): Promise<Entry[]> {
  return entriesFor(await getFinishedWorkouts(), exerciseId);
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
