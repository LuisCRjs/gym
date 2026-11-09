import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Ring } from './Ring';

interface Props {
  endsAt: number;
  totalSec: number; // duración completa, para llenar el anillo
  hidden: boolean; // oculto = barra pequeña abajo; la cuenta sigue igual
  onHide: () => void;
  onShow: () => void;
  onClose: () => void;
}

// Se guarda la hora de fin y lo restante se calcula contra Date.now(). El intervalo solo
// fuerza a repintar: si la app pasa a segundo plano, al volver el tiempo sigue siendo correcto.
export function RestTimer({ endsAt, totalSec, hidden, onHide, onShow, onClose }: Props) {
  const [, repaint] = useState(0);
  useEffect(() => {
    const id = setInterval(() => repaint((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);

  const leftMs = Math.max(0, endsAt - Date.now());
  const left = Math.ceil(leftMs / 1000);
  const finished = left === 0;
  const time = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;

  if (hidden) {
    return (
      <button className={finished ? 'timer-mini finished' : 'timer-mini'} onClick={finished ? onClose : onShow}>
        {finished ? 'Descanso terminado ✓' : `Descanso ${time}`}
      </button>
    );
  }

  // Se monta en <body>: dentro de la sesión, una transformación de la sección haría que
  // "pantalla completa" se quedara del ancho de la sesión.
  return createPortal(
    <div className={finished ? 'timer finished' : 'timer'}>
      <Ring
        value={leftMs / (totalSec * 1000)}
        size={300}
        stroke={18}
        linear
        from={finished ? '#fff' : '#22d3ee'}
        to={finished ? '#fff' : '#3b82f6'}
      >
        <strong>{finished ? '¡Listo!' : time}</strong>
        <p>{finished ? 'Descanso terminado' : 'Descanso'}</p>
      </Ring>
      <div className="timer-actions">
        {finished ? (
          <button className="light" onClick={onClose}>Siguiente serie</button>
        ) : (
          <>
            <button onClick={onHide}>Ocultar</button>
            <button onClick={onClose}>Saltar descanso</button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
