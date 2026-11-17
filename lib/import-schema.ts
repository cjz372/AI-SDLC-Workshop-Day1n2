import { z } from 'zod';
import { colorSchema, dueDateSchema, prioritySchema, recurrenceSchema, reminderSchema, titleSchema } from '@/lib/validation';

const importSubtask = z.object({
  title: titleSchema,
  completed: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

const importTag = z.object({ name: z.string().trim().min(1).max(50), color: colorSchema.optional() });

const importTodo = z.object({
  title: titleSchema,
  completed: z.boolean().optional(),
  due_date: dueDateSchema.nullable().optional(),
  priority: prioritySchema.optional(),
  is_recurring: z.boolean().optional(),
  recurrence_pattern: recurrenceSchema.nullable().optional(),
  reminder_minutes: reminderSchema.nullable().optional(),
  created_at: z.string().max(40).optional(),
  subtasks: z.array(importSubtask).max(500).optional(),
  tags: z.array(importTag).max(50).optional(),
}).superRefine((t, ctx) => {
  if (t.is_recurring && (!t.recurrence_pattern || !t.due_date)) {
    ctx.addIssue({ code: 'custom', message: `Recurring todo "${t.title}" needs a pattern and a due date` });
  }
  if (t.reminder_minutes && !t.due_date) {
    ctx.addIssue({ code: 'custom', message: `Todo "${t.title}" has a reminder but no due date` });
  }
});

export const importSchema = z.object({
  version: z.literal(1, { error: 'Unsupported export version' }),
  exported_at: z.string().optional(),
  todos: z.array(importTodo).max(5000, 'Too many todos in one import'),
});
export type ImportPayload = z.infer<typeof importSchema>;
