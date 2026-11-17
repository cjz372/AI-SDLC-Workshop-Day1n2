import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { badRequest, parseBody, unauthorized } from '@/lib/api';
import { tagDB } from '@/lib/db';
import { colorSchema } from '@/lib/validation';

const DEFAULT_TAG_COLOR = '#3B82F6';

const tagCreateSchema = z.object({
  name: z.string().trim().min(1, 'Tag name is required').max(50, 'Tag name must be 50 characters or fewer'),
  color: colorSchema.optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  return NextResponse.json({ tags: tagDB.list(session.userId) });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const parsed = await parseBody(request, tagCreateSchema);
  if ('error' in parsed) return parsed.error;
  const { name, color } = parsed.data;

  if (tagDB.findByName(session.userId, name)) return badRequest('Tag name already exists');

  const tag = tagDB.create(session.userId, name, color ?? DEFAULT_TAG_COLOR);
  return NextResponse.json({ tag }, { status: 201 });
}
