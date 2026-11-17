import Database from 'better-sqlite3';
import path from 'node:path';
import { formatSingaporeTimestamp, getSingaporeNow } from '@/lib/timezone';

// ---------- Types (shared with API routes and client components via `import type`) ----------
export type Priority = 'high' | 'medium' | 'low';
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type ReminderMinutes = 15 | 30 | 60 | 120 | 1440 | 2880 | 10080; // 15m,30m,1h,2h,1d,2d,1w

export const PRIORITIES: readonly Priority[] = ['high', 'medium', 'low'];
export const RECURRENCE_PATTERNS: readonly RecurrencePattern[] = ['daily', 'weekly', 'monthly', 'yearly'];
export const REMINDER_OPTIONS: readonly ReminderMinutes[] = [15, 30, 60, 120, 1440, 2880, 10080];

export interface User { id: number; username: string; created_at: string; }
export interface Authenticator {
  id: number; user_id: number; credential_id: string; credential_public_key: Buffer; counter: number; created_at: string;
}
export interface Session { userId: number; username: string; }

export interface Todo {
  id: number; user_id: number; title: string; completed: boolean;
  due_date: string | null; priority: Priority;
  is_recurring: boolean; recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: number | null; last_notification_sent: string | null;
  created_at: string; updated_at: string | null;
  subtasks?: Subtask[]; tags?: Tag[];
}
export interface Subtask { id: number; todo_id: number; title: string; completed: boolean; position: number; created_at: string; }
export interface Tag { id: number; user_id: number; name: string; color: string; created_at: string; }
export interface Template {
  id: number; user_id: number; name: string; description: string | null; category: string | null;
  title_template: string; priority: Priority; is_recurring: boolean; recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: number | null; due_date_offset_minutes: number | null; subtasks_json: string | null; created_at: string;
}
export interface Holiday { id: number; date: string; name: string; }

export interface TodoInput {
  title: string; due_date?: string | null; priority?: Priority;
  is_recurring?: boolean; recurrence_pattern?: RecurrencePattern | null; reminder_minutes?: number | null;
}
export type TodoPatch = Partial<TodoInput> & { completed?: boolean; last_notification_sent?: string | null };
export interface TemplateInput {
  name: string; description?: string | null; category?: string | null; title_template: string; priority?: Priority;
  is_recurring?: boolean; recurrence_pattern?: RecurrencePattern | null; reminder_minutes?: number | null;
  due_date_offset_minutes?: number | null; subtasks_json?: string | null;
}
export interface ImportTodo extends TodoInput {
  completed?: boolean; created_at?: string;
  subtasks?: { title: string; completed?: boolean; position?: number }[];
  tags?: { name: string; color?: string }[];
}

// ---------- Connection + schema ----------
const dbPath = process.env.DB_PATH
  ?? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH || process.cwd(), 'todos.db');

const globalForDb = globalThis as unknown as { __todoDb?: Database.Database };
const db: Database.Database = globalForDb.__todoDb ?? new Database(dbPath);
globalForDb.__todoDb = db;

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS authenticators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT UNIQUE NOT NULL,
  credential_public_key BLOB NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_authenticators_user_id ON authenticators(user_id);
CREATE TABLE IF NOT EXISTS todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  due_date TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurrence_pattern TEXT,
  reminder_minutes INTEGER,
  last_notification_sent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
CREATE TABLE IF NOT EXISTS subtasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_subtasks_todo_id ON subtasks(todo_id);
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, name)
);
CREATE TABLE IF NOT EXISTS todo_tags (
  todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (todo_id, tag_id)
);
CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  title_template TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurrence_pattern TEXT,
  reminder_minutes INTEGER,
  due_date_offset_minutes INTEGER,
  subtasks_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS holidays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
