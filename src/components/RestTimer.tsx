import { useEffect, useState } from 'react';

interface Props {
  endsAt: number;
  hidden: boolean; // oculto = barra pequeña abajo; la cuenta sigue igual
  onHide: () => void;
  onShow: () => void;
  onClose: () => void;
}

// Se guarda la hora de fin y lo restante se calcula contra Date.now(). El intervalo solo
// fuerza a repintar: si la app pasa a segundo plano, al volver el tiempo sigue siendo correcto.
export function RestTimer({ endsAt, hidden, onHide, onShow, onClose }: Props) {
  const [, repaint] = useState(0);
  useEffect(() => {
    const id = setInterval(() => repaint((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);

  const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  const finished = left === 0;
  const time = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;

  if (hidden) {
    return (
      <button className={finished ? 'timer-mini finished' : 'timer-mini'} onClick={finished ? onClose : onShow}>
        {finished ? 'Descanso terminado ✓' : `Descanso ${time}`}
      </button>
    );
  }

  return (
    <div className={finished ? 'timer finished' : 'timer'}>
      <p>{finished ? 'Descanso terminado' : 'Descanso'}</p>
      <strong>{time}</strong>
      <div className="timer-actions">
        {finished ? (
          <button onClick={onClose}>Siguiente serie</button>
        ) : (
          <>
            <button onClick={onHide}>Ocultar</button>
            <button onClick={onClose}>Saltar descanso</button>
          </>
        )}
      </div>
    </div>
  );
}
