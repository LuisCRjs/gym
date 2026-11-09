import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Une clases y resuelve conflictos de Tailwind (la última gana): cn('p-2', 'p-4') -> 'p-4'.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
