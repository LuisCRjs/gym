import { useState } from 'react';
import { Home } from './screens/Home';

type Tab = 'home' | 'measurements' | 'progress' | 'settings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Inicio' },
  { id: 'measurements', label: 'Medidas' },
  { id: 'progress', label: 'Progreso' },
  { id: 'settings', label: 'Ajustes' },
];

export function App() {
  const [tab, setTab] = useState<Tab>('home');

  return (
    <>
      <main>
        {tab === 'home' ? (
          <Home onOpenMeasurements={() => setTab('measurements')} />
        ) : (
          <h1>{TABS.find((t) => t.id === tab)?.label} (pendiente)</h1>
        )}
      </main>
      <nav>
        {TABS.map((t) => (
          <button key={t.id} className={t.id === tab ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
    </>
  );
}
