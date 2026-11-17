import type { Todo } from '@/lib/db';
import { addMinutes, formatSingaporeDate, parseSingaporeLocal } from '@/lib/timezone';

/**
 * A reminder is due once `now` is inside [due - reminder_minutes, due] and no notification has
 * already been recorded at/after the start of that window. All values are Singapore wall-clock strings.
 */
export function isReminderDue(todo: Pick<Todo, 'completed' | 'due_date' | 'reminder_minutes' | 'last_notification_sent'>, nowLocal: string): boolean {
  if (todo.completed || !todo.due_date || !todo.reminder_minutes) return false;
  const windowStart = formatSingaporeDate(addMinutes(parseSingaporeLocal(todo.due_date), -todo.reminder_minutes));
  if (nowLocal < windowStart || nowLocal > todo.due_date) return false;
  return !todo.last_notification_sent || todo.last_notification_sent < windowStart;
}
