import { useEffect, useState } from 'react';
import { Ring } from '../components/Ring';
import {
  deleteWorkout,
  getInProgressWorkout,
  getLastFinishedWorkout,
  getSettings,
  startWorkout,
} from '../db/repo';
import { autoSync } from '../cloud/sync';
import { saveBackup } from '../db/backup-file';
import { backupIsStale } from '../domain/backup.ts';
import { isDeloadWeek, planWeek, todayISO } from '../domain/plan-week.ts';
import { nextSession, SESSION_LABEL } from '../domain/rotation.ts';
import type { SessionKey, Settings, Workout } from '../types';
import { APP_VERSION } from '../version';
import { isStandalone } from './Welcome';

const DAY_MS = 86_400_000;
const BACKUP_WARN_DAYS = 7;
const ALL_SESSIONS: SessionKey[] = ['UPPER_A', 'LOWER_A', 'UPPER_B', 'LOWER_B', 'UPPER_C'];

interface Data {
  settings: Settings;
  last?: Workout;
  inProgress?: Workout;
}

interface Props {
  onOpenMeasurements: () => void;
  onOpenSession: (workoutId: string) => void;
}

export function Home({ onOpenMeasurements, onOpenSession }: Props) {
  const [data, setData] = useState<Data>();
  const [chosen, setChosen] = useState<SessionKey>();

  useEffect(() => {
    Promise.all([getSettings(), getLastFinishedWorkout(), getInProgressWorkout()]).then(
      ([settings, last, inProgress]) => setData({ settings, last, inProgress }),
    );
    // Al volver de una sesión, sube la copia a Dropbox si hay una nueva (no bloquea la pantalla).
    autoSync();
  }, []);

  if (!data) return null;
  const { settings, last, inProgress } = data;

  const week = planWeek(settings.planStartDate, todayISO());
  const session = chosen ?? nextSession(last?.sessionKey, settings.includeUpperC);
  const options = ALL_SESSIONS.filter((k) => k !== 'UPPER_C' || settings.includeUpperC);

  async function start(mode: 'full' | 'short') {
    const workout = await startWorkout(session, mode);
    onOpenSession(workout.id);
  }

  async function discard() {
    if (!inProgress || !confirm('¿Descartar la sesión en curso? Se pierden sus series.')) return;
    await deleteWorkout(inProgress.id);
    setData({ ...data!, inProgress: undefined });
  }

  const backupDays = settings.lastBackupAt
    ? Math.floor((Date.now() - settings.lastBackupAt) / DAY_MS)
    : undefined;
  const backupOverdue = last && (backupDays === undefined || backupDays >= BACKUP_WARN_DAYS);
  // Sesión terminada después del último respaldo: se ofrece guardar uno en un toque.
  const stale = backupIsStale(settings.lastBackupAt, last?.finishedAt);

  async function saveNow() {
    try {
      if (await saveBackup()) setData({ ...data!, settings: await getSettings() });
    } catch {
      alert('No se pudo guardar el respaldo.');
    }
  }

  const inPlan = week >= 1 && week <= 12;
  const title = week < 1 ? 'Aún no empieza' : week > 12 ? 'Plan terminado' : `Semana ${week} de 12`;
  const subtitle =
    week < 1
      ? `El plan empieza el ${settings.planStartDate}`
      : week > 12
        ? '¡Lo lograste! Revisa tu progreso'
        : isDeloadWeek(week)
          ? 'Descarga: recupera'
          : `${12 - week} semanas para terminar`;

  return (
    <section>
      <div className="card week-card">
        <Ring value={inPlan ? week / 12 : week > 12 ? 1 : 0} size={104} stroke={13}>
          <strong>{inPlan ? week : week > 12 ? '✓' : '–'}</strong>
          {inPlan && <small>de 12</small>}
        </Ring>
        <div>
          <h1>{title}</h1>
          <p className="muted">{subtitle}</p>
        </div>
      </div>

      {!isStandalone() && (
        <p className="notice info">Instala la app para no perder datos: Compartir → Añadir a pantalla de inicio.</p>
      )}
      {isDeloadWeek(week) && (
        <p className="notice warn">Semana de descarga: mitad de series, mismo peso, sin subir.</p>
      )}
      {stale ? (
        <div className="notice warn stale">
          <p>Terminaste una sesión sin respaldo.</p>
          <button onClick={saveNow}>Guardar respaldo</button>
        </div>
      ) : (
        backupOverdue && (
          <p className="notice warn">
            {backupDays === undefined ? 'Aún no has hecho un respaldo.' : `Último respaldo hace ${backupDays} días.`}
          </p>
        )
      )}

      <div className="card hero">
        <p className="hero-label">{inProgress ? 'Sesión en curso' : 'Siguiente sesión'}</p>
        <p className="session">{SESSION_LABEL[inProgress ? inProgress.sessionKey : session]}</p>

        {inProgress ? (
          <>
            <div className="actions">
              <button className="light" onClick={() => onOpenSession(inProgress.id)}>Continuar</button>
            </div>
            <button className="hero-link" onClick={discard}>Descartar sesión en curso</button>
          </>
        ) : (
          <>
            <div className="actions">
              <button className="light" onClick={() => start('full')}>Completa</button>
              <button className="glass" onClick={() => start('short')}>Corta ⭐</button>
            </div>
            <label className="other">
              Otra sesión
              <select value={session} onChange={(e) => setChosen(e.target.value as SessionKey)}>
                {options.map((k) => (
                  <option key={k} value={k}>
                    {SESSION_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>

      <div className="card">
        <p className="label">Última sesión</p>
        <p className="big-text">
          {last?.finishedAt
            ? `${SESSION_LABEL[last.sessionKey]} · ${new Date(last.finishedAt).toLocaleDateString('es')}`
            : 'Todavía no has terminado ninguna'}
        </p>
      </div>

      <button className="card row-button" onClick={onOpenMeasurements}>
        <span>Registrar medidas</span>
        <span aria-hidden="true">›</span>
      </button>

      <p className="app-version">Gym Tracker · v{APP_VERSION}</p>
    </section>
  );
}
