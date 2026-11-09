import Dexie, { type EntityTable } from 'dexie';
import type { Measurement, Plan, Settings, Workout } from '../types';

export const db = new Dexie('gym-tracker') as Dexie & {
  workouts: EntityTable<Workout, 'id'>;
  measurements: EntityTable<Measurement, 'id'>;
  settings: EntityTable<Settings, 'id'>;
  plan: EntityTable<Plan, 'id'>;
};

// Migraciones: NUNCA cambies una versión ya publicada. Para cambiar la forma de los datos:
//   1. Añade db.version(2).stores({...}) con los cambios de índices (si los hay).
//   2. Encadena .upgrade(tx => ...) para transformar los registros existentes.
//   3. Sube schemaVersion en repo.ts y añade una prueba que abra una base en la versión anterior.
// Solo se listan los campos indexados (los que se usan para buscar u ordenar).
db.version(1).stores({
  workouts: 'id, startedAt, finishedAt',
  measurements: 'id, date, type',
  settings: 'id',
  plan: 'id',
});
