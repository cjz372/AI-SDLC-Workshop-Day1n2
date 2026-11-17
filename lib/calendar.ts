export interface CalendarDay {
  date: string; // YYYY-MM-DD
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  isWeekend: boolean;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Full month grid (5 or 6 weeks, Sunday-first) including leading/trailing adjacent-month days. `today` is 'YYYY-MM-DD' (Singapore). */
export function generateCalendarGrid(year: number, month: number, today: string): CalendarDay[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leading = first.getUTCDay();
  const weeks = Math.ceil((leading + daysInMonth) / 7);
  const start = Date.UTC(year, month - 1, 1 - leading);
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = new Date(start + (w * 7 + d) * 86_400_000);
      const key = iso(date);
      return {
        date: key,
        day: date.getUTCDate(),
        inMonth: date.getUTCMonth() === month - 1,
        isToday: key === today,
        isPast: key < today,
        isWeekend: d === 0 || d === 6,
      };
    }),
  );
}

/** Parse '?month=YYYY-MM'. Invalid or out-of-range values fall back to `fallback` (also 'YYYY-MM'). */
export function parseMonthParam(value: string | null | undefined, fallback: string): { year: number; month: number } {
  const pick = (v: string) => {
    const m = /^(\d{4})-(\d{2})$/.exec(v);
    if (!m) return null;
    const year = Number(m[1]);
    const month = Number(m[2]);
    return year >= 1970 && year <= 2100 && month >= 1 && month <= 12 ? { year, month } : null;
  };
  return (value ? pick(value) : null) ?? pick(fallback) ?? { year: 1970, month: 1 };
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export const formatMonthParam = (year: number, month: number) => `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
