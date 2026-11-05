import { useState } from 'react';
import { updateSettings } from '../db/repo';
import { todayISO } from '../domain/plan-week.ts';

// La app corre "instalada" (abierta desde el ícono). `navigator.standalone` es la versión de iOS.
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function Welcome({ onDone }: { onDone: () => void }) {
  // Si no está instalada, primero se insiste en instalar: los datos de Safari no pasan a la app
  // instalada, y Safari puede borrarlos tras ~7 días sin uso.
  const [step, setStep] = useState<'install' | 'setup'>(isStandalone() ? 'setup' : 'install');
  const [planStartDate, setPlanStartDate] = useState(todayISO());
  const [includeUpperC, setIncludeUpperC] = useState(false);

  async function start() {
    await updateSettings({ planStartDate, includeUpperC });
    onDone();
  }

  if (step === 'install') {
    return (
      <section>
        <img className="brand-icon" src="/icon-192.png" alt="" width="88" height="88" />
        <h1>Instala Gym Tracker</h1>
        <p className="muted">Para que tus datos no se borren, úsala desde la pantalla de inicio:</p>
        <ol className="card steps">
          <li>
            En Safari, toca <strong>Compartir</strong> (el cuadro con la flecha hacia arriba).
          </li>
          <li>
            Elige <strong>Añadir a pantalla de inicio</strong>.
          </li>
          <li>
            Abre <strong>Gym Tracker</strong> desde el ícono nuevo.
          </li>
        </ol>
        <p className="hint">
          Lo que registres aquí en Safari no pasa a la app instalada, y iOS puede borrarlo si no la
          abres en ~7 días.
        </p>
        <button className="link" onClick={() => setStep('setup')}>
          Usar en el navegador de todos modos
        </button>
      </section>
    );
  }

  return (
    <section>
      <img className="brand-icon" src="/icon-192.png" alt="" width="88" height="88" />
      <h1>Bienvenido</h1>
      <p className="muted">Dos datos y empiezas.</p>
      <div className="card">
        <label className="field">
          ¿Cuándo empieza (o empezó) tu plan de 12 semanas?
          <input
            type="date"
            value={planStartDate}
            onChange={(e) => setPlanStartDate(e.target.value || todayISO())}
          />
        </label>
        <label className="toggle spread">
          Incluir Upper C (5ª sesión opcional)
          <input
            className="switch"
            type="checkbox"
            checked={includeUpperC}
            onChange={(e) => setIncludeUpperC(e.target.checked)}
          />
        </label>
      </div>
      <p className="hint">Ambas cosas se pueden cambiar después en Ajustes.</p>
      <button className="primary" onClick={start}>
        Empezar
      </button>
    </section>
  );
}
