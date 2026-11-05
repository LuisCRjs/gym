import Dexie, { type EntityTable } from 'dexie';
import type { Measurement, Plan, Settings, Workout } from '../types';

export const db = new Dexie('gym-tracker') as Dexie & {
  workouts: EntityTable<Workout, 'id'>;
  measurements: EntityTable<Measurement, 'id'>;
  settings: EntityTable<Settings, 'id'>;
  plan: EntityTable<Plan, 'id'>;
};

// Solo se listan los campos indexados (los que se usan para buscar u ordenar).
db.version(1).stores({
  workouts: 'id, startedAt, finishedAt',
  measurements: 'id, date, type',
  settings: 'id',
  plan: 'id',
});
