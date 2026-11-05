import { useEffect, useId, useState, type ReactNode } from 'react';

interface Props {
  value: number; // 0..1
  size?: number; // tamaño de diseño en px; en pantallas angostas se reduce solo
  stroke?: number;
  from?: string;
  to?: string;
  linear?: boolean; // transición lineal (temporizador) en vez de con rebote
  children?: ReactNode; // contenido centrado
}

// Anillo de progreso estilo Apple Fitness. Es un círculo SVG cuyo trazo se acorta con
// stroke-dashoffset; el CSS anima el cambio. Arranca en 0 para que se "llene" al aparecer.
export function Ring({ value, size = 120, stroke = 14, from = '#3b82f6', to = '#22d3ee', linear, children }: Props) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(id);
  }, [value]);

  const gradientId = useId().replace(/:/g, '');
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, shown));

  return (
    <div className="ring" style={{ width: `min(${size}px, 80vw)`, aspectRatio: '1' }}>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={from} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
        <circle
          className={linear ? 'ring-fill linear' : 'ring-fill'}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}
