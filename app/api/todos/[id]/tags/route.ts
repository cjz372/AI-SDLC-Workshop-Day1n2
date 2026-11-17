import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { notFound, parseBody, parseId, unauthorized } from '@/lib/api';
import { tagDB, todoDB } from '@/lib/db';

type Ctx = { params: Promise<{ id: string }> };

const todoTagSchema = z.object({ tag_id: z.number().int().positive() });

/** Resolve the todo and tag from the route and body, both scoped to the session user. */
async function resolveOwned(request: NextRequest, { params }: Ctx, userId: number) {
  const todoId = parseId((await params).id);
  const todo = todoId ? todoDB.findById(todoId, userId) : undefined;
  if (!todoId || !todo) return { error: notFound('Todo not found') } as const;

  const parsed = await parseBody(request, todoTagSchema);
  if ('error' in parsed) return { error: parsed.error } as const;

  const tag = tagDB.findById(parsed.data.tag_id, userId);
  if (!tag) return { error: notFound('Tag not found') } as const;
  return { todoId, tagId: tag.id } as const;
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  const resolved = await resolveOwned(request, ctx, session.userId);
  if ('error' in resolved) return resolved.error;

  tagDB.attach(resolved.todoId, resolved.tagId);
  return NextResponse.json({ todo: todoDB.findById(resolved.todoId, session.userId) });
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  const resolved = await resolveOwned(request, ctx, session.userId);
  if ('error' in resolved) return resolved.error;

  tagDB.detach(resolved.todoId, resolved.tagId);
  return NextResponse.json({ todo: todoDB.findById(resolved.todoId, session.userId) });
}
