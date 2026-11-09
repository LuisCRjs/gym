import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { syncPlan } from './db/repo';
import { App } from './App';
import { UpdatePrompt } from './components/UpdatePrompt';
import './styles.css';

// Pide a Safari que no borre los datos de la app. iOS puede negarlo; Ajustes muestra el resultado.
navigator.storage?.persist?.();

syncPlan().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
      <UpdatePrompt />
    </StrictMode>,
  );
});
