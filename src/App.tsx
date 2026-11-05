import { useEffect, useState } from 'react';
import { hasSettings } from './db/repo';
import { Home } from './screens/Home';
import { Measurements } from './screens/Measurements';
import { Session } from './screens/Session';
import { Settings } from './screens/Settings';
import { Welcome } from './screens/Welcome';

type Tab = 'home' | 'measurements' | 'progress' | 'settings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Inicio' },
  { id: 'measurements', label: 'Medidas' },
  { id: 'progress', label: 'Progreso' },
  { id: 'settings', label: 'Ajustes' },
];

export function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [sessionId, setSessionId] = useState<string>();
  const [firstRun, setFirstRun] = useState<boolean>();

  useEffect(() => {
    hasSettings().then((has) => setFirstRun(!has));
  }, []);

  if (firstRun === undefined) return null;
  if (firstRun) {
    return (
      <main>
        <Welcome onDone={() => setFirstRun(false)} />
      </main>
    );
  }

  // La sesión ocupa toda la pantalla (sin navegación inferior).
  if (sessionId) {
    return (
      <main>
        <Session workoutId={sessionId} onExit={() => setSessionId(undefined)} />
      </main>
    );
  }

  return (
    <>
      <main>
        {tab === 'home' ? (
          <Home onOpenMeasurements={() => setTab('measurements')} onOpenSession={setSessionId} />
        ) : tab === 'measurements' ? (
          <Measurements />
        ) : tab === 'settings' ? (
          <Settings />
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
