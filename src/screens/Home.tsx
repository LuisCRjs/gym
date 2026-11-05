import { useEffect, useState } from 'react';
import {
  deleteWorkout,
  getInProgressWorkout,
  getLastFinishedWorkout,
  getSettings,
  startWorkout,
} from '../db/repo';
import { isDeloadWeek, planWeek, todayISO } from '../domain/plan-week.ts';
import { nextSession, SESSION_LABEL } from '../domain/rotation.ts';
import type { SessionKey, Settings, Workout } from '../types';

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

  return (
    <section>
      <h1>
        {week < 1
          ? `El plan empieza el ${settings.planStartDate}`
          : week > 12
            ? 'Plan terminado'
            : `Semana ${week} de 12`}
      </h1>

      {isDeloadWeek(week) && (
        <p className="notice">Semana de descarga: mitad de series, mismo peso, sin subir.</p>
      )}
      {inProgress && (
        <p className="notice">Tienes una sesión en curso: {SESSION_LABEL[inProgress.sessionKey]}.</p>
      )}
      {backupOverdue && (
        <p className="notice">
          {backupDays === undefined
            ? 'Aún no has hecho un respaldo.'
            : `Último respaldo hace ${backupDays} días.`}
        </p>
      )}

      <p className="label">Siguiente sesión</p>
      <p className="session">{SESSION_LABEL[session]}</p>

      {inProgress ? (
        <>
          <div className="actions">
            <button onClick={() => onOpenSession(inProgress.id)}>Continuar</button>
          </div>
          <button className="link" onClick={discard}>Descartar sesión en curso</button>
        </>
      ) : (
        <>
          <div className="actions">
            <button onClick={() => start('full')}>Completa</button>
            <button onClick={() => start('short')}>Corta ⭐</button>
          </div>
          <label className="other">
            Elegir otra sesión:{' '}
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

      <p className="label">Última sesión</p>
      <p>
        {last?.finishedAt
          ? `${SESSION_LABEL[last.sessionKey]}, ${new Date(last.finishedAt).toLocaleDateString('es')}`
          : 'Todavía no has terminado ninguna.'}
      </p>

      <button className="link" onClick={onOpenMeasurements}>
        Registrar medidas
      </button>
    </section>
  );
}
