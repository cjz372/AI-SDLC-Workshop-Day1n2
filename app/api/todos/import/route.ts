import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { parseBody, unauthorized } from '@/lib/api';
import { importDB, type ImportTodo } from '@/lib/db';
import { importSchema } from '@/lib/import-schema';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const parsed = await parseBody(request, importSchema);
  if ('error' in parsed) return parsed.error;

  try {
    const imported = importDB.importTodos(session.userId, parsed.data.todos as ImportTodo[]);
    return NextResponse.json({ imported });
  } catch (error) {
    console.error('Import failed:', error);
    return NextResponse.json({ error: 'Failed to import todos' }, { status: 500 });
  }
}
