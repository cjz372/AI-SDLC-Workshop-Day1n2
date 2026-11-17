import type { Priority, Todo } from '@/lib/db';

export interface FilterState {
  search: string;
  priority: 'all' | Priority;
  tagId: number | null;
  completion: 'all' | 'incomplete' | 'completed';
  dueDateFrom: string; // YYYY-MM-DD or ''
  dueDateTo: string; // YYYY-MM-DD or ''
}

export const EMPTY_FILTERS: FilterState = { search: '', priority: 'all', tagId: null, completion: 'all', dueDateFrom: '', dueDateTo: '' };

export interface FilterPreset { id: string; name: string; filters: FilterState; createdAt: string; }
export const PRESETS_STORAGE_KEY = 'todo-app:filter-presets';

export function hasActiveFilters(f: FilterState): boolean {
  return f.search.trim() !== '' || f.priority !== 'all' || f.tagId !== null || f.completion !== 'all' || f.dueDateFrom !== '' || f.dueDateTo !== '';
}

/** Pure AND filter. Search matches title, subtask titles and tag names. Order is fixed: search → priority → tag → completion → date range. */
export function applyFilters(todos: readonly Todo[], f: FilterState): Todo[] {
  const needle = f.search.trim().toLowerCase();
  return todos
    .filter((t) => needle === '' || t.title.toLowerCase().includes(needle) || (t.subtasks ?? []).some((s) => s.title.toLowerCase().includes(needle)) || (t.tags ?? []).some((g) => g.name.toLowerCase().includes(needle)))
    .filter((t) => f.priority === 'all' || t.priority === f.priority)
    .filter((t) => f.tagId === null || (t.tags ?? []).some((g) => g.id === f.tagId))
    .filter((t) => f.completion === 'all' || (f.completion === 'completed') === t.completed)
    .filter((t) => {
      if (f.dueDateFrom === '' && f.dueDateTo === '') return true;
      if (!t.due_date) return false;
      const day = t.due_date.slice(0, 10);
      return (f.dueDateFrom === '' || day >= f.dueDateFrom) && (f.dueDateTo === '' || day <= f.dueDateTo);
    });
}

export function loadPresets(): FilterPreset[] {
  try {
    const raw = window.localStorage.getItem(PRESETS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as FilterPreset[]).filter((p) => p && typeof p.name === 'string' && p.filters) : [];
  } catch {
    return [];
  }
}

export function savePresets(presets: readonly FilterPreset[]): void {
  window.localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
}
