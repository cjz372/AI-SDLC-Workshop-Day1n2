import type { Priority, Subtask, Todo } from '@/lib/db';

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

/** Priority (high→low) → due date (earliest→latest, none last) → created_at (newest first). */
export function compareTodos(a: Todo, b: Todo): number {
  const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (byPriority !== 0) return byPriority;
  if (a.due_date !== b.due_date) {
    if (a.due_date === null) return 1;
    if (b.due_date === null) return -1;
    return a.due_date < b.due_date ? -1 : 1;
  }
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
  return b.id - a.id;
}

export interface TodoSections { overdue: Todo[]; pending: Todo[]; completed: Todo[]; }

/** `nowLocal` is the current Singapore wall-clock 'YYYY-MM-DDTHH:mm'. */
export function groupTodos(todos: readonly Todo[], nowLocal: string): TodoSections {
  const open = todos.filter((t) => !t.completed);
  const isOverdue = (t: Todo) => t.due_date !== null && t.due_date < nowLocal;
  return {
    overdue: open.filter(isOverdue).sort(compareTodos),
    pending: open.filter((t) => !isOverdue(t)).sort(compareTodos),
    completed: todos.filter((t) => t.completed).sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? '') || b.id - a.id),
  };
}

export interface SubtaskProgress { completed: number; total: number; percent: number; }

export function subtaskProgress(subtasks: readonly Subtask[] | undefined): SubtaskProgress {
  const total = subtasks?.length ?? 0;
  const completed = subtasks?.filter((s) => s.completed).length ?? 0;
  return { completed, total, percent: total === 0 ? 0 : Math.round((completed / total) * 100) };
}

export const REMINDER_LABELS: Record<number, string> = {
  15: '15m', 30: '30m', 60: '1h', 120: '2h', 1440: '1d', 2880: '2d', 10080: '1w',
};
export const REMINDER_LONG_LABELS: Record<number, string> = {
  15: '15 minutes before', 30: '30 minutes before', 60: '1 hour before', 120: '2 hours before',
  1440: '1 day before', 2880: '2 days before', 10080: '1 week before',
};

export type DueUrgency = 'overdue' | 'imminent' | 'soon' | 'week' | 'later';

/** Human-readable due text + urgency bucket. Both arguments are Singapore wall-clock minutes-precision strings. */
export function describeDue(due: string, nowLocal: string, parse: (s: string) => Date): { text: string; urgency: DueUrgency } {
  const diffMin = Math.round((parse(due).getTime() - parse(nowLocal).getTime()) / 60000);
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  const stamp = due.replace('T', ' ');
  if (diffMin < 0) {
    const m = -diffMin;
    const text = m >= 1440 ? plural(Math.floor(m / 1440), 'day') : m >= 60 ? plural(Math.floor(m / 60), 'hour') : plural(m, 'minute');
    return { text: `${text} overdue`, urgency: 'overdue' };
  }
  if (diffMin < 60) return { text: `Due in ${plural(diffMin, 'minute')}`, urgency: 'imminent' };
  if (diffMin < 1440) return { text: `Due in ${plural(Math.floor(diffMin / 60), 'hour')} (${stamp})`, urgency: 'soon' };
  if (diffMin < 10080) return { text: `Due in ${plural(Math.floor(diffMin / 1440), 'day')} (${stamp})`, urgency: 'week' };
  return { text: stamp, urgency: 'later' };
}
