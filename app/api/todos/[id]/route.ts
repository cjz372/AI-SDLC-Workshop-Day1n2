import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { badRequest, notFound, parseBody, parseId, unauthorized } from '@/lib/api';
import { tagDB, todoDB, type Priority, type RecurrencePattern, type TodoPatch } from '@/lib/db';
import { calculateNextDueDate } from '@/lib/recurrence';
import { isDueDateInFuture } from '@/lib/timezone';
import { checkTodoRules, todoUpdateSchema } from '@/lib/validation';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  const id = parseId((await params).id);
  const todo = id ? todoDB.findById(id, session.userId) : undefined;
  return todo ? NextResponse.json({ todo }) : notFound('Todo not found');
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  const id = parseId((await params).id);
  const existing = id ? todoDB.findById(id, session.userId) : undefined;
  if (!id || !existing) return notFound('Todo not found');

  const parsed = await parseBody(request, todoUpdateSchema);
  if ('error' in parsed) return parsed.error;
  const body = parsed.data;

  const effective = {
    due_date: body.due_date !== undefined ? body.due_date : existing.due_date,
    is_recurring: body.is_recurring ?? existing.is_recurring,
    recurrence_pattern: body.recurrence_pattern !== undefined ? body.recurrence_pattern : existing.recurrence_pattern,
    reminder_minutes: body.reminder_minutes !== undefined ? body.reminder_minutes : existing.reminder_minutes,
  };
  const ruleError = checkTodoRules(effective);
  if (ruleError) return badRequest(ruleError);
  if (body.due_date && body.due_date !== existing.due_date && !isDueDateInFuture(body.due_date, 1)) {
    return badRequest('Due date must be at least 1 minute in the future');
  }
  if (body.tag_ids && !body.tag_ids.every((tid) => tagDB.findById(tid, session.userId))) return badRequest('Unknown tag');

  const patch: TodoPatch = {
    title: body.title,
    completed: body.completed,
    priority: body.priority as Priority | undefined,
    due_date: body.due_date,
    is_recurring: body.is_recurring,
    recurrence_pattern: body.is_recurring === false ? null : (body.recurrence_pattern as RecurrencePattern | null | undefined),
    reminder_minutes: body.reminder_minutes,
  };
  // A changed due date or reminder re-arms the notification.
  if (body.due_date !== undefined || body.reminder_minutes !== undefined) patch.last_notification_sent = null;

  const updated = todoDB.update(id, session.userId, patch);
  if (body.tag_ids) tagDB.setForTodo(id, body.tag_ids);

  // Completing a recurring todo spawns the next instance.
  let next = null;
  if (body.completed === true && !existing.completed && existing.is_recurring && existing.recurrence_pattern && existing.due_date) {
    const created = todoDB.create(session.userId, {
      title: existing.title,
      priority: existing.priority,
      due_date: calculateNextDueDate(existing.due_date, existing.recurrence_pattern),
      is_recurring: true,
      recurrence_pattern: existing.recurrence_pattern,
      reminder_minutes: existing.reminder_minutes,
    });
    tagDB.setForTodo(created.id, (existing.tags ?? []).map((t) => t.id));
    next = todoDB.findById(created.id, session.userId);
  }
  return NextResponse.json({ todo: todoDB.findById(id, session.userId) ?? updated, next });
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  const id = parseId((await params).id);
  if (!id || !todoDB.delete(id, session.userId)) return notFound('Todo not found');
  return NextResponse.json({ success: true });
}
