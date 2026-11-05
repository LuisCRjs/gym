import { useEffect, useState } from 'react';
import { getPlan } from './db/repo';
import type { Plan } from './types';

export function App() {
  const [plan, setPlan] = useState<Plan>();

  useEffect(() => {
    getPlan().then(setPlan);
  }, []);

  return (
    <main>
      <h1>Gym Tracker</h1>
      <p>
        Plan cargado: {plan?.exercises.length} ejercicios, {plan?.slots.length} slots
      </p>
    </main>
  );
}
