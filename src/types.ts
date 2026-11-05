// ---------- PLANTILLA (se carga desde plan.json) ----------
export type SessionKey = 'UPPER_A' | 'LOWER_A' | 'UPPER_B' | 'LOWER_B' | 'UPPER_C';
export type Unit = 'kg' | 'lb' | 'pin'; // pin = "barrita": posición de placa en máquinas sin peso marcado

export interface Exercise {
  id: string;
  name: string;
  metric: 'reps' | 'seconds';
  defaultUnit: Unit;
  defaultPerSide: boolean;
  unilateral?: boolean;
}

export interface TemplateSlot {
  sessionKey: SessionKey;
  order: number;
  exerciseIds: string[];
  sets: number;
  repMin: number;
  repMax: number;
  restSec: number;
  short: boolean;
  note?: string;
}

// Una sola fila (id = 1) con todo el contenido de plan.json
export interface Plan {
  id: 1;
  exercises: Exercise[];
  slots: TemplateSlot[];
}

// ---------- REGISTROS ----------
export interface SetEntry {
  weight: number;
  value: number; // reps o segundos
  done: boolean;
}

export interface Entry {
  exerciseId: string;
  unit: Unit;
  perSide: boolean;
  repMin: number;
  repMax: number;
  sets: SetEntry[];
}

export interface Workout {
  id: string;
  sessionKey: SessionKey;
  mode: 'full' | 'short';
  startedAt: number;
  finishedAt?: number; // vacío = sesión en curso
  entries: Entry[];
}

export interface Measurement {
  id: string;
  date: string; // 'YYYY-MM-DD'
  type: 'weight' | 'waist';
  value: number;
}

// Una sola fila (id = 1)
export interface Settings {
  id: 1;
  planStartDate: string;
  includeUpperC: boolean;
  lastBackupAt?: number;
}

// ---------- RESPALDO ----------
// La plantilla no va: se recarga de plan.json. schemaVersion permite migrar respaldos viejos.
export interface Backup {
  schemaVersion: number;
  exportedAt: number;
  settings: Settings;
  workouts: Workout[];
  measurements: Measurement[];
}