`);

// ---------- Row mappers ----------
type Row = Record<string, unknown>;
const toTodo = (r: Row): Todo => ({
  ...(r as unknown as Todo),
  completed: Boolean(r.completed),
  is_recurring: Boolean(r.is_recurring),
  recurrence_pattern: (r.recurrence_pattern as RecurrencePattern | null) ?? null,
  reminder_minutes: (r.reminder_minutes as number | null) ?? null,
  due_date: (r.due_date as string | null) ?? null,
  last_notification_sent: (r.last_notification_sent as string | null) ?? null,
  updated_at: (r.updated_at as string | null) ?? null,
});
const toSubtask = (r: Row): Subtask => ({ ...(r as unknown as Subtask), completed: Boolean(r.completed) });
const toTemplate = (r: Row): Template => ({
  ...(r as unknown as Template),
  is_recurring: Boolean(r.is_recurring),
  recurrence_pattern: (r.recurrence_pattern as RecurrencePattern | null) ?? null,
  reminder_minutes: (r.reminder_minutes as number | null) ?? null,
  due_date_offset_minutes: (r.due_date_offset_minutes as number | null) ?? null,
  subtasks_json: (r.subtasks_json as string | null) ?? null,
  description: (r.description as string | null) ?? null,
  category: (r.category as string | null) ?? null,
});
const bool = (v: boolean | undefined): number => (v ? 1 : 0);

// ---------- Users & authenticators ----------
export const userDB = {
  create(username: string): User {
    const info = db.prepare('INSERT INTO users (username) VALUES (?)').run(username);
    return this.findById(Number(info.lastInsertRowid)) as User;
  },
  findById(id: number): User | undefined {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
  },
  findByUsername(username: string): User | undefined {
    return db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username) as User | undefined;
  },
};

export const authenticatorDB = {
  create(a: { user_id: number; credential_id: string; credential_public_key: Buffer; counter?: number }): void {
    db.prepare(
      'INSERT INTO authenticators (user_id, credential_id, credential_public_key, counter) VALUES (?, ?, ?, ?)',
    ).run(a.user_id, a.credential_id, a.credential_public_key, a.counter ?? 0);
  },
  findByCredentialId(credentialId: string): Authenticator | undefined {
    const r = db.prepare('SELECT * FROM authenticators WHERE credential_id = ?').get(credentialId) as Row | undefined;
    return r ? { ...(r as unknown as Authenticator), counter: (r.counter as number | undefined) ?? 0 } : undefined;
  },
  listByUser(userId: number): Authenticator[] {
    const rows = db.prepare('SELECT * FROM authenticators WHERE user_id = ?').all(userId) as Row[];
    return rows.map((r) => ({ ...(r as unknown as Authenticator), counter: (r.counter as number | undefined) ?? 0 }));
  },
  updateCounter(id: number, counter: number): void {
    db.prepare('UPDATE authenticators SET counter = ? WHERE id = ?').run(counter ?? 0, id);
  },
};

// ---------- Todos ----------
const TODO_PATCH_COLUMNS = [
  'title', 'completed', 'due_date', 'priority', 'is_recurring', 'recurrence_pattern',
  'reminder_minutes', 'last_notification_sent',
] as const;

export const todoDB = {
  create(userId: number, input: TodoInput, createdAt?: string, completed = false): Todo {
    const info = db.prepare(
      `INSERT INTO todos (user_id, title, completed, due_date, priority, is_recurring, recurrence_pattern, reminder_minutes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`,
    ).run(
      userId, input.title, bool(completed), input.due_date ?? null, input.priority ?? 'medium',
      bool(input.is_recurring), input.is_recurring ? input.recurrence_pattern ?? null : null,
      input.reminder_minutes ?? null, createdAt ?? null,
    );
    return this.findById(Number(info.lastInsertRowid), userId) as Todo;
  },

  findById(id: number, userId: number): Todo | undefined {
    const r = db.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?').get(id, userId) as Row | undefined;
    if (!r) return undefined;
    const todo = toTodo(r);
    return { ...todo, subtasks: subtaskDB.listByTodo(id), tags: tagDB.listForTodo(id) };
  },

  /** All todos for a user with subtasks and tags attached (3 queries total, no N+1). */
  list(userId: number): Todo[] {
    const todos = (db.prepare('SELECT * FROM todos WHERE user_id = ?').all(userId) as Row[]).map(toTodo);
    const subtasks = (db.prepare(
      `SELECT s.* FROM subtasks s JOIN todos t ON t.id = s.todo_id WHERE t.user_id = ? ORDER BY s.position, s.id`,
    ).all(userId) as Row[]).map(toSubtask);
    const tagRows = db.prepare(
      `SELECT tt.todo_id, tg.* FROM todo_tags tt JOIN tags tg ON tg.id = tt.tag_id
       JOIN todos t ON t.id = tt.todo_id WHERE t.user_id = ? ORDER BY tg.name`,
    ).all(userId) as Row[];
    const subsByTodo = new Map<number, Subtask[]>();
    for (const s of subtasks) subsByTodo.set(s.todo_id, [...(subsByTodo.get(s.todo_id) ?? []), s]);
    const tagsByTodo = new Map<number, Tag[]>();
    for (const { todo_id, ...tag } of tagRows) {
      const id = todo_id as number;
      tagsByTodo.set(id, [...(tagsByTodo.get(id) ?? []), tag as unknown as Tag]);
    }
    return todos.map((t) => ({ ...t, subtasks: subsByTodo.get(t.id) ?? [], tags: tagsByTodo.get(t.id) ?? [] }));
  },

  update(id: number, userId: number, patch: TodoPatch): Todo | undefined {
    const entries = TODO_PATCH_COLUMNS.filter((c) => c in patch && (patch as Row)[c] !== undefined);
    if (entries.length > 0) {
      const values = entries.map((c) => {
        const v = (patch as Row)[c];
        return typeof v === 'boolean' ? bool(v) : v ?? null;
      });
      const sets = entries.map((c) => `${c} = ?`).join(', ');
      db.prepare(`UPDATE todos SET ${sets}, updated_at = ? WHERE id = ? AND user_id = ?`)
        .run(...(values as (string | number | null)[]), formatSingaporeTimestamp(getSingaporeNow()), id, userId);
    }
    return this.findById(id, userId);
  },

  delete(id: number, userId: number): boolean {
    return db.prepare('DELETE FROM todos WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
  },

  /** Todos with a reminder and a due date that have not been completed. */
  withReminders(userId: number): Todo[] {
    const rows = db.prepare(
      'SELECT * FROM todos WHERE user_id = ? AND completed = 0 AND due_date IS NOT NULL AND reminder_minutes IS NOT NULL',
    ).all(userId) as Row[];
    return rows.map(toTodo);
  },
};

// ---------- Subtasks ----------
export const subtaskDB = {
  listByTodo(todoId: number): Subtask[] {
    return (db.prepare('SELECT * FROM subtasks WHERE todo_id = ? ORDER BY position, id').all(todoId) as Row[]).map(toSubtask);
  },
  create(todoId: number, title: string, completed = false, position?: number): Subtask {
    const next = position ?? ((db.prepare('SELECT MAX(position) AS m FROM subtasks WHERE todo_id = ?').get(todoId) as { m: number | null }).m ?? -1) + 1;
    const info = db.prepare('INSERT INTO subtasks (todo_id, title, completed, position) VALUES (?, ?, ?, ?)')
      .run(todoId, title, bool(completed), next);
    return toSubtask(db.prepare('SELECT * FROM subtasks WHERE id = ?').get(info.lastInsertRowid) as Row);
  },
  findOwned(id: number, userId: number): Subtask | undefined {
    const r = db.prepare(
      'SELECT s.* FROM subtasks s JOIN todos t ON t.id = s.todo_id WHERE s.id = ? AND t.user_id = ?',
    ).get(id, userId) as Row | undefined;
    return r ? toSubtask(r) : undefined;
  },
  update(id: number, patch: { title?: string; completed?: boolean }): void {
    if (patch.title !== undefined) db.prepare('UPDATE subtasks SET title = ? WHERE id = ?').run(patch.title, id);
    if (patch.completed !== undefined) db.prepare('UPDATE subtasks SET completed = ? WHERE id = ?').run(bool(patch.completed), id);
  },
  delete(id: number): void {
    db.prepare('DELETE FROM subtasks WHERE id = ?').run(id);
  },
};

// ---------- Tags ----------
export const tagDB = {
  list(userId: number): Tag[] {
    return db.prepare('SELECT * FROM tags WHERE user_id = ? ORDER BY name COLLATE NOCASE').all(userId) as Tag[];
  },
  listForTodo(todoId: number): Tag[] {
    return db.prepare(
      'SELECT tg.* FROM tags tg JOIN todo_tags tt ON tt.tag_id = tg.id WHERE tt.todo_id = ? ORDER BY tg.name',
    ).all(todoId) as Tag[];
  },
  findById(id: number, userId: number): Tag | undefined {
    return db.prepare('SELECT * FROM tags WHERE id = ? AND user_id = ?').get(id, userId) as Tag | undefined;
  },
  findByName(userId: number, name: string): Tag | undefined {
    return db.prepare('SELECT * FROM tags WHERE user_id = ? AND name = ? COLLATE NOCASE').get(userId, name) as Tag | undefined;
  },
  create(userId: number, name: string, color = '#3B82F6'): Tag {
    const info = db.prepare('INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)').run(userId, name, color);
    return db.prepare('SELECT * FROM tags WHERE id = ?').get(info.lastInsertRowid) as Tag;
  },
  update(id: number, userId: number, patch: { name?: string; color?: string }): Tag | undefined {
    const current = this.findById(id, userId);
    if (!current) return undefined;
    db.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ? AND user_id = ?')
      .run(patch.name ?? current.name, patch.color ?? current.color, id, userId);
    return this.findById(id, userId);
  },
  delete(id: number, userId: number): boolean {
    return db.prepare('DELETE FROM tags WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
  },
  attach(todoId: number, tagId: number): void {
    db.prepare('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)').run(todoId, tagId);
  },
  setForTodo(todoId: number, tagIds: number[]): void {
    const run = db.transaction((ids: number[]) => {
      db.prepare('DELETE FROM todo_tags WHERE todo_id = ?').run(todoId);
      for (const id of ids) db.prepare('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)').run(todoId, id);
    });
    run(tagIds);
  },
  detach(todoId: number, tagId: number): void {
    db.prepare('DELETE FROM todo_tags WHERE todo_id = ? AND tag_id = ?').run(todoId, tagId);
  },
};

// ---------- Templates ----------
export const templateDB = {
  list(userId: number): Template[] {
    return (db.prepare('SELECT * FROM templates WHERE user_id = ? ORDER BY name COLLATE NOCASE').all(userId) as Row[]).map(toTemplate);
  },
  findById(id: number, userId: number): Template | undefined {
    const r = db.prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?').get(id, userId) as Row | undefined;
    return r ? toTemplate(r) : undefined;
  },
  create(userId: number, t: TemplateInput): Template {
    const info = db.prepare(
      `INSERT INTO templates (user_id, name, description, category, title_template, priority, is_recurring,
        recurrence_pattern, reminder_minutes, due_date_offset_minutes, subtasks_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      userId, t.name, t.description ?? null, t.category ?? null, t.title_template, t.priority ?? 'medium',
      bool(t.is_recurring), t.is_recurring ? t.recurrence_pattern ?? null : null, t.reminder_minutes ?? null,
      t.due_date_offset_minutes ?? null, t.subtasks_json ?? null,
    );
    return this.findById(Number(info.lastInsertRowid), userId) as Template;
  },
  update(id: number, userId: number, t: Partial<TemplateInput>): Template | undefined {
    const cur = this.findById(id, userId);
    if (!cur) return undefined;
    const m = { ...cur, ...t };
    db.prepare(
      `UPDATE templates SET name = ?, description = ?, category = ?, title_template = ?, priority = ?, is_recurring = ?,
        recurrence_pattern = ?, reminder_minutes = ?, due_date_offset_minutes = ?, subtasks_json = ? WHERE id = ? AND user_id = ?`,
    ).run(
      m.name, m.description ?? null, m.category ?? null, m.title_template, m.priority, bool(m.is_recurring),
      m.is_recurring ? m.recurrence_pattern ?? null : null, m.reminder_minutes ?? null,
      m.due_date_offset_minutes ?? null, m.subtasks_json ?? null, id, userId,
    );
    return this.findById(id, userId);
  },
  delete(id: number, userId: number): boolean {
    return db.prepare('DELETE FROM templates WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
  },
};

// ---------- Holidays ----------
export const holidayDB = {
  list(): Holiday[] {
    return db.prepare('SELECT id, date, name FROM holidays ORDER BY date').all() as Holiday[];
  },
  upsert(date: string, name: string): void {
    db.prepare('INSERT INTO holidays (date, name) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET name = excluded.name').run(date, name);
  },
};

// ---------- Import (single transaction, new IDs throughout, tag reuse by case-insensitive name) ----------
export const importDB = {
  importTodos(userId: number, items: ImportTodo[]): number {
    const run = db.transaction((rows: ImportTodo[]) => {
      for (const item of rows) {
        const todo = todoDB.create(userId, item, item.created_at, item.completed ?? false);
        for (const s of item.subtasks ?? []) subtaskDB.create(todo.id, s.title, s.completed ?? false, s.position);
        for (const t of item.tags ?? []) {
          const tag = tagDB.findByName(userId, t.name) ?? tagDB.create(userId, t.name, t.color ?? '#3B82F6');
          tagDB.attach(todo.id, tag.id);
        }
      }
      return rows.length;
    });
    return run(items);
  },
};

export { db };
