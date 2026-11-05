import { useEffect, useState } from 'react';
import { Icon, type IconName } from './components/Icon';
import { hasSettings } from './db/repo';
import { Home } from './screens/Home';
import { Measurements } from './screens/Measurements';
import { Progress } from './screens/Progress';
import { Session } from './screens/Session';
import { Settings } from './screens/Settings';
import { Welcome } from './screens/Welcome';

type Tab = 'home' | 'measurements' | 'progress' | 'settings';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Inicio', icon: 'home' },
  { id: 'measurements', label: 'Medidas', icon: 'ruler' },
  { id: 'progress', label: 'Progreso', icon: 'chart' },
  { id: 'settings', label: 'Ajustes', icon: 'sliders' },
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
      {/* key = tab: al cambiar de pestaña la pantalla se vuelve a montar y entra con animación */}
      <main key={tab}>
        {tab === 'home' ? (
          <Home onOpenMeasurements={() => setTab('measurements')} onOpenSession={setSessionId} />
        ) : tab === 'measurements' ? (
          <Measurements />
        ) : tab === 'settings' ? (
          <Settings />
        ) : (
          <Progress />
        )}
      </main>
      <nav>
        {TABS.map((t) => (
          <button key={t.id} className={t.id === tab ? 'active' : ''} onClick={() => setTab(t.id)}>
            <Icon name={t.icon} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
