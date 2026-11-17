import { describe, expect, it } from 'vitest';
import { signChallengeToken, signSessionToken, verifyChallengeToken, verifySessionToken } from '@/lib/jwt';
import { checkTodoRules, todoCreateSchema } from '@/lib/validation';

describe('session and challenge JWT', () => {
  it('round-trips the session userId and username', async () => {
    const token = await signSessionToken({ userId: 42, username: 'alice' });
    expect(await verifySessionToken(token)).toEqual({ userId: 42, username: 'alice' });
  });

  it('rejects a tampered token and undefined input', async () => {
    const token = await signSessionToken({ userId: 1, username: 'bob' });
    const [h, , s] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ userId: 999, username: 'eve' })).toString('base64url');
    expect(await verifySessionToken(`${h}.${forged}.${s}`)).toBeNull();
    expect(await verifySessionToken(undefined)).toBeNull();
    expect(await verifySessionToken('not-a-jwt')).toBeNull();
  });

  it('round-trips a challenge token', async () => {
    const token = await signChallengeToken({ challenge: 'abc123', username: 'carol' });
    expect(await verifyChallengeToken(token)).toMatchObject({ challenge: 'abc123', username: 'carol' });
    expect(await verifyChallengeToken(undefined)).toBeNull();
  });
});

describe('todoCreateSchema', () => {
  it('accepts a minimal body and rejects empty or whitespace titles', () => {
    expect(todoCreateSchema.safeParse({ title: 'Read book' }).success).toBe(true);
    expect(todoCreateSchema.safeParse({ title: '' }).success).toBe(false);
    expect(todoCreateSchema.safeParse({ title: '   ' }).success).toBe(false);
  });

  it('rejects a bad priority and a bad due date', () => {
    expect(todoCreateSchema.safeParse({ title: 'x', priority: 'urgent' }).success).toBe(false);
    expect(todoCreateSchema.safeParse({ title: 'x', due_date: '2026-02-30T10:00' }).success).toBe(false);
    expect(todoCreateSchema.safeParse({ title: 'x', due_date: '2026-02-03T10:00' }).success).toBe(true);
  });
});

describe('checkTodoRules', () => {
  it('requires a due date and a pattern for recurring todos', () => {
    expect(checkTodoRules({ is_recurring: true, recurrence_pattern: 'daily' })).toBe('Recurring todos require a due date');
    expect(checkTodoRules({ is_recurring: true, due_date: '2026-03-01T09:00' })).toBe('Choose a recurrence pattern');
  });

  it('requires a due date for reminders', () => {
    expect(checkTodoRules({ reminder_minutes: 60 })).toBe('Reminders require a due date');
    expect(checkTodoRules({ reminder_minutes: 60, due_date: '2026-03-01T09:00' })).toBeNull();
  });
});
