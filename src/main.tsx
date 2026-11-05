import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { syncPlan } from './db/repo';
import { App } from './App';

syncPlan().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
