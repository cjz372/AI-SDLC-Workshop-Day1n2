import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { badRequest, parseBody, unauthorized } from '@/lib/api';
import { tagDB, todoDB, type Priority, type RecurrencePattern } from '@/lib/db';
import { isDueDateInFuture } from '@/lib/timezone';
import { checkTodoRules, todoCreateSchema } from '@/lib/validation';

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  return NextResponse.json({ todos: todoDB.list(session.userId) });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const parsed = await parseBody(request, todoCreateSchema);
  if ('error' in parsed) return parsed.error;
  const body = parsed.data;

  const ruleError = checkTodoRules(body);
  if (ruleError) return badRequest(ruleError);
  if (body.due_date && !isDueDateInFuture(body.due_date, 1)) return badRequest('Due date must be at least 1 minute in the future');
  const tagIds = body.tag_ids ?? [];
  if (!tagIds.every((id) => tagDB.findById(id, session.userId))) return badRequest('Unknown tag');

  const todo = todoDB.create(session.userId, {
    title: body.title,
    priority: body.priority as Priority | undefined,
    due_date: body.due_date ?? null,
    is_recurring: body.is_recurring ?? false,
    recurrence_pattern: (body.recurrence_pattern ?? null) as RecurrencePattern | null,
    reminder_minutes: body.reminder_minutes ?? null,
  });
  if (tagIds.length > 0) tagDB.setForTodo(todo.id, tagIds);
  return NextResponse.json({ todo: todoDB.findById(todo.id, session.userId) }, { status: 201 });
}
