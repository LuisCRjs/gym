import { useEffect, useState } from 'react';
import { RestTimer } from '../components/RestTimer';
import { Stepper } from '../components/Stepper';
import {
  getEntryHistory,
  getLastEntry,
  getPlan,
  getSettings,
  getWorkout,
  saveWorkout,
} from '../db/repo';
import { buildEntry, slotsFor } from '../domain/entry.ts';
import { isDeloadWeek, planWeek, todayISO } from '../domain/plan-week.ts';
import { suggest } from '../domain/progression.ts';
import { SESSION_LABEL } from '../domain/rotation.ts';
import { convertWeight, STEP } from '../domain/units.ts';
import type { Entry, Plan, Unit, Workout } from '../types';

const UNIT_LABEL: Record<Unit, string> = { kg: 'kg', lb: 'lb', pin: 'barrita' };

export function Session({ workoutId, onExit }: { workoutId: string; onExit: () => void }) {
  const [workout, setWorkout] = useState<Workout>();
  const [plan, setPlan] = useState<Plan>();
  const [idx, setIdx] = useState(0);
  const [deload, setDeload] = useState(false);
  const [history, setHistory] = useState<Entry[]>([]);
  const [restEndsAt, setRestEndsAt] = useState<number>();
  const [restHidden, setRestHidden] = useState(false);

  useEffect(() => {
    Promise.all([getWorkout(workoutId), getPlan(), getSettings()]).then(([w, p, settings]) => {
      if (!w || !p) return onExit();
      setWorkout(w);
      setPlan(p);
      setDeload(isDeloadWeek(planWeek(settings.planStartDate, todayISO())));
      // Retoma en el primer ejercicio con series pendientes.
      setIdx(Math.max(w.entries.findIndex((e) => e.sets.some((s) => !s.done)), 0));
    });
  }, [workoutId]);

  // Historial del ejercicio mostrado, para la sugerencia de peso.
  const exerciseId = workout?.entries[idx]?.exerciseId;
  useEffect(() => {
    if (exerciseId) getEntryHistory(exerciseId).then(setHistory);
  }, [exerciseId]);

  if (!workout || !plan) return null;

  // Cada cambio se guarda al momento, no solo al marcar ✓.
  const update = (w: Workout) => {
    setWorkout(w);
    saveWorkout(w);
  };
  const updateEntry = (entry: Entry) =>
    update({ ...workout, entries: workout.entries.map((e, i) => (i === idx ? entry : e)) });

  // entries[i] corresponde a slots[i] (se crearon en el mismo orden al iniciar la sesión).
  const slot = slotsFor(plan.slots, workout.sessionKey, workout.mode)[idx];
  const entry = workout.entries[idx];
  const exercise = plan.exercises.find((e) => e.id === entry.exerciseId)!;
  const isSeconds = exercise.metric === 'seconds';

  const active = entry.sets.findIndex((s) => !s.done); // -1 = ejercicio completo
  const anyDone = entry.sets.some((s) => s.done);
  const isLast = idx === workout.entries.length - 1;
  const current = entry.sets[Math.max(active, 0)];

  // Peso: aplica a todas las series pendientes. Reps: solo a la serie activa.
  const setWeight = (weight: number) =>
    updateEntry({ ...entry, sets: entry.sets.map((s) => (s.done ? s : { ...s, weight })) });
  const setValue = (value: number) =>
    updateEntry({ ...entry, sets: entry.sets.map((s, i) => (i === active ? { ...s, value } : s)) });
  const setDone = (i: number, done: boolean) =>
    updateEntry({ ...entry, sets: entry.sets.map((s, j) => (j === i ? { ...s, done } : s)) });

  // Al marcar ✓ se guarda la serie y arranca el descanso del slot.
  const markDone = () => {
    setDone(active, true);
    setRestEndsAt(Date.now() + slot.restSec * 1000);
    setRestHidden(false); // cada descanso nuevo arranca en pantalla completa
  };

  // Sugerencia en la unidad de la última sesión; si hoy usas otra (kg <-> lb) se convierte,
  // y si no hay equivalencia (barrita) no se muestra.
  const suggestion = !anyDone ? suggest(history, deload) : null;
  const suggestedWeight = suggestion
    ? convertWeight(suggestion.weight, history[0].unit, entry.unit)
    : null;

  const setUnit = (unit: Unit) =>
    updateEntry({
      ...entry,
      unit,
      // kg <-> lb convierte; hacia/desde barrita no hay equivalencia, se reinicia.
      sets: entry.sets.map((s) =>
        s.done ? s : { ...s, weight: convertWeight(s.weight, entry.unit, unit) ?? 0 },
      ),
    });

  async function changeExercise(id: string) {
    const next = plan!.exercises.find((e) => e.id === id)!;
    updateEntry(buildEntry(slot, next, entry.sets.length, await getLastEntry(id)));
  }

  function finish() {
    const pending = workout!.entries.some((e) => e.sets.some((s) => !s.done));
    if (pending && !confirm('Hay series sin marcar. ¿Terminar la sesión de todos modos?')) return;
    update({ ...workout!, finishedAt: Date.now() });
    onExit();
  }

  return (
    <section>
      <header className="session-header">
        <button className="link" onClick={onExit}>← Salir</button>
        <span className="label">
          {SESSION_LABEL[workout.sessionKey]} · {idx + 1}/{workout.entries.length}
        </span>
      </header>

      {slot.exerciseIds.length > 1 ? (
        <select
          className="exercise-select"
          value={entry.exerciseId}
          disabled={anyDone}
          onChange={(e) => changeExercise(e.target.value)}
        >
          {slot.exerciseIds.map((id) => (
            <option key={id} value={id}>
              {plan.exercises.find((e) => e.id === id)?.name}
            </option>
          ))}
        </select>
      ) : (
        <h1>{exercise.name}</h1>
      )}

      <p>
        {slot.sets !== entry.sets.length ? `${entry.sets.length} series (descarga)` : `${entry.sets.length} series`}{' '}
        · {slot.repMin === slot.repMax ? slot.repMin : `${slot.repMin}-${slot.repMax}`}{' '}
        {isSeconds ? 's' : 'reps'}
        {exercise.unilateral && ' por lado'}
      </p>
      {slot.note && (
        <details>
          <summary>Técnica</summary>
          <p>{slot.note}</p>
        </details>
      )}

      <p className="label">{active === -1 ? 'Ejercicio completo' : `Serie ${active + 1} de ${entry.sets.length}`}</p>
      <div className="chips">
        {entry.sets.map((s, i) => (
          <button
            key={i}
            className={s.done ? 'done' : i === active ? 'active' : ''}
            onClick={() => s.done && setDone(i, false)} // tocar una serie hecha la deshace
          >
            {s.done ? '✓' : i + 1}
          </button>
        ))}
      </div>

      <div className="units">
        {(['kg', 'lb', 'pin'] as Unit[]).map((u) => (
          <button key={u} className={u === entry.unit ? 'active' : ''} onClick={() => setUnit(u)}>
            {UNIT_LABEL[u]}
          </button>
        ))}
        <label>
          <input
            type="checkbox"
            checked={entry.perSide}
            onChange={(e) => updateEntry({ ...entry, perSide: e.target.checked })}
          />{' '}
          por lado
        </label>
      </div>

      {suggestion && suggestedWeight !== null && (
        <p className="suggestion">
          Sugerencia: {suggestion.kind === 'up' ? 'subir' : 'bajar'} a {suggestedWeight}{' '}
          {UNIT_LABEL[entry.unit]}
          {suggestion.kind === 'up' && ` y volver a ${suggestion.reps} reps`}
        </p>
      )}

      <Stepper
        label={entry.unit === 'pin' ? 'Barrita' : entry.perSide ? `Peso por lado (${entry.unit})` : `Peso (${entry.unit})`}
        value={current.weight}
        step={STEP[entry.unit]}
        disabled={active === -1}
        onChange={setWeight}
      />
      <Stepper
        label={isSeconds ? 'Segundos' : 'Reps'}
        value={current.value}
        step={isSeconds ? 5 : 1}
        disabled={active === -1}
        onChange={setValue}
      />

      <button className="primary" disabled={active === -1} onClick={markDone}>
        ✓ Serie hecha
      </button>

      {restEndsAt && (
        <RestTimer
          endsAt={restEndsAt}
          hidden={restHidden}
          onHide={() => setRestHidden(true)}
          onShow={() => setRestHidden(false)}
          onClose={() => setRestEndsAt(undefined)}
        />
      )}

      <div className="actions">
        <button disabled={idx === 0} onClick={() => setIdx(idx - 1)}>← Anterior</button>
        {isLast ? (
          <button onClick={finish}>Terminar sesión</button>
        ) : (
          <button onClick={() => setIdx(idx + 1)}>Siguiente →</button>
        )}
      </div>
    </section>
  );
}
