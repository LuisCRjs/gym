import { todayISO } from '../domain/plan-week.ts';
import { exportBackup, updateSettings } from './repo';

// Sin Web Share (o fuera de HTTPS) se descarga el archivo con un enlace temporal.
function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); // Safari cancela la descarga si se revoca al instante
}

// Guarda el respaldo: en iOS abre la hoja de "Compartir" (Archivos / iCloud Drive / Google Drive).
// Devuelve false si el usuario la cancela; en ese caso no cuenta como respaldo.
export async function saveBackup(): Promise<boolean> {
  const backup = await exportBackup();
  const file = new File([JSON.stringify(backup)], `gym-tracker-${todayISO()}.json`, {
    type: 'application/json',
  });
  try {
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
    else download(file);
  } catch (e) {
    if ((e as Error).name === 'AbortError') return false;
    throw e;
  }
  await updateSettings({ lastBackupAt: Date.now() });
  return true;
}
