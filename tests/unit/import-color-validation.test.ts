import { describe, expect, it } from 'vitest';
import { importSchema } from '@/lib/import-schema';
import { colorSchema } from '@/lib/validation';

describe('importSchema', () => {
  const envelope = {
    version: 1,
    todos: [{ title: 'Pay bills', due_date: '2026-04-01T09:00', reminder_minutes: 60, tags: [{ name: 'home', color: '#10B981' }] }],
  };

  it('accepts a valid envelope', () => {
    expect(importSchema.safeParse(envelope).success).toBe(true);
  });

  it('rejects an unsupported version', () => {
    expect(importSchema.safeParse({ ...envelope, version: 2 }).success).toBe(false);
  });

  it('rejects a recurring todo without a due date', () => {
    const bad = { version: 1, todos: [{ title: 'Standup', is_recurring: true, recurrence_pattern: 'daily' }] };
    expect(importSchema.safeParse(bad).success).toBe(false);
  });
});

describe('colorSchema', () => {
  it('accepts 6-digit hex colours only', () => {
    expect(colorSchema.safeParse('#3B82F6').success).toBe(true);
    expect(colorSchema.safeParse('#abcdef').success).toBe(true);
    expect(colorSchema.safeParse('#FFF').success).toBe(false);
    expect(colorSchema.safeParse('red').success).toBe(false);
  });
});
