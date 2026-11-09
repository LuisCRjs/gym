import type { Backup, Workout } from '../types.ts';

export interface BackupSummary {
  finished: number; // sesiones terminadas
  inProgress: boolean; // hay una sesión sin terminar
  lastFinishedAt?: number; // fecha de la sesión terminada más reciente
}

// Resumen para que el usuario vea qué trae un respaldo antes de reemplazar sus datos.
export function summarizeBackup(workouts: Workout[]): BackupSummary {
  const finished = workouts.filter((w) => w.finishedAt !== undefined);
  return {
    finished: finished.length,
    inProgress: workouts.some((w) => w.finishedAt === undefined),
    lastFinishedAt: finished.reduce<number | undefined>(
      (max, w) => (max === undefined || w.finishedAt! > max ? w.finishedAt : max),
      undefined,
    ),
  };
}

// Hay sesiones terminadas después del último respaldo: conviene guardar uno nuevo.
export function backupIsStale(lastBackupAt: number | undefined, lastFinishedAt: number | undefined): boolean {
  return lastFinishedAt !== undefined && (lastBackupAt === undefined || lastFinishedAt > lastBackupAt);
}

export type { Backup };
