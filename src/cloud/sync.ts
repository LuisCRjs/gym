import { exportBackup, parseBackup } from '../db/repo';
import { backupIsStale, summarizeBackup } from '../domain/backup.ts';
import type { Backup } from '../types';
import { downloadBackupFile, isConnected, uploadBackupFile } from './dropbox';

// Cuándo se subió la última copia. Es local a este teléfono (no va en el respaldo).
const SYNCED_KEY = 'gym-tracker-cloud-synced-at';
export const getCloudSyncedAt = (): number | undefined => {
  const raw = localStorage.getItem(SYNCED_KEY);
  return raw ? Number(raw) : undefined;
};

// Sube la copia actual. No sube un teléfono sin sesiones terminadas: así una base vacía
// nunca reemplaza tu copia buena.
export async function syncNow(): Promise<number | undefined> {
  const backup = await exportBackup();
  if (summarizeBackup(backup.workouts).finished === 0) return undefined;
  await uploadBackupFile(JSON.stringify(backup));
  const at = Date.now();
  localStorage.setItem(SYNCED_KEY, String(at));
  return at;
}

// Al abrir la app: si terminaste una sesión desde la última subida, sube la copia.
// Si no hay red, falla en silencio y se reintenta en la siguiente apertura.
export async function autoSync(): Promise<void> {
  if (!isConnected()) return;
  const { workouts } = await exportBackup();
  if (!backupIsStale(getCloudSyncedAt(), summarizeBackup(workouts).lastFinishedAt)) return;
  await syncNow().catch(() => undefined);
}

// Descarga la copia de Dropbox y la valida. No la aplica: eso lo confirma el usuario en Ajustes.
export async function restoreFromCloud(): Promise<Backup> {
  return parseBackup(JSON.parse(await downloadBackupFile()));
}
