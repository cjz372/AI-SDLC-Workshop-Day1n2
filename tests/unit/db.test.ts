import { describe, expect, it } from 'vitest';
import { db, holidayDB, subtaskDB, tagDB, todoDB, userDB } from '@/lib/db';

let seq = 0;
const newUser = () => userDB.create(`db-user-${++seq}-${Date.now()}`);

describe('todoDB', () => {
  it('creates a todo and reads it back', () => {
    const u = newUser();
    const t = todoDB.create(u.id, { title: 'Buy milk', priority: 'high', due_date: '2026-01-02T09:00' });
    expect(todoDB.findById(t.id, u.id)).toMatchObject({ title: 'Buy milk', priority: 'high', completed: false, due_date: '2026-01-02T09:00', subtasks: [], tags: [] });
  });

  it('updates fields and stamps updated_at', () => {
    const u = newUser();
    const t = todoDB.create(u.id, { title: 'Old' });
    const updated = todoDB.update(t.id, u.id, { title: 'New', completed: true });
    expect(updated).toMatchObject({ title: 'New', completed: true });
    expect(updated?.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });

  it('does not expose another user todos', () => {
    const a = newUser();
    const b = newUser();
    const t = todoDB.create(a.id, { title: 'Private' });
    expect(todoDB.findById(t.id, b.id)).toBeUndefined();
    expect(todoDB.delete(t.id, b.id)).toBe(false);
  });

  it('delete cascades to subtasks and todo_tags', () => {
    const u = newUser();
    const t = todoDB.create(u.id, { title: 'Parent' });
    subtaskDB.create(t.id, 'child');
    const tag = tagDB.create(u.id, `cascade-${seq}`);
    tagDB.attach(t.id, tag.id);
    expect(todoDB.delete(t.id, u.id)).toBe(true);
    const subs = db.prepare('SELECT COUNT(*) AS c FROM subtasks WHERE todo_id = ?').get(t.id) as { c: number };
    const links = db.prepare('SELECT COUNT(*) AS c FROM todo_tags WHERE todo_id = ?').get(t.id) as { c: number };
    expect(subs.c).toBe(0);
    expect(links.c).toBe(0);
  });
});

describe('subtaskDB and tagDB', () => {
  it('assigns subtask position as max + 1', () => {
    const t = todoDB.create(newUser().id, { title: 'With subtasks' });
    expect(subtaskDB.create(t.id, 'a').position).toBe(0);
    expect(subtaskDB.create(t.id, 'b').position).toBe(1);
    expect(subtaskDB.create(t.id, 'c').position).toBe(2);
  });

  it('finds tags by name case-insensitively and rejects exact duplicates per user', () => {
    const u = newUser();
    const tag = tagDB.create(u.id, 'Work');
    expect(tagDB.findByName(u.id, 'WORK')?.id).toBe(tag.id);
    expect(() => tagDB.create(u.id, 'Work')).toThrow();
    expect(tagDB.findByName(newUser().id, 'Work')).toBeUndefined();
  });
});

describe('holidayDB', () => {
  it('upserts by date', () => {
    holidayDB.upsert('2099-01-01', 'Old name');
    holidayDB.upsert('2099-01-01', 'New Year');
    const rows = holidayDB.list().filter((h) => h.date === '2099-01-01');
    expect(rows).toEqual([expect.objectContaining({ name: 'New Year' })]);
  });
});
