'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Holiday, Priority, Todo } from '@/lib/db';
import { formatMonthParam, generateCalendarGrid, parseMonthParam, shiftMonth } from '@/lib/calendar';
import { formatSingaporeDay, getSingaporeNow } from '@/lib/timezone';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_VISIBLE = 3;
const DOT: Record<Priority, string> = {
  high: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
};
const NAV_BTN = 'rounded-lg bg-gray-600 px-3 py-2 text-sm font-medium text-white';

function CalendarView() {
  const router = useRouter();
  const search = useSearchParams();
  const today = formatSingaporeDay(getSingaporeNow());
  const { year, month } = parseMonthParam(search.get('month'), today.slice(0, 7));
  const [todos, setTodos] = useState<Todo[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([fetch('/api/todos'), fetch('/api/holidays')]).then(async ([t, h]) => {
      if (t.status === 401) return router.push('/login');
      if (t.ok) setTodos(((await t.json()) as { todos: Todo[] }).todos);
      if (h.ok) setHolidays(((await h.json()) as { holidays: Holiday[] }).holidays);
    });
  }, [router]);

  const grid = useMemo(() => generateCalendarGrid(year, month, today), [year, month, today]);
  const todosByDay = useMemo(() => {
    const map = new Map<string, Todo[]>();
    for (const t of todos) {
      if (!t.due_date) continue;
      const day = t.due_date.slice(0, 10);
      map.set(day, [...(map.get(day) ?? []), t]);
    }
    return map;
  }, [todos]);
  const holidayByDay = useMemo(() => new Map(holidays.map((h) => [h.date, h.name])), [holidays]);

  const go = (y: number, m: number) => router.push(`/calendar?month=${formatMonthParam(y, m)}`);
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const selectedTodos = selected ? todosByDay.get(selected) ?? [] : [];

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Calendar</h1>
        <Link href="/" className={`${NAV_BTN} bg-blue-600`}>← Back to list</Link>
      </header>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-2">
          <button aria-label="Previous month" onClick={() => go(prev.year, prev.month)} className={NAV_BTN}>◀</button>
          <button onClick={() => go(Number(today.slice(0, 4)), Number(today.slice(5, 7)))} className={NAV_BTN}>Today</button>
          <button aria-label="Next month" onClick={() => go(next.year, next.month)} className={NAV_BTN}>▶</button>
        </div>
        <h2 data-testid="month-title" className="text-xl font-semibold">{MONTHS[month - 1]} {year}</h2>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-gray-300 dark:bg-gray-700">
        {WEEKDAYS.map((d) => <div key={d} className="bg-gray-100 p-2 text-center text-sm font-semibold dark:bg-gray-800">{d}</div>)}
        {grid.flat().map((day) => {
          const items = todosByDay.get(day.date) ?? [];
          const holiday = holidayByDay.get(day.date);
          return (
            <button key={day.date} data-testid="calendar-day" data-date={day.date} data-today={day.isToday} onClick={() => setSelected(day.date)}
              className={`min-h-24 bg-white p-1.5 text-left align-top dark:bg-gray-900 ${day.inMonth ? '' : 'opacity-40'} ${day.isWeekend ? 'bg-gray-50 dark:bg-gray-800' : ''} ${day.isPast ? 'text-gray-500' : ''}`}>
              <span className={`inline-block h-6 w-6 rounded-full text-center text-sm leading-6 ${day.isToday ? 'bg-blue-600 font-bold text-white' : ''}`}>{day.day}</span>
              {holiday && <span data-testid="holiday-name" className="block truncate text-xs font-medium text-red-600 dark:text-red-400">{holiday}</span>}
              {items.slice(0, MAX_VISIBLE).map((t) => (
                <span key={t.id} data-testid="calendar-todo" className={`mt-0.5 block truncate rounded px-1 text-xs ${DOT[t.priority]} ${t.completed ? 'line-through' : ''}`}>{t.title}</span>
              ))}
              {items.length > MAX_VISIBLE && <span data-testid="calendar-more" className="mt-0.5 block text-xs text-gray-500">+{items.length - MAX_VISIBLE} more</span>}
            </button>
          );
        })}
      </div>
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelected(null)}>
          <div role="dialog" aria-label={`Todos for ${selected}`} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
            <h2 className="mb-1 text-xl font-bold">{selected}</h2>
            {holidayByDay.get(selected) && <p className="mb-2 text-sm text-red-600">{holidayByDay.get(selected)}</p>}
            {selectedTodos.length === 0 ? <p className="text-sm text-gray-500">No todos due this day.</p> : (
              <ul className="space-y-2">
                {selectedTodos.map((t) => (
                  <li key={t.id} data-testid="day-todo" className={`rounded px-2 py-1 text-sm ${DOT[t.priority]}`}>
                    {t.title} <span className="opacity-70">({t.due_date?.slice(11)})</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 text-right"><button onClick={() => setSelected(null)} className={`${NAV_BTN} bg-gray-500`}>Close</button></div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function CalendarPage() {
  return <Suspense fallback={<p className="p-8">Loading…</p>}><CalendarView /></Suspense>;
}
