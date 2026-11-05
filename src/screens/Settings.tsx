import { useEffect, useState } from 'react';
import { exportBackup, getSettings, importBackup, parseBackup, updateSettings } from '../db/repo';
import { todayISO } from '../domain/plan-week.ts';
import type { Settings as SettingsData } from '../types';

const DAY_MS = 86_400_000;

// Sin Web Share (o fuera de HTTPS) se descarga el archivo con un enlace temporal.
function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); // Safari cancela la descarga si se revoca al instante
}

export function Settings() {
  const [settings, setSettings] = useState<SettingsData>();

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  if (!settings) return null;

  const change = async (patch: Partial<SettingsData>) => setSettings(await updateSettings(patch));

  // Web Share API: abre la hoja de "Compartir" de iOS, desde donde se puede guardar
  // en Archivos / iCloud Drive. Si se cancela, no cuenta como respaldo.
  async function exportData() {
    const backup = await exportBackup();
    const file = new File([JSON.stringify(backup)], `gym-tracker-${todayISO()}.json`, {
      type: 'application/json',
    });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
      else download(file);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      alert('No se pudo exportar el respaldo.');
      return;
    }
    change({ lastBackupAt: Date.now() });
  }

  async function importData(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = ''; // permite volver a elegir el mismo archivo
    if (!file) return;
    try {
      const backup = parseBackup(JSON.parse(await file.text()));
      const date = new Date(backup.exportedAt).toLocaleDateString('es');
      if (!confirm(`Esto reemplaza TODOS tus datos por el respaldo del ${date}. ¿Continuar?`)) return;
      await importBackup(backup);
      setSettings(await getSettings());
      alert('Respaldo importado.');
    } catch (e) {
      alert(e instanceof SyntaxError ? 'El archivo no es un JSON válido.' : (e as Error).message);
    }
  }

  const days = settings.lastBackupAt
    ? Math.floor((Date.now() - settings.lastBackupAt) / DAY_MS)
    : undefined;

  return (
    <section>
      <h1>Ajustes</h1>

      <div className="card">
        <p className="label">Plan</p>
        <label className="field">
          Fecha de inicio
          <input
            type="date"
            value={settings.planStartDate}
            onChange={(e) => e.target.value && change({ planStartDate: e.target.value })}
          />
        </label>
        <label className="toggle spread">
          Incluir Upper C (opcional)
          <input
            className="switch"
            type="checkbox"
            checked={settings.includeUpperC}
            onChange={(e) => change({ includeUpperC: e.target.checked })}
          />
        </label>
      </div>

      <div className="card">
        <p className="label">Respaldo</p>
        <p className="big-text">
          {days === undefined
            ? 'Nunca has hecho un respaldo'
            : days === 0
              ? 'Último respaldo: hoy'
              : `Último respaldo: hace ${days} día${days === 1 ? '' : 's'}`}
        </p>
        <button className="primary" onClick={exportData}>
          Exportar respaldo
        </button>
        <label className="file-button">
          Importar respaldo
          <input type="file" accept="application/json,.json" onChange={(e) => importData(e.target)} />
        </label>
        <p className="hint">Importar reemplaza todos los datos actuales de este teléfono.</p>
      </div>
    </section>
  );
}
