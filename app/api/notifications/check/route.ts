import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { unauthorized } from '@/lib/api';
import { todoDB } from '@/lib/db';
import { isReminderDue } from '@/lib/reminders';
import { formatSingaporeTimestamp, getSingaporeNow, nowSingaporeLocal } from '@/lib/timezone';

/** Returns todos whose reminder window has opened and marks them as notified (dedupe across tabs/polls). */
export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  const nowLocal = nowSingaporeLocal();
  const due = todoDB.withReminders(session.userId).filter((t) => isReminderDue(t, nowLocal));
  const stamp = formatSingaporeTimestamp(getSingaporeNow());
  for (const todo of due) todoDB.update(todo.id, session.userId, { last_notification_sent: stamp });
  return NextResponse.json({
    notifications: due.map((t) => ({ id: t.id, title: t.title, due_date: t.due_date, reminder_minutes: t.reminder_minutes })),
  });
}
