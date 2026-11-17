import { daysInMonth, isValidSingaporeLocal } from '@/lib/timezone';

import type { RecurrencePattern } from '@/lib/db';

/**
 * Next due date for a recurring todo. Operates on Singapore wall-clock strings.
 * Monthly/yearly clamp to the last valid day (Jan 31 -> Feb 28/29, Feb 29 -> Feb 28).
 */
export function calculateNextDueDate(current: string, pattern: RecurrencePattern): string {
  if (!isValidSingaporeLocal(current)) throw new Error(`Invalid due date: ${current}`);
  const [datePart, timePart] = current.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const time = timePart.slice(0, 5);
  const fmt = (yy: number, mm: number, dd: number) =>
    `${String(yy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}T${time}`;

  if (pattern === 'daily' || pattern === 'weekly') {
    const next = new Date(Date.UTC(y, m - 1, d + (pattern === 'daily' ? 1 : 7)));
    return fmt(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
  }
  if (pattern === 'monthly') {
    const ny = m === 12 ? y + 1 : y;
    const nm = m === 12 ? 1 : m + 1;
    return fmt(ny, nm, Math.min(d, daysInMonth(ny, nm)));
  }
  return fmt(y + 1, m, Math.min(d, daysInMonth(y + 1, m)));
}
