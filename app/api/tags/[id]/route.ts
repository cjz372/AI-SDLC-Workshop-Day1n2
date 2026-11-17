import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { badRequest, notFound, parseBody, parseId, unauthorized } from '@/lib/api';
import { tagDB } from '@/lib/db';
import { colorSchema } from '@/lib/validation';

type Ctx = { params: Promise<{ id: string }> };

const tagUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Tag name is required').max(50, 'Tag name must be 50 characters or fewer').optional(),
  color: colorSchema.optional(),
});

export async function PUT(request: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  const id = parseId((await params).id);
  const existing = id ? tagDB.findById(id, session.userId) : undefined;
  if (!id || !existing) return notFound('Tag not found');

  const parsed = await parseBody(request, tagUpdateSchema);
  if ('error' in parsed) return parsed.error;
  const { name, color } = parsed.data;

  if (name !== undefined) {
    const duplicate = tagDB.findByName(session.userId, name);
    if (duplicate && duplicate.id !== id) return badRequest('Tag name already exists');
  }

  const tag = tagDB.update(id, session.userId, { name, color });
  return tag ? NextResponse.json({ tag }) : notFound('Tag not found');
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  const id = parseId((await params).id);
  if (!id || !tagDB.delete(id, session.userId)) return notFound('Tag not found');
  return NextResponse.json({ success: true });
}
