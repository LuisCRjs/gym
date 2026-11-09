import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

// Tarjeta base. Conserva la clase `card` para que los estilos actuales (márgenes, etiquetas)
// sigan funcionando mientras se migran las pantallas.
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('card', className)} {...props} />;
}
