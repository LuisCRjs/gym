import { useEffect, useState } from 'react';
import { LineChart } from '../components/LineChart';
import { getFinishedWorkouts, getMeasurements, getPlan, getSettings } from '../db/repo';
import { exerciseSeries, measurementSeries, weeklyAverages } from '../domain/progress.ts';
import type { Measurement, Plan, Settings, Workout } from '../types';

interface Data {
  plan: Plan;
  settings: Settings;
  history: Workout[];
  measurements: Measurement[];
}

const UNIT_LABEL = { kg: 'kg', lb: 'lb', pin: 'barrita' };

export function Progress() {
  const [data, setData] = useState<Data>();
  const [exerciseId, setExerciseId] = useState<string>();

  useEffect(() => {
    Promise.all([getPlan(), getSettings(), getFinishedWorkouts(), getMeasurements()]).then(
      ([plan, settings, history, measurements]) => plan && setData({ plan, settings, history, measurements }),
    );
  }, []);

  if (!data) return null;
  const { plan, settings, history, measurements } = data;

  const waist = measurementSeries(measurements, 'waist');
  const weight = weeklyAverages(measurements, settings.planStartDate);

  // Solo ejercicios que ya tienen registros, en el orden del plan.
  const trained = plan.exercises.filter((e) => exerciseSeries(history, e.id));
  const selectedId = exerciseId ?? trained[0]?.id;
  const selected = trained.find((e) => e.id === selectedId);
  const series = selected && exerciseSeries(history, selected.id);

  return (
    <section>
      <h1>Progreso</h1>

      <div className="card">
        <p className="label">Cintura (cm)</p>
        {waist.length ? <LineChart points={waist} color="#ff9f0a" /> : <p className="muted">Sin registros de cintura.</p>}
      </div>

      <div className="card">
        <p className="label">Peso corporal (kg, promedio semanal)</p>
        {weight.length ? <LineChart points={weight} color="#3b82f6" /> : <p className="muted">Sin registros de peso.</p>}
      </div>

      <div className="card">
        <p className="label">Por ejercicio</p>
        {trained.length === 0 ? (
          <p className="muted">Termina una sesión para ver tu progresión.</p>
        ) : (
          <>
            <select className="exercise-select" value={selectedId} onChange={(e) => setExerciseId(e.target.value)}>
              {trained.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            {series && (
              <>
                <p className="hint">
                  {series.kind === 'weight'
                    ? `Peso de trabajo (${UNIT_LABEL[series.unit]})`
                    : selected.metric === 'seconds'
                      ? 'Mejor serie (segundos)'
                      : 'Mejor serie (reps)'}
                </p>
                <LineChart points={series.points} color="#30d158" />
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
