import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { notFound, parseBody, parseId, unauthorized } from '@/lib/api';
import { subtaskDB } from '@/lib/db';
import { titleSchema } from '@/lib/validation';

type Ctx = { params: Promise<{ id: string }> };

const subtaskUpdateSchema = z.object({
  title: titleSchema.optional(),
  completed: z.boolean().optional(),
});

export async function PUT(request: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  const id = parseId((await params).id);
  const existing = id ? subtaskDB.findOwned(id, session.userId) : undefined;
  if (!id || !existing) return notFound('Subtask not found');

  const parsed = await parseBody(request, subtaskUpdateSchema);
  if ('error' in parsed) return parsed.error;

  subtaskDB.update(id, parsed.data);
  const subtask = subtaskDB.findOwned(id, session.userId);
  return subtask ? NextResponse.json({ subtask }) : notFound('Subtask not found');
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  const id = parseId((await params).id);
  const existing = id ? subtaskDB.findOwned(id, session.userId) : undefined;
  if (!id || !existing) return notFound('Subtask not found');

  subtaskDB.delete(id);
  return NextResponse.json({ success: true });
}
