import { useEffect, useState } from 'react';
import { connect, disconnect, isConnected } from '../cloud/dropbox';
import { getCloudSyncedAt, restoreFromCloud, syncNow } from '../cloud/sync';
import { Button } from '../components/ui/button';
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
import type { Backup, Settings as SettingsData } from '../types';
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
  const [connected, setConnected] = useState(isConnected());
  const [cloudAt, setCloudAt] = useState(getCloudSyncedAt());
  const [cloudBusy, setCloudBusy] = useState(false);

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
  // Confirma con el resumen, guarda una copia de lo actual y reemplaza. Lo usan el archivo y Dropbox.
  async function applyBackup(backup: Backup) {
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
  }

  async function importData(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = ''; // permite volver a elegir el mismo archivo
    if (!file) return;
    try {
      await applyBackup(parseBackup(JSON.parse(await file.text())));
    } catch (e) {
      alert(e instanceof SyntaxError ? 'El archivo no es un JSON válido.' : (e as Error).message);
    }
  }

  async function connectDropbox() {
    try {
      await connect();
    } catch {
      alert('No se pudo abrir Dropbox.');
    }
  }

  async function syncDropbox() {
    setCloudBusy(true);
    try {
      const at = await syncNow();
      if (at) setCloudAt(at);
      else alert('Aún no tienes sesiones terminadas para subir.');
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setCloudBusy(false);
    }
  }

  async function restoreDropbox() {
    setCloudBusy(true);
    try {
      await applyBackup(await restoreFromCloud());
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setCloudBusy(false);
    }
  }

  function disconnectDropbox() {
    if (!confirm('¿Desconectar Dropbox? Tus datos del teléfono no se borran.')) return;
    disconnect();
    setConnected(false);
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
        <Button variant="primary" onClick={exportData}>
          Exportar respaldo
        </Button>
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
        <p className="label">Copia en Dropbox</p>
        {connected ? (
          <>
            <p className="big-text">Conectado</p>
            <p className="hint">
              {cloudAt ? `Última copia en la nube: ${new Date(cloudAt).toLocaleString('es')}` : 'Aún no hay copia en la nube.'}
            </p>
            <Button variant="primary" disabled={cloudBusy} onClick={syncDropbox}>
              {cloudBusy ? 'Un momento…' : 'Subir copia ahora'}
            </Button>
            <button className="file-button" disabled={cloudBusy} onClick={restoreDropbox}>
              Restaurar desde Dropbox
            </button>
            <button className="link" onClick={disconnectDropbox}>Desconectar</button>
          </>
        ) : (
          <>
            <p className="hint">Se sube sola al abrir la app después de terminar una sesión.</p>
            <Button variant="primary" onClick={connectDropbox}>Conectar Dropbox</Button>
          </>
        )}
      </div>

      <div className="card">
        <p className="label">Aplicación</p>
        <p className="big-text">Versión {APP_VERSION}</p>
        <Button variant="primary" disabled={checking} onClick={checkUpdate}>
          {checking ? 'Buscando…' : 'Buscar actualización'}
        </Button>
        {update && <p className="hint">{update.status}</p>}
        {update?.ready && (
          <Button variant="success" onClick={() => applyUpdate(update.ready!)}>
            Actualizar ahora
          </Button>
        )}
      </div>
    </section>
  );
}
