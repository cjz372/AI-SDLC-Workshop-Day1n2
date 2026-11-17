import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { badRequest, unauthorized } from '@/lib/api';
import { todoDB } from '@/lib/db';
import { buildCsv, buildExport } from '@/lib/export-format';
import { formatSingaporeDate, formatSingaporeDay, getSingaporeNow } from '@/lib/timezone';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const format = request.nextUrl.searchParams.get('format') ?? 'json';
  if (format !== 'json' && format !== 'csv') return badRequest('format must be json or csv');

  const now = getSingaporeNow();
  const todos = todoDB.list(session.userId).sort((a, b) => a.id - b.id);
  const filename = `todos-${formatSingaporeDay(now)}.${format}`;
  const headers = { 'Content-Disposition': `attachment; filename="${filename}"` };

  if (format === 'csv') {
    return new NextResponse(buildCsv(todos), { headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8' } });
  }
  return new NextResponse(JSON.stringify(buildExport(todos, formatSingaporeDate(now)), null, 2), {
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
