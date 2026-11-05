import { useEffect, useState } from 'react';
import { addMeasurement, deleteMeasurement, getMeasurements } from '../db/repo';
import { todayISO } from '../domain/plan-week.ts';
import type { Measurement } from '../types';

const LABEL: Record<Measurement['type'], string> = { weight: 'Peso', waist: 'Cintura' };
const UNIT: Record<Measurement['type'], string> = { weight: 'kg', waist: 'cm' };

export function Measurements() {
  const [items, setItems] = useState<Measurement[]>([]);
  const [date, setDate] = useState(todayISO());
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');

  const reload = () => getMeasurements().then(setItems);
  useEffect(() => {
    reload();
  }, []);

  // Guarda lo que esté lleno; se puede registrar solo el peso o solo la cintura.
  async function save() {
    const fields: [Measurement['type'], string][] = [['weight', weight], ['waist', waist]];
    for (const [type, text] of fields) {
      const value = Number(text);
      if (text && value > 0) await addMeasurement(date, type, value);
    }
    setWeight('');
    setWaist('');
    reload();
  }

  async function remove(m: Measurement) {
    if (!confirm(`¿Borrar ${LABEL[m.type].toLowerCase()} del ${m.date}?`)) return;
    await deleteMeasurement(m.id);
    reload();
  }

  return (
    <section>
      <h1>Medidas</h1>

      <div className="card">
        <label className="field">
          Fecha
          <input type="date" value={date} onChange={(e) => setDate(e.target.value || todayISO())} />
        </label>
        <div className="field-row">
          <label className="field">
            Peso (kg)
            <input type="number" inputMode="decimal" step="any" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </label>
          <label className="field">
            Cintura (cm)
            <input type="number" inputMode="decimal" step="any" value={waist} onChange={(e) => setWaist(e.target.value)} />
          </label>
        </div>
        <button className="primary" disabled={!weight && !waist} onClick={save}>
          Guardar
        </button>
      </div>

      <p className="label">Historial</p>
      {items.length === 0 && <p className="muted">Todavía no hay registros.</p>}
      {items.length > 0 && (
        <ul className="card history">
          {items.map((m) => (
            <li key={m.id}>
              <i className={`dot ${m.type}`} />
              <span className="muted">{m.date}</span>
              <span>{LABEL[m.type]}</span>
              <strong>
                {m.value} {UNIT[m.type]}
              </strong>
              <button className="icon-btn" aria-label="Borrar" onClick={() => remove(m)}>✕</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
