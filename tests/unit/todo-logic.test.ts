import { describe, expect, it } from 'vitest';
import { applyFilters, EMPTY_FILTERS, hasActiveFilters } from '@/lib/filters';
import { generateCalendarGrid, parseMonthParam, shiftMonth } from '@/lib/calendar';
import { buildCsv, buildExport, csvCell } from '@/lib/export-format';
import { isReminderDue } from '@/lib/reminders';
import { compareTodos, describeDue, groupTodos, subtaskProgress } from '@/lib/todo-utils';
import { parseSingaporeLocal } from '@/lib/timezone';
import type { Todo } from '@/lib/db';

let nextId = 1;
const todo = (over: Partial<Todo> = {}): Todo => ({
  id: nextId++, user_id: 1, title: 'Task', completed: false, due_date: null, priority: 'medium', is_recurring: false,
  recurrence_pattern: null, reminder_minutes: null, last_notification_sent: null, created_at: '2025-01-01 00:00:00',
  updated_at: null, subtasks: [], tags: [], ...over,
});

describe('sorting & sections', () => {
  it('sorts by priority, then due date (none last), then newest created', () => {
    const list = [
      todo({ title: 'low', priority: 'low', due_date: '2025-01-01T09:00' }),
      todo({ title: 'med-none', priority: 'medium' }),
      todo({ title: 'high-late', priority: 'high', due_date: '2025-01-03T09:00' }),
      todo({ title: 'high-early', priority: 'high', due_date: '2025-01-02T09:00' }),
      todo({ title: 'med-old', priority: 'medium', due_date: '2025-01-05T09:00', created_at: '2025-01-01 00:00:00' }),
      todo({ title: 'med-new', priority: 'medium', due_date: '2025-01-05T09:00', created_at: '2025-01-02 00:00:00' }),
    ];
    expect([...list].sort(compareTodos).map((t) => t.title)).toEqual(['high-early', 'high-late', 'med-new', 'med-old', 'med-none', 'low']);
  });
  it('groups into overdue / pending / completed', () => {
    const now = '2025-06-01T12:00';
    const g = groupTodos([
      todo({ title: 'late', due_date: '2025-06-01T11:59' }),
      todo({ title: 'soon', due_date: '2025-06-01T12:00' }),
      todo({ title: 'nodate' }),
      todo({ title: 'done-old', completed: true, due_date: '2025-01-01T00:00', updated_at: '2025-06-01T10:00:00' }),
      todo({ title: 'done-new', completed: true, updated_at: '2025-06-01T11:00:00' }),
    ], now);
    expect(g.overdue.map((t) => t.title)).toEqual(['late']);
    expect(g.pending.map((t) => t.title)).toEqual(['soon', 'nodate']);
    expect(g.completed.map((t) => t.title)).toEqual(['done-new', 'done-old']);
  });
  it('computes subtask progress', () => {
    const s = (completed: boolean) => ({ id: 1, todo_id: 1, title: 'x', completed, position: 0, created_at: '' });
    expect(subtaskProgress([])).toEqual({ completed: 0, total: 0, percent: 0 });
    expect(subtaskProgress([s(true), s(false), s(false)])).toEqual({ completed: 1, total: 3, percent: 33 });
    expect(subtaskProgress([s(true)]).percent).toBe(100);
  });
  it('describes due urgency', () => {
    const d = (due: string) => describeDue(due, '2025-06-01T12:00', parseSingaporeLocal);
    expect(d('2025-05-30T12:00')).toEqual({ text: '2 days overdue', urgency: 'overdue' });
    expect(d('2025-06-01T12:30').urgency).toBe('imminent');
    expect(d('2025-06-01T18:00').urgency).toBe('soon');
    expect(d('2025-06-04T12:00').urgency).toBe('week');
    expect(d('2025-07-01T12:00').urgency).toBe('later');
  });
});

describe('reminders', () => {
  const base = { completed: false, due_date: '2025-06-01T12:00', reminder_minutes: 60, last_notification_sent: null };
  it('fires only inside the reminder window', () => {
    expect(isReminderDue(base, '2025-06-01T10:59')).toBe(false);
    expect(isReminderDue(base, '2025-06-01T11:00')).toBe(true);
    expect(isReminderDue(base, '2025-06-01T12:01')).toBe(false);
  });
  it('does not repeat once notified for this window', () => {
    expect(isReminderDue({ ...base, last_notification_sent: '2025-06-01T11:00:30' }, '2025-06-01T11:30')).toBe(false);
    expect(isReminderDue({ ...base, last_notification_sent: '2025-05-31T11:00:30' }, '2025-06-01T11:30')).toBe(true);
  });
  it('ignores completed todos and missing data', () => {
    expect(isReminderDue({ ...base, completed: true }, '2025-06-01T11:30')).toBe(false);
    expect(isReminderDue({ ...base, due_date: null }, '2025-06-01T11:30')).toBe(false);
    expect(isReminderDue({ ...base, reminder_minutes: null }, '2025-06-01T11:30')).toBe(false);
  });
});

