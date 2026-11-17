import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { toSubtasksJson } from '@/lib/template-utils';
import { getSession } from '@/lib/auth';
import { badRequest, parseBody, unauthorized } from '@/lib/api';
import { templateDB, type Priority, type RecurrencePattern } from '@/lib/db';
import { prioritySchema, recurrenceSchema, reminderSchema, titleSchema } from '@/lib/validation';

const templateCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be 100 characters or fewer'),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  title_template: titleSchema,
  priority: prioritySchema.optional(),
  is_recurring: z.boolean().optional(),
  recurrence_pattern: recurrenceSchema.nullable().optional(),
  reminder_minutes: reminderSchema.nullable().optional(),
  due_date_offset_minutes: z.number().int().min(0).nullable().optional(),
  subtasks: z.array(z.object({ title: z.string().trim().min(1, 'Subtask title is required') })).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  return NextResponse.json({ templates: templateDB.list(session.userId) });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const parsed = await parseBody(request, templateCreateSchema);
  if ('error' in parsed) return parsed.error;
  const body = parsed.data;

  const isRecurring = body.is_recurring ?? false;
  if (isRecurring && !body.recurrence_pattern) return badRequest('Choose a recurrence pattern');

  const template = templateDB.create(session.userId, {
    name: body.name,
    description: body.description ?? null,
    category: body.category ?? null,
    title_template: body.title_template,
    priority: body.priority as Priority | undefined,
    is_recurring: isRecurring,
    recurrence_pattern: (body.recurrence_pattern ?? null) as RecurrencePattern | null,
    reminder_minutes: body.reminder_minutes ?? null,
    due_date_offset_minutes: body.due_date_offset_minutes ?? null,
    subtasks_json: toSubtasksJson(body.subtasks),
  });
  return NextResponse.json({ template }, { status: 201 });
}
