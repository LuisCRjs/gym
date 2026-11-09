import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { APP_VERSION } from '../version';

// Guarda la versión que estaba corriendo cuando el usuario tocó "Después".
const DISMISSED_KEY = 'update-dismissed-from';

// Avisa cuando hay una versión nueva descargada. No recarga sola: así no interrumpe
// una sesión (cada serie ya está guardada en IndexedDB, así que recargar no pierde nada).
// "Después" silencia el aviso solo mientras siga corriendo esta versión: al actualizar,
// la siguiente versión nueva vuelve a avisar una vez.
export function UpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === APP_VERSION);

  if (!needRefresh || dismissed) return null;

  const later = () => {
    localStorage.setItem(DISMISSED_KEY, APP_VERSION);
    setDismissed(true);
  };

  return (
    <div className="update-prompt" role="status">
      <p>Hay una versión nueva de la app.</p>
      <div>
        <button className="pill" onClick={later}>Después</button>
        <button className="pill light" onClick={() => updateServiceWorker(true)}>Actualizar</button>
      </div>
    </div>
  );
}
