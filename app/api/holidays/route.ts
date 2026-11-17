import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { unauthorized } from '@/lib/api';
import { holidayDB } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  return NextResponse.json({ holidays: holidayDB.list() });
}
