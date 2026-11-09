import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { syncPlan } from './db/repo';
import { App } from './App';
import { UpdatePrompt } from './components/UpdatePrompt';
import './styles.css';

syncPlan().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
      <UpdatePrompt />
    </StrictMode>,
  );
});
