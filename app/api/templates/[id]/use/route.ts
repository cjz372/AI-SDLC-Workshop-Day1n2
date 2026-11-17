import { NextRequest, NextResponse } from 'next/server';
import { parseSubtasksJson } from '@/lib/template-utils';
import { getSession } from '@/lib/auth';
import { notFound, parseId, unauthorized } from '@/lib/api';
import { subtaskDB, templateDB, todoDB } from '@/lib/db';
import { addMinutes, formatSingaporeDate, getSingaporeNow } from '@/lib/timezone';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  const id = parseId((await params).id);
  const template = id ? templateDB.findById(id, session.userId) : undefined;
  if (!template) return notFound('Template not found');

  // Offset is clamped to >= 1 minute so the new due date is never already past.
  const dueDate = template.due_date_offset_minutes == null
    ? null
    : formatSingaporeDate(addMinutes(getSingaporeNow(), Math.max(template.due_date_offset_minutes, 1)));
  // Recurrence needs a due date; without one the todo is created as a one-off.
  const recurring = template.is_recurring && dueDate !== null && template.recurrence_pattern !== null;

  const todo = todoDB.create(session.userId, {
    title: template.title_template,
    priority: template.priority,
    due_date: dueDate,
    is_recurring: recurring,
    recurrence_pattern: recurring ? template.recurrence_pattern : null,
    reminder_minutes: dueDate ? template.reminder_minutes : null,
  });
  for (const s of parseSubtasksJson(template.subtasks_json)) subtaskDB.create(todo.id, s.title, false, s.position);
  return NextResponse.json({ todo: todoDB.findById(todo.id, session.userId) }, { status: 201 });
}