describe('filters', () => {
  const tag = { id: 7, user_id: 1, name: 'Work', color: '#3B82F6', created_at: '' };
  const sub = { id: 1, todo_id: 1, title: 'Send REPORT', completed: false, position: 0, created_at: '' };
  const list = [
    todo({ title: 'Meeting notes', subtasks: [sub], priority: 'high', tags: [tag], due_date: '2025-11-03T09:00' }),
    todo({ title: 'Monthly report', priority: 'low', completed: true, due_date: '2025-12-01T09:00' }),
    todo({ title: 'Buy milk' }),
  ];
  it('searches titles and subtasks case-insensitively', () => {
    expect(applyFilters(list, { ...EMPTY_FILTERS, search: 'REPORT' }).map((t) => t.title)).toEqual(['Meeting notes', 'Monthly report']);
  });
  it('matches tag names', () => {
    expect(applyFilters(list, { ...EMPTY_FILTERS, search: 'wor' }).map((t) => t.title)).toEqual(['Meeting notes']);
  });
  it('combines filters with AND', () => {
    expect(applyFilters(list, { ...EMPTY_FILTERS, search: 'report', priority: 'high', tagId: 7, completion: 'incomplete' })).toHaveLength(1);
    expect(applyFilters(list, { ...EMPTY_FILTERS, priority: 'low', tagId: 7 })).toHaveLength(0);
  });
  it('date range excludes todos without due dates', () => {
    expect(applyFilters(list, { ...EMPTY_FILTERS, dueDateFrom: '2025-11-01', dueDateTo: '2025-11-30' }).map((t) => t.title)).toEqual(['Meeting notes']);
    expect(applyFilters(list, { ...EMPTY_FILTERS, dueDateTo: '2025-12-31' })).toHaveLength(2);
  });
  it('detects active filters', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, search: ' x ' })).toBe(true);
  });
  it('filters 1000 todos quickly', () => {
    const many = Array.from({ length: 1000 }, (_, i) => todo({ title: `Todo ${i}`, subtasks: [{ ...sub, title: `sub ${i}` }] }));
    const start = performance.now();
    applyFilters(many, { ...EMPTY_FILTERS, search: '99', priority: 'medium' });
    expect(performance.now() - start).toBeLessThan(100);
  });
});

describe('calendar', () => {
  it('builds 5-week and 6-week grids with adjacent days', () => {
    const feb2026 = generateCalendarGrid(2026, 2, '2026-02-10'); // Feb 1 2026 is a Sunday, 28 days → 4 weeks exact
    expect(feb2026).toHaveLength(4);
    const aug2026 = generateCalendarGrid(2026, 8, '2026-08-09'); // Aug 1 is Saturday → 6 rows
    expect(aug2026).toHaveLength(6);
    expect(aug2026[0][0].inMonth).toBe(false);
    expect(aug2026[0][6]).toMatchObject({ date: '2026-08-01', inMonth: true, isWeekend: true });
    const today = aug2026.flat().find((d) => d.isToday);
    expect(today?.date).toBe('2026-08-09');
  });
  it('handles leap years', () => {
    const days = generateCalendarGrid(2024, 2, '2024-02-29').flat().filter((d) => d.inMonth);
    expect(days).toHaveLength(29);
  });
  it('parses and shifts month params with fallback', () => {
    expect(parseMonthParam('2025-03', '2025-01')).toEqual({ year: 2025, month: 3 });
    expect(parseMonthParam('2025-13', '2025-01')).toEqual({ year: 2025, month: 1 });
    expect(parseMonthParam('garbage', '2025-01')).toEqual({ year: 2025, month: 1 });
    expect(parseMonthParam('1800-01', '2025-01')).toEqual({ year: 2025, month: 1 });
    expect(shiftMonth(2025, 12, 1)).toEqual({ year: 2026, month: 1 });
    expect(shiftMonth(2025, 1, -1)).toEqual({ year: 2024, month: 12 });
  });
});

describe('export format', () => {
  it('quotes csv cells and neutralises formulas', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a, "b"')).toBe('"a, ""b"""');
    expect(csvCell('=SUM(A1)')).toBe(`"'=SUM(A1)"`);
    expect(csvCell(null)).toBe('');
    expect(csvCell(true)).toBe('true');
  });
  it('builds csv with the documented columns', () => {
    const csv = buildCsv([todo({ id: 5, title: 'Hello, world', due_date: '2025-11-10T14:00', priority: 'high' })]);
    expect(csv.split('\n')[0]).toBe('ID,Title,Completed,Due Date,Priority,Recurring,Pattern,Reminder');
    expect(csv.split('\n')[1]).toBe('5,"Hello, world",false,2025-11-10T14:00,high,false,,');
  });
  it('exports an envelope with tags and subtasks but without ids', () => {
    const out = buildExport([todo({ tags: [{ id: 1, user_id: 1, name: 'Work', color: '#000000', created_at: '' }] })], '2025-01-01T00:00');
    expect(out.version).toBe(1);
    expect(out.todos[0]).not.toHaveProperty('id');
    expect(out.todos[0].tags).toEqual([{ name: 'Work', color: '#000000' }]);
  });
});
