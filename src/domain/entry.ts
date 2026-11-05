import type { Entry, Exercise, SessionKey, TemplateSlot, Workout } from '../types.ts';

// Slots que entran en una sesión: todos, o solo los ⭐ en la versión corta.
export function slotsFor(slots: TemplateSlot[], sessionKey: SessionKey, mode: 'full' | 'short') {
  return slots
    .filter((s) => s.sessionKey === sessionKey && (mode === 'full' || s.short))
    .sort((a, b) => a.order - b.order);
}

// `history` = sesiones terminadas, la más reciente primero.
export function lastEntryFor(history: Workout[], exerciseId: string): Entry | undefined {
  for (const w of history) {
    const found = w.entries.find((e) => e.exerciseId === exerciseId && e.sets.some((s) => s.done));
    if (found) return found;
  }
  return undefined;
}

// Opción elegida la última vez en esta misma sesión; si no hay, la primera del slot.
export function preferredExerciseId(slot: TemplateSlot, history: Workout[], sessionKey: SessionKey) {
  for (const w of history) {
    if (w.sessionKey !== sessionKey) continue;
    const found = w.entries.find((e) => slot.exerciseIds.includes(e.exerciseId));
    if (found) return found.exerciseId;
  }
  return slot.exerciseIds[0];
}

// Precarga unidad, perSide, peso y reps de la última entrada; sin historial, los valores
// por defecto del ejercicio y el mínimo del rango.
export function buildEntry(
  slot: TemplateSlot,
  exercise: Exercise,
  setCount: number,
  last?: Entry,
): Entry {
  const lastDone = last?.sets.filter((s) => s.done) ?? [];
  const weight = lastDone.length ? Math.max(...lastDone.map((s) => s.weight)) : 0;
  return {
    exerciseId: exercise.id,
    unit: last?.unit ?? exercise.defaultUnit,
    perSide: last?.perSide ?? exercise.defaultPerSide,
    repMin: slot.repMin,
    repMax: slot.repMax,
    sets: Array.from({ length: setCount }, (_, i) => ({
      weight,
      value: last?.sets[i]?.done ? last.sets[i].value : slot.repMin,
      done: false,
    })),
  };
}
