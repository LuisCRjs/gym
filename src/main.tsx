import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { finishConnect } from './cloud/dropbox';
import { syncPlan } from './db/repo';
import { App } from './App';
import { UpdatePrompt } from './components/UpdatePrompt';
import './styles.css';

// Pide a Safari que no borre los datos de la app. iOS puede negarlo; Ajustes muestra el resultado.
navigator.storage?.persist?.();

syncPlan().then(async () => {
  // Vuelta desde Dropbox (?code=...): termina la conexión antes de pintar la app.
  try {
    if (await finishConnect()) alert('Dropbox conectado. Tu copia se subirá al terminar la próxima sesión.');
  } catch (e) {
    alert((e as Error).message);
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
      <UpdatePrompt />
    </StrictMode>,
  );
});
