import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { toSubtasksJson } from '@/lib/template-utils';
import { getSession } from '@/lib/auth';
import { badRequest, notFound, parseBody, parseId, unauthorized } from '@/lib/api';
import { templateDB, type Priority, type RecurrencePattern, type TemplateInput } from '@/lib/db';
import { prioritySchema, recurrenceSchema, reminderSchema, titleSchema } from '@/lib/validation';

type Ctx = { params: Promise<{ id: string }> };

const templateUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be 100 characters or fewer').optional(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  title_template: titleSchema.optional(),
  priority: prioritySchema.optional(),
  is_recurring: z.boolean().optional(),
  recurrence_pattern: recurrenceSchema.nullable().optional(),
  reminder_minutes: reminderSchema.nullable().optional(),
  due_date_offset_minutes: z.number().int().min(0).nullable().optional(),
  subtasks: z.array(z.object({ title: z.string().trim().min(1, 'Subtask title is required') })).optional(),
});

/** Copy only the keys whose values are not undefined, so untouched fields keep their stored value. */
function definedFields<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  const id = parseId((await params).id);
  const existing = id ? templateDB.findById(id, session.userId) : undefined;
  if (!id || !existing) return notFound('Template not found');

  const parsed = await parseBody(request, templateUpdateSchema);
  if ('error' in parsed) return parsed.error;
  const body = parsed.data;

  const effectiveRecurring = body.is_recurring ?? existing.is_recurring;
  const effectivePattern = body.recurrence_pattern !== undefined ? body.recurrence_pattern : existing.recurrence_pattern;
  if (effectiveRecurring && !effectivePattern) return badRequest('Choose a recurrence pattern');

  const patch: Partial<TemplateInput> = definedFields({
    name: body.name,
    description: body.description,
    category: body.category,
    title_template: body.title_template,
    priority: body.priority as Priority | undefined,
    is_recurring: body.is_recurring,
    recurrence_pattern: body.recurrence_pattern as RecurrencePattern | null | undefined,
    reminder_minutes: body.reminder_minutes,
    due_date_offset_minutes: body.due_date_offset_minutes,
    subtasks_json: body.subtasks !== undefined ? toSubtasksJson(body.subtasks) : undefined,
  });

  const template = templateDB.update(id, session.userId, patch);
  return template ? NextResponse.json({ template }) : notFound('Template not found');
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  const id = parseId((await params).id);
  if (!id || !templateDB.delete(id, session.userId)) return notFound('Template not found');
  return NextResponse.json({ success: true });
}
