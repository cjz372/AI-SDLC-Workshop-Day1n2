import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';

export const unauthorized = () => NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
export const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 });
export const notFound = (what = 'Not found') => NextResponse.json({ error: what }, { status: 404 });

/** Parse + validate a JSON request body. Returns `{ data }` or `{ error: Response }`. */
export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<{ data: T } | { error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { error: badRequest('Invalid JSON body') };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return { error: badRequest(result.error.issues[0]?.message ?? 'Invalid request') };
  }
  return { data: result.data };
}

/** Parse a numeric route id; returns null when invalid. */
export function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}
