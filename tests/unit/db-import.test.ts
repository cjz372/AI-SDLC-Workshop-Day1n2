import { describe, expect, it } from 'vitest';
import { importDB, tagDB, templateDB, todoDB, userDB } from '@/lib/db';

let seq = 0;
const newUser = () => userDB.create(`import-user-${++seq}-${Date.now()}`);

describe('templateDB', () => {
  it('creates, lists and deletes templates', () => {
    const u = newUser();
    const tpl = templateDB.create(u.id, {
      name: 'Weekly review', title_template: 'Review', priority: 'low',
      subtasks_json: JSON.stringify([{ title: 'Inbox', position: 0 }]),
    });
    expect(templateDB.list(u.id).map((t) => t.name)).toEqual(['Weekly review']);
    expect(templateDB.findById(tpl.id, u.id)?.subtasks_json).toContain('Inbox');
    expect(templateDB.delete(tpl.id, u.id)).toBe(true);
    expect(templateDB.list(u.id)).toEqual([]);
  });
});

describe('importDB.importTodos', () => {
  it('assigns new ids and reuses an existing tag by case-insensitive name', () => {
    const u = newUser();
    const existing = tagDB.create(u.id, 'Errands');
    const count = importDB.importTodos(u.id, [
      { title: 'Pick up parcel', tags: [{ name: 'errands' }], subtasks: [{ title: 'Bring ID' }] },
    ]);
    expect(count).toBe(1);
    const [todo] = todoDB.list(u.id);
    expect(todo.title).toBe('Pick up parcel');
    expect(todo.tags?.map((t) => t.id)).toEqual([existing.id]);
    expect(tagDB.list(u.id)).toHaveLength(1);
  });

  it('is transactional: an invalid row inserts nothing', () => {
    const u = newUser();
    expect(() => importDB.importTodos(u.id, [
      { title: 'Valid first' },
      { title: null } as never,
    ])).toThrow();
    expect(todoDB.list(u.id)).toEqual([]);
  });
});
