import type { Todo } from '@/lib/db';

export const EXPORT_VERSION = 1;

export function buildExport(todos: readonly Todo[], exportedAt: string) {
  return {
    version: EXPORT_VERSION,
    exported_at: exportedAt,
    todos: todos.map((t) => ({
      title: t.title,
      completed: t.completed,
      due_date: t.due_date,
      priority: t.priority,
      is_recurring: t.is_recurring,
      recurrence_pattern: t.recurrence_pattern,
      reminder_minutes: t.reminder_minutes,
      created_at: t.created_at,
      subtasks: (t.subtasks ?? []).map((s) => ({ title: s.title, completed: s.completed, position: s.position })),
      tags: (t.tags ?? []).map((g) => ({ name: g.name, color: g.color })),
    })),
  };
}

/** Quote a CSV cell; neutralise spreadsheet formula injection by prefixing risky leading characters. */
export function csvCell(value: string | number | boolean | null): string {
  let text = value === null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) || text !== String(value ?? '') ? `"${text.replace(/"/g, '""')}"` : text;
}

export const CSV_HEADER = 'ID,Title,Completed,Due Date,Priority,Recurring,Pattern,Reminder';

export function buildCsv(todos: readonly Todo[]): string {
  const rows = todos.map((t) =>
    [t.id, t.title, t.completed, t.due_date, t.priority, t.is_recurring, t.recurrence_pattern, t.reminder_minutes].map(csvCell).join(','),
  );
  return [CSV_HEADER, ...rows].join('\n') + '\n';
}
