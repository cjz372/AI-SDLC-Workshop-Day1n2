import { describe, expect, it } from 'vitest';
import { calculateNextDueDate } from '@/lib/recurrence';
import {
  addMinutes, formatSingaporeDate, formatSingaporeDay, isDueDateInFuture, isValidSingaporeLocal, parseSingaporeLocal,
} from '@/lib/timezone';

describe('timezone', () => {
  it('formats an instant in Singapore time (UTC+8)', () => {
    expect(formatSingaporeDate(new Date('2025-01-01T16:30:00Z'))).toBe('2025-01-02T00:30');
    expect(formatSingaporeDay(new Date('2025-12-31T16:00:00Z'))).toBe('2026-01-01');
  });
  it('round-trips local strings', () => {
    expect(formatSingaporeDate(parseSingaporeLocal('2025-06-15T09:05'))).toBe('2025-06-15T09:05');
  });
  it('validates local datetimes', () => {
    expect(isValidSingaporeLocal('2025-02-29T10:00')).toBe(false);
    expect(isValidSingaporeLocal('2024-02-29T10:00')).toBe(true);
    expect(isValidSingaporeLocal('2025-01-01')).toBe(false);
    expect(isValidSingaporeLocal(42)).toBe(false);
  });
  it('requires due dates at least one minute ahead', () => {
    const now = new Date('2025-01-01T00:00:00Z'); // 08:00 SGT
    expect(isDueDateInFuture('2025-01-01T08:00', 1, now)).toBe(false);
    expect(isDueDateInFuture('2025-01-01T08:01', 1, now)).toBe(true);
    expect(formatSingaporeDate(addMinutes(now, 90))).toBe('2025-01-01T09:30');
  });
});

describe('calculateNextDueDate', () => {
  it('handles daily and weekly across month ends', () => {
    expect(calculateNextDueDate('2025-01-31T09:00', 'daily')).toBe('2025-02-01T09:00');
    expect(calculateNextDueDate('2025-12-28T09:00', 'weekly')).toBe('2026-01-04T09:00');
  });
  it('clamps monthly to the last day of the target month', () => {
    expect(calculateNextDueDate('2025-01-31T09:00', 'monthly')).toBe('2025-02-28T09:00');
    expect(calculateNextDueDate('2024-01-31T09:00', 'monthly')).toBe('2024-02-29T09:00');
    expect(calculateNextDueDate('2025-12-15T09:00', 'monthly')).toBe('2026-01-15T09:00');
  });
  it('moves Feb 29 to Feb 28 on non-leap yearly recurrence', () => {
    expect(calculateNextDueDate('2024-02-29T09:00', 'yearly')).toBe('2025-02-28T09:00');
    expect(calculateNextDueDate('2025-03-10T18:45', 'yearly')).toBe('2026-03-10T18:45');
  });
  it('rejects invalid input', () => {
    expect(() => calculateNextDueDate('nope', 'daily')).toThrow();
  });
});
