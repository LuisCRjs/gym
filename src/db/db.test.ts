// fake-indexeddb debe cargarse primero: da a Dexie una IndexedDB dentro de Node.
import 'fake-indexeddb/auto';
import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { db } from './db.ts';
import type { Workout } from '../types.ts';

const workout = (id: string, finishedAt?: number): Workout => ({
  id,
  sessionKey: 'UPPER_B',
  mode: 'full',
  startedAt: 1,
  finishedAt,
  entries: [
    {
      exerciseId: 'press-inclinado-mancuernas',
      unit: 'lb',
      perSide: true,
      repMin: 8,
      repMax: 12,
      sets: [
        { weight: 35, value: 12, done: true },
        { weight: 35, value: 10, done: false },
      ],
    },
  ],
});

beforeEach(async () => {
  await db.workouts.clear();
});

// Guardia: cambiar la versión del esquema sin migración borraría o rompería datos reales.
// Si este test falla al subir la versión, escribe el upgrade en db.ts y luego actualiza el número.
test('db: esquema en versión 1 (cambiar requiere migración)', () => {
  assert.equal(db.verno, 1);
});

test('db: una sesión con entradas anidadas sobrevive al guardar y leer', async () => {
  await db.workouts.put(workout('a', 500));
  const back = await db.workouts.get('a');
  assert.deepEqual(back, workout('a', 500));
});

// repo.ts asume que las sesiones en curso (sin finishedAt) no entran al índice finishedAt.
test('db: el índice finishedAt deja fuera las sesiones en curso y ordena por fecha', async () => {
  await db.workouts.bulkPut([workout('old', 100), workout('running'), workout('new', 300)]);
  const last = await db.workouts.orderBy('finishedAt').last();
  assert.equal(last?.id, 'new');
  const all = await db.workouts.orderBy('finishedAt').toArray();
  assert.deepEqual(all.map((w) => w.id), ['old', 'new']);
});
