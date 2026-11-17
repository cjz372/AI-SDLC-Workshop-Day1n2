import { z } from 'zod';
import { PRIORITIES, RECURRENCE_PATTERNS, REMINDER_OPTIONS } from '@/lib/db';
import { isValidSingaporeLocal } from '@/lib/timezone';

export const titleSchema = z.string().trim().min(1, 'Title is required').max(500, 'Title is too long');
export const prioritySchema = z.enum(PRIORITIES as [string, ...string[]], { error: 'Invalid priority' });
export const recurrenceSchema = z.enum(RECURRENCE_PATTERNS as [string, ...string[]], { error: 'Invalid recurrence pattern' });
export const reminderSchema = z.number().refine((n) => (REMINDER_OPTIONS as readonly number[]).includes(n), 'Invalid reminder option');
export const dueDateSchema = z.string().refine(isValidSingaporeLocal, 'Invalid due date');
export const colorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a hex code like #3B82F6');

const nullable = <T extends z.ZodType>(schema: T) => schema.nullable().optional();

export const todoCreateSchema = z.object({
  title: titleSchema,
  priority: prioritySchema.optional(),
  due_date: nullable(dueDateSchema),
  is_recurring: z.boolean().optional(),
  recurrence_pattern: nullable(recurrenceSchema),
  reminder_minutes: nullable(reminderSchema),
  tag_ids: z.array(z.number().int().positive()).optional(),
});

export const todoUpdateSchema = todoCreateSchema.partial().extend({ completed: z.boolean().optional() });

export type TodoCreateBody = z.infer<typeof todoCreateSchema>;
export type TodoUpdateBody = z.infer<typeof todoUpdateSchema>;

/** Cross-field rules shared by create and update. Returns an error message or null. */
export function checkTodoRules(state: { due_date?: string | null; is_recurring?: boolean; recurrence_pattern?: string | null; reminder_minutes?: number | null }): string | null {
  if (state.is_recurring && !state.recurrence_pattern) return 'Choose a recurrence pattern';
  if (state.is_recurring && !state.due_date) return 'Recurring todos require a due date';
  if (state.reminder_minutes && !state.due_date) return 'Reminders require a due date';
  return null;
}
