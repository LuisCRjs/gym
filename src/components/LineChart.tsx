import { useEffect, useRef } from 'react';
import {
  CategoryScale,
  Chart,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Filler,
  Tooltip,
} from 'chart.js';
import type { Point } from '../domain/progress.ts';

// Registrar solo las piezas que se usan deja fuera el resto de Chart.js del bundle.
Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip);
Chart.defaults.color = '#8e8e93';
Chart.defaults.borderColor = '#2c2c2e';
Chart.defaults.font.family = '-apple-system, system-ui, sans-serif';

export function LineChart({ points, color = '#3b82f6' }: { points: Point[]; color?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  // Chart.js dibuja sobre el <canvas> fuera de React: se crea al montar y se destruye al cambiar.
  useEffect(() => {
    const chart = new Chart(canvas.current!, {
      type: 'line',
      data: {
        labels: points.map((p) => p.label),
        datasets: [
          {
            data: points.map((p) => p.value),
            borderColor: color,
            backgroundColor: color + '26', // relleno translúcido bajo la línea
            pointBackgroundColor: color,
            pointRadius: 3,
            borderWidth: 3,
            fill: true,
            tension: 0.35,
          },
        ],
      },
      options: { maintainAspectRatio: false, scales: { y: { grace: '8%' } } },
    });
    return () => chart.destroy();
  }, [points, color]);

  return (
    <div className="chart">
      <canvas ref={canvas} />
    </div>
  );
}
