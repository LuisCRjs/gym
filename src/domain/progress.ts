import type { Measurement, Unit, Workout } from '../types.ts';
import { planWeek, todayISO } from './plan-week.ts';
import { convertWeight } from './units.ts';

export interface Point {
  label: string;
  value: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// Cintura (o cualquier medida) en orden cronológico.
export function measurementSeries(items: Measurement[], type: Measurement['type']): Point[] {
  return items
    .filter((m) => m.type === type)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({ label: m.date, value: m.value }));
}

// Peso corporal: promedio por semana del plan (S1, S2...).
export function weeklyAverages(items: Measurement[], planStartDate: string): Point[] {
  const byWeek = new Map<number, number[]>();
  for (const m of items) {
    if (m.type !== 'weight') continue;
    const week = planWeek(planStartDate, m.date);
    byWeek.set(week, [...(byWeek.get(week) ?? []), m.value]);
  }
  return [...byWeek]
    .sort(([a], [b]) => a - b)
    .map(([week, values]) => ({
      label: `S${week}`,
      value: round1(values.reduce((sum, v) => sum + v, 0) / values.length),
    }));
}

export interface ExerciseSeries {
  kind: 'weight' | 'value'; // value = reps o segundos (cuando siempre fue peso corporal)
  unit: Unit;
  points: Point[];
}

// Progresión de un ejercicio: peso de trabajo (el mayor de las series hechas) por sesión.
// - kg/lb se convierte a la unidad más reciente.
// - Cambiar hacia o desde barrita arranca una serie nueva: solo se muestra el tramo actual.
// - Si todo el tramo es peso 0 (peso corporal, plancha), se grafican las reps o segundos.
// `history` = sesiones terminadas, la más reciente primero.
export function exerciseSeries(history: Workout[], exerciseId: string): ExerciseSeries | null {
  const items = history.flatMap((w) =>
    w.entries
      .filter((e) => e.exerciseId === exerciseId && e.sets.some((s) => s.done))
      .map((entry) => ({ entry, at: w.finishedAt ?? w.startedAt })),
  );
  if (items.length === 0) return null;

  const unit = items[0].entry.unit;
  const run = [];
  for (const item of items) {
    if ((item.entry.unit === 'pin') !== (unit === 'pin')) break;
    run.push(item);
  }
  run.reverse(); // cronológico

  const points = run.map(({ entry, at }) => {
    const done = entry.sets.filter((s) => s.done);
    return {
      label: todayISO(new Date(at)),
      weight: convertWeight(Math.max(...done.map((s) => s.weight)), entry.unit, unit) ?? 0,
      value: Math.max(...done.map((s) => s.value)),
    };
  });

  const bodyweight = points.every((p) => p.weight === 0);
  return {
    kind: bodyweight ? 'value' : 'weight',
    unit,
    points: points.map((p) => ({ label: p.label, value: bodyweight ? p.value : p.weight })),
  };
}
