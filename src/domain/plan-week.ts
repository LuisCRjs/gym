const DAY_MS = 86_400_000;

// Fecha local de hoy como 'YYYY-MM-DD' (toISOString daría la fecha UTC, que puede ser mañana).
export function todayISO(now = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

// Días desde el año 0 en UTC: evita errores por cambios de horario.
function dayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

// floor((hoy - inicio) / 7) + 1. Antes del inicio devuelve 0 o negativo; después de la 12, 13+.
export function planWeek(planStartDate: string, today: string): number {
  return Math.floor((dayNumber(today) - dayNumber(planStartDate)) / 7) + 1;
}

export function isDeloadWeek(week: number): boolean {
  return week === 6 || week === 12;
}

// Descarga: mitad de series, redondeo hacia arriba.
export function setsForWeek(sets: number, week: number): number {
  return isDeloadWeek(week) ? Math.ceil(sets / 2) : sets;
}
