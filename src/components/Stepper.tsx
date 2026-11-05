interface Props {
  label: string;
  value: number;
  step: number;
  suffix?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}

// Botones grandes − / + alrededor del valor, para usar con una mano.
export function Stepper({ label, value, step, suffix, disabled, onChange }: Props) {
  // Evita 0.1 + 0.2 = 0.30000000000000004 al sumar pasos decimales.
  const move = (delta: number) => onChange(Math.max(0, Math.round((value + delta) * 100) / 100));
  return (
    <div className="stepper">
      <p className="label">{label}</p>
      <div>
        <button disabled={disabled} onClick={() => move(-step)}>−</button>
        <span>
          {value}
          {suffix && <small> {suffix}</small>}
        </span>
        <button disabled={disabled} onClick={() => move(step)}>+</button>
      </div>
    </div>
  );
}
