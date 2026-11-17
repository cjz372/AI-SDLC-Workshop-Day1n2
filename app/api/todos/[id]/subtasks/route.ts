import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { notFound, parseBody, parseId, unauthorized } from '@/lib/api';
import { subtaskDB, todoDB } from '@/lib/db';
import { titleSchema } from '@/lib/validation';

type Ctx = { params: Promise<{ id: string }> };

const subtaskCreateSchema = z.object({ title: titleSchema });

export async function POST(request: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  const todoId = parseId((await params).id);
  const todo = todoId ? todoDB.findById(todoId, session.userId) : undefined;
  if (!todoId || !todo) return notFound('Todo not found');

  const parsed = await parseBody(request, subtaskCreateSchema);
  if ('error' in parsed) return parsed.error;

  const subtask = subtaskDB.create(todoId, parsed.data.title);
  return NextResponse.json({ subtask }, { status: 201 });
}
