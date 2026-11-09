import { useEffect, useState } from 'react';
import { saveBackup } from '../db/backup-file';
import {
  clearUndoBackup,
  exportBackup,
  getSettings,
  getUndoBackup,
  importBackup,
  parseBackup,
  saveUndoBackup,
  updateSettings,
} from '../db/repo';
import { summarizeBackup } from '../domain/backup.ts';
import type { Settings as SettingsData } from '../types';
import { APP_VERSION } from '../version';

const DAY_MS = 86_400_000;
const dateOf = (ms: number) => new Date(ms).toLocaleDateString('es');

// Espera a que un service worker termine de instalarse (o falle).
const settled = (sw: ServiceWorker) =>
  new Promise<void>((resolve) => {
    sw.addEventListener('statechange', () => sw.state !== 'installing' && resolve());
  });

export function Settings() {
  const [settings, setSettings] = useState<SettingsData>();
  const [update, setUpdate] = useState<{ status: string; ready?: ServiceWorker }>();
  const [checking, setChecking] = useState(false);
  const [persisted, setPersisted] = useState<boolean>();

  useEffect(() => {
    getSettings().then(setSettings);
    navigator.storage?.persisted?.().then(setPersisted);
  }, []);

  if (!settings) return null;

  // Pide al navegador revisar si hay un service worker nuevo. Si lo hay, queda esperando:
  // se aplica con "Actualizar ahora" (o con el aviso de la app).
  async function checkUpdate() {
    setChecking(true);
    setUpdate({ status: 'Buscando…' });
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (!reg) {
        setUpdate({ status: 'Solo se puede buscar en la app instalada con conexión.' });
        return;
      }
      await reg.update();
      if (reg.installing) await settled(reg.installing);
      setUpdate(
        reg.waiting
          ? { status: 'Hay una versión nueva.', ready: reg.waiting }
          : { status: 'Ya tienes la última versión.' },
      );
    } catch {
      setUpdate({ status: 'No se pudo buscar. Revisa tu conexión.' });
    } finally {
      setChecking(false);
    }
  }

  // Manda al nuevo service worker a activarse; al cambiar de controlador se recarga la app.
  function applyUpdate(sw: ServiceWorker) {
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
    sw.postMessage({ type: 'SKIP_WAITING' });
  }

  const change = async (patch: Partial<SettingsData>) => setSettings(await updateSettings(patch));

  async function exportData() {
    try {
      if (await saveBackup()) setSettings(await getSettings());
    } catch {
      alert('No se pudo exportar el respaldo.');
    }
  }

  // Antes de reemplazar: muestra qué trae el archivo frente a lo que hay ahora, y guarda
  // una copia de lo actual para poder deshacer.
  async function importData(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = ''; // permite volver a elegir el mismo archivo
    if (!file) return;
    try {
      const backup = parseBackup(JSON.parse(await file.text()));
      const incoming = summarizeBackup(backup.workouts);
      const current = summarizeBackup((await exportBackup()).workouts);
      const ok = confirm(
        `Respaldo del ${dateOf(backup.exportedAt)}:\n` +
          `• ${incoming.finished} sesiones terminadas` +
          (incoming.lastFinishedAt ? ` (la última: ${dateOf(incoming.lastFinishedAt)})` : '') +
          `\n\nEn este teléfono ahora hay ${current.finished} sesiones terminadas.\n\n` +
          'Se guardará una copia de lo actual y podrás deshacerlo. ¿Reemplazar todo?',
      );
      if (!ok) return;
      await saveUndoBackup();
      await importBackup(backup);
      setSettings(await getSettings());
      alert('Respaldo importado. Puedes deshacerlo abajo.');
    } catch (e) {
      alert(e instanceof SyntaxError ? 'El archivo no es un JSON válido.' : (e as Error).message);
    }
  }

  async function undoImport() {
    const previous = getUndoBackup();
    if (!previous || !confirm(`Volver a los datos de antes de la importación (respaldo del ${dateOf(previous.exportedAt)})?`)) return;
    await importBackup(previous);
    clearUndoBackup();
    setSettings(await getSettings());
    alert('Importación deshecha.');
  }

  const undo = getUndoBackup();

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
        <p className="hint">
          {persisted === undefined
            ? ''
            : persisted
              ? 'Almacenamiento protegido: iOS no debería borrar tus datos.'
              : 'Almacenamiento no garantizado: exporta respaldos con frecuencia.'}
        </p>
        <button className="primary" onClick={exportData}>
          Exportar respaldo
        </button>
        <label className="file-button">
          Importar respaldo
          <input type="file" accept="application/json,.json" onChange={(e) => importData(e.target)} />
        </label>
        {undo && (
          <button className="file-button" onClick={undoImport}>
            Deshacer última importación ({dateOf(undo.exportedAt)})
          </button>
        )}
        <p className="hint">Importar reemplaza todos los datos actuales de este teléfono.</p>
      </div>

      <div className="card">
        <p className="label">Aplicación</p>
        <p className="big-text">Versión {APP_VERSION}</p>
        <button className="primary" disabled={checking} onClick={checkUpdate}>
          {checking ? 'Buscando…' : 'Buscar actualización'}
        </button>
        {update && <p className="hint">{update.status}</p>}
        {update?.ready && (
          <button className="primary success" onClick={() => applyUpdate(update.ready!)}>
            Actualizar ahora
          </button>
        )}
      </div>
    </section>
  );
}
