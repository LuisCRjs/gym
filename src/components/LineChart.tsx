import { useEffect, useRef } from 'react';
import {
  CategoryScale,
  Chart,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import type { Point } from '../domain/progress.ts';

// Registrar solo las piezas que se usan deja fuera el resto de Chart.js del bundle.
Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip);
Chart.defaults.color = '#999';
Chart.defaults.borderColor = '#2a2a2a';

export function LineChart({ points }: { points: Point[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  // Chart.js dibuja sobre el <canvas> fuera de React: se crea al montar y se destruye al cambiar.
  useEffect(() => {
    const chart = new Chart(canvas.current!, {
      type: 'line',
      data: {
        labels: points.map((p) => p.label),
        datasets: [{ data: points.map((p) => p.value), borderColor: '#3b82f6', backgroundColor: '#3b82f6', tension: 0.2 }],
      },
      options: { animation: false, maintainAspectRatio: false, scales: { y: { grace: '5%' } } },
    });
    return () => chart.destroy();
  }, [points]);

  return (
    <div className="chart">
      <canvas ref={canvas} />
    </div>
  );
}
