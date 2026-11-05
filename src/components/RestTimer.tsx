import { useEffect, useState } from 'react';

// Se guarda la hora de fin y lo restante se calcula contra Date.now(). El intervalo solo
// fuerza a repintar: si la app pasa a segundo plano, al volver el tiempo sigue siendo correcto.
export function RestTimer({ endsAt, onSkip }: { endsAt: number; onSkip: () => void }) {
  const [, repaint] = useState(0);
  useEffect(() => {
    const id = setInterval(() => repaint((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);

  const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');

  return (
    <div className={left === 0 ? 'timer finished' : 'timer'}>
      <span>{left === 0 ? 'Descanso terminado' : `Descanso ${mm}:${ss}`}</span>
      <button onClick={onSkip}>{left === 0 ? 'Cerrar' : 'Saltar'}</button>
    </div>
  );
}
