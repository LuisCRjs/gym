import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Entry, Exercise, TemplateSlot, Unit, Workout } from '../types.ts';
import { buildEntry, lastEntryFor, preferredExerciseId, slotsFor } from './entry.ts';
import { convertWeight } from './units.ts';
import { nextSession } from './rotation.ts';
import { isDeloadWeek, planWeek, setsForWeek } from './plan-week.ts';
import { suggest } from './progression.ts';

// Entrada de prueba: rango 6-8, todas las series hechas con los `values` dados.
const entry = (weight: number, values: number[], unit: Unit = 'kg'): Entry => ({
  exerciseId: 'x',
  unit,
  perSide: false,
  repMin: 6,
  repMax: 8,
  sets: values.map((value) => ({ weight, value, done: true })),
});

test('units: kg <-> lb se convierte, pin no', () => {
  assert.equal(convertWeight(100, 'kg', 'lb'), 220.5);
  assert.equal(convertWeight(220.5, 'lb', 'kg'), 100);
  assert.equal(convertWeight(7, 'pin', 'pin'), 7);
  assert.equal(convertWeight(7, 'pin', 'kg'), null);
  assert.equal(convertWeight(20, 'kg', 'pin'), null);
});

test('rotation: ciclo con y sin Upper C', () => {
  assert.equal(nextSession(undefined, false), 'UPPER_A');
  assert.equal(nextSession('UPPER_A', false), 'LOWER_A');
  assert.equal(nextSession('LOWER_B', false), 'UPPER_A');
  assert.equal(nextSession('LOWER_B', true), 'UPPER_C');
  assert.equal(nextSession('UPPER_C', true), 'UPPER_A');
  assert.equal(nextSession('UPPER_C', false), 'UPPER_A'); // Upper C desactivada después
});

test('plan-week: semana por calendario', () => {
  assert.equal(planWeek('2026-01-05', '2026-01-05'), 1);
  assert.equal(planWeek('2026-01-05', '2026-01-11'), 1);
  assert.equal(planWeek('2026-01-05', '2026-01-12'), 2);
  assert.equal(planWeek('2026-01-05', '2026-02-09'), 6);
  assert.equal(planWeek('2026-03-01', '2026-04-01'), 5); // cruza el cambio de horario de marzo
});

test('plan-week: descarga en semanas 6 y 12', () => {
  assert.deepEqual([5, 6, 7, 12].map(isDeloadWeek), [false, true, false, true]);
  assert.equal(setsForWeek(3, 6), 2);
  assert.equal(setsForWeek(4, 12), 2);
  assert.equal(setsForWeek(3, 5), 3);
});

test('progression: sube cuando todas las series llegan a repMax', () => {
  assert.deepEqual(suggest([entry(20, [8, 8, 8])], false), { kind: 'up', weight: 22.5, reps: 6 });
  assert.equal(suggest([entry(20, [8, 8, 7])], false), null);
  assert.deepEqual(suggest([entry(7, [8, 8], 'pin')], false), { kind: 'up', weight: 8, reps: 6 });
});

test('progression: sin sugerencia en descarga o sin series hechas', () => {
  assert.equal(suggest([entry(20, [8, 8, 8])], true), null);
  assert.equal(suggest([], false), null);
  const undone: Entry = { ...entry(20, [8]), sets: [{ weight: 20, value: 8, done: false }] };
  assert.equal(suggest([undone], false), null);
});

test('progression: baja si falla repMin 2 sesiones seguidas', () => {
  const bad = entry(40, [6, 5, 5]);
  assert.deepEqual(suggest([bad, bad], false), { kind: 'down', weight: 37.5, reps: 6 });
  assert.equal(suggest([bad, entry(40, [7, 6, 6])], false), null); // la anterior no falló
  assert.equal(suggest([bad], false), null); // solo una sesión
  const pin = entry(7, [5, 5], 'pin');
  assert.deepEqual(suggest([pin, pin], false), { kind: 'down', weight: 6, reps: 6 });
});

test('progression: cambio de/hacia pin no cuenta como 2 sesiones seguidas', () => {
  const kg = entry(40, [5, 5]);
  const pin = entry(7, [5, 5], 'pin');
  assert.equal(suggest([pin, kg], false), null);
});

test('progression: peso corporal (0) no baja', () => {
  const bw = entry(0, [4, 4, 4]);
  assert.equal(suggest([bw, bw], false), null);
});

const slot = (order: number, short: boolean, exerciseIds = ['a']): TemplateSlot => ({
  sessionKey: 'UPPER_A',
  order,
  exerciseIds,
  sets: 3,
  repMin: 6,
  repMax: 8,
  restSec: 60,
  short,
});
const exercise: Exercise = {
  id: 'a',
  name: 'A',
  metric: 'reps',
  defaultUnit: 'pin',
  defaultPerSide: false,
};
const workout = (sessionKey: Workout['sessionKey'], entries: Entry[]): Workout => ({
  id: 'w',
  sessionKey,
  mode: 'full',
  startedAt: 0,
  finishedAt: 1,
  entries,
});

test('entry: la versión corta solo trae los ⭐, en orden', () => {
  const slots = [slot(2, true), slot(1, false), slot(3, true)];
  assert.deepEqual(slotsFor(slots, 'UPPER_A', 'full').map((s) => s.order), [1, 2, 3]);
  assert.deepEqual(slotsFor(slots, 'UPPER_A', 'short').map((s) => s.order), [2, 3]);
  assert.deepEqual(slotsFor(slots, 'LOWER_A', 'full'), []);
});

test('entry: sin historial usa los valores por defecto del ejercicio', () => {
  const e = buildEntry(slot(1, true), exercise, 3);
  assert.equal(e.unit, 'pin');
  assert.deepEqual(e.sets, Array(3).fill({ weight: 0, value: 6, done: false }));
});

test('entry: con historial precarga unidad, peso máximo y reps de la última vez', () => {
  const last = entry(20, [8, 7, 6], 'lb');
  const e = buildEntry(slot(1, true), exercise, 3, last);
  assert.equal(e.unit, 'lb');
  assert.deepEqual(e.sets.map((s) => [s.weight, s.value, s.done]), [
    [20, 8, false],
    [20, 7, false],
    [20, 6, false],
  ]);
});

test('entry: lastEntryFor ignora entradas sin series hechas', () => {
  const empty: Entry = { ...entry(20, [8]), sets: [{ weight: 20, value: 8, done: false }] };
  const real = entry(30, [8]);
  assert.equal(lastEntryFor([workout('UPPER_A', [empty]), workout('UPPER_A', [real])], 'x'), real);
  assert.equal(lastEntryFor([], 'x'), undefined);
});

test('entry: recuerda la opción elegida en esa misma sesión', () => {
  const s = slot(1, true, ['dominadas', 'jalon']);
  const hist = [
    workout('LOWER_A', [{ ...entry(1, [1]), exerciseId: 'jalon' }]),
    workout('UPPER_A', [{ ...entry(1, [1]), exerciseId: 'jalon' }]),
  ];
  assert.equal(preferredExerciseId(s, hist, 'UPPER_A'), 'jalon');
  assert.equal(preferredExerciseId(s, [], 'UPPER_A'), 'dominadas');
});
