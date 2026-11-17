import { describe, expect, it } from 'vitest';
import { parseSubtasksJson, toSubtasksJson } from '@/lib/template-utils';

describe('template subtasks JSON', () => {
  it('serializes titles with positions', () => {
    expect(JSON.parse(toSubtasksJson([{ title: ' A ' }, { title: 'B' }]) ?? '')).toEqual([
      { title: 'A', position: 0 }, { title: 'B', position: 1 },
    ]);
  });
  it('returns null for empty input', () => {
    expect(toSubtasksJson([])).toBeNull();
    expect(toSubtasksJson(undefined)).toBeNull();
  });
  it('round-trips and tolerates bad data', () => {
    expect(parseSubtasksJson(toSubtasksJson([{ title: 'x' }]))).toEqual([{ title: 'x', position: 0 }]);
    expect(parseSubtasksJson('not json')).toEqual([]);
    expect(parseSubtasksJson('[{"nope":1}]')).toEqual([]);
    expect(parseSubtasksJson(null)).toEqual([]);
  });
});
