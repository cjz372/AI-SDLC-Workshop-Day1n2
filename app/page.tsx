'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Priority, RecurrencePattern, Subtask, Tag, Template, Todo } from '@/lib/db';
import { applyFilters, EMPTY_FILTERS, hasActiveFilters, loadPresets, savePresets, type FilterPreset, type FilterState } from '@/lib/filters';
import { useNotifications } from '@/lib/hooks/useNotifications';
import { nowSingaporeLocal, parseSingaporeLocal } from '@/lib/timezone';
import { describeDue, groupTodos, REMINDER_LABELS, REMINDER_LONG_LABELS, subtaskProgress, type DueUrgency } from '@/lib/todo-utils';

// ---------- helpers ----------
async function api<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Request failed');
  return data as T;
}
const send = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

const PRIORITY_STYLES: Record<Priority, string> = {
  high: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700',
  low: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700',
};
const URGENCY_STYLES: Record<DueUrgency, string> = {
  overdue: 'text-red-600 dark:text-red-400', imminent: 'text-red-600 dark:text-red-400',
  soon: 'text-orange-600 dark:text-orange-400', week: 'text-yellow-700 dark:text-yellow-400', later: 'text-blue-600 dark:text-blue-400',
};
const RECURRENCE_OPTIONS: RecurrencePattern[] = ['daily', 'weekly', 'monthly', 'yearly'];
const INPUT = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700';
const BTN = 'rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50';

interface FormState {
  title: string; priority: Priority; due_date: string; is_recurring: boolean;
  recurrence_pattern: RecurrencePattern; reminder_minutes: string; tag_ids: number[];
}
const EMPTY_FORM: FormState = { title: '', priority: 'medium', due_date: '', is_recurring: false, recurrence_pattern: 'daily', reminder_minutes: '', tag_ids: [] };

function formToBody(f: FormState) {
  return {
    title: f.title.trim(),
    priority: f.priority,
    due_date: f.due_date || null,
    is_recurring: f.is_recurring,
    recurrence_pattern: f.is_recurring ? f.recurrence_pattern : null,
    reminder_minutes: f.due_date && f.reminder_minutes ? Number(f.reminder_minutes) : null,
    tag_ids: f.tag_ids,
  };
}

// ---------- small components ----------
function PriorityBadge({ priority }: { priority: Priority }) {
  return <span data-testid="priority-badge" className={`rounded border px-2 py-0.5 text-xs font-semibold capitalize ${PRIORITY_STYLES[priority]}`}>{priority}</span>;
}

function TagPill({ tag, selected, onClick }: { tag: Tag; selected?: boolean; onClick?: () => void }) {
  const active = selected ?? true;
  const Cmp = onClick ? 'button' : 'span';
  return (
    <Cmp type={onClick ? 'button' : undefined} onClick={onClick} data-testid="tag-pill" aria-pressed={onClick ? active : undefined}
      style={active ? { backgroundColor: tag.color, borderColor: tag.color } : undefined}
      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${active ? 'text-white' : 'border-gray-300 bg-white text-gray-600 dark:border-gray-500 dark:bg-gray-700 dark:text-gray-300'}`}>
      {onClick && active ? '✓ ' : ''}{tag.name}
    </Cmp>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
        <h2 className="mb-4 text-xl font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function TodoFields({ form, setForm, tags }: { form: FormState; setForm: (f: FormState) => void; tags: Tag[] }) {
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm({ ...form, [key]: value });
  const toggleTag = (id: number) => set('tag_ids', form.tag_ids.includes(id) ? form.tag_ids.filter((t) => t !== id) : [...form.tag_ids, id]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input aria-label="Todo title" placeholder="What needs to be done?" value={form.title} onChange={(e) => set('title', e.target.value)} className={`${INPUT} min-w-48 flex-1`} />
        <select aria-label="Priority" value={form.priority} onChange={(e) => set('priority', e.target.value as Priority)} className={INPUT}>
          <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
        </select>
        <input aria-label="Due date" type="datetime-local" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} className={INPUT} />
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={form.is_recurring} onChange={(e) => set('is_recurring', e.target.checked)} /> Repeat
        </label>
        {form.is_recurring && (
          <select aria-label="Recurrence pattern" value={form.recurrence_pattern} onChange={(e) => set('recurrence_pattern', e.target.value as RecurrencePattern)} className={INPUT}>
            {RECURRENCE_OPTIONS.map((r) => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}
          </select>
        )}
        <select aria-label="Reminder" value={form.due_date ? form.reminder_minutes : ''} disabled={!form.due_date} onChange={(e) => set('reminder_minutes', e.target.value)} className={`${INPUT} disabled:opacity-50`}>
          <option value="">Reminder: None</option>
          {Object.entries(REMINDER_LONG_LABELS).map(([m, label]) => <option key={m} value={m}>{label}</option>)}
        </select>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Tags">
          {tags.map((t) => <TagPill key={t.id} tag={t} selected={form.tag_ids.includes(t.id)} onClick={() => toggleTag(t.id)} />)}
        </div>
      )}
    </div>
  );
}

function SubtaskPanel({ todo, onChanged, onError }: { todo: Todo; onChanged: () => Promise<void>; onError: (m: string) => void }) {
  const [title, setTitle] = useState('');
  const run = async (fn: () => Promise<unknown>) => {
    try { await fn(); await onChanged(); } catch (e) { onError(e instanceof Error ? e.message : 'Subtask update failed'); }
  };
  const add = () => {
    const t = title.trim();
    if (!t) return;
    setTitle('');
    void run(() => api(`/api/todos/${todo.id}/subtasks`, send('POST', { title: t })));
  };
  return (
    <div className="mt-3 space-y-2 border-t border-gray-200 pt-3 dark:border-gray-700">
      {(todo.subtasks ?? []).map((s: Subtask) => (
        <div key={s.id} data-testid="subtask" className="flex items-center gap-2 text-sm">
          <input type="checkbox" aria-label={`Complete subtask ${s.title}`} checked={s.completed}
            onChange={() => run(() => api(`/api/subtasks/${s.id}`, send('PUT', { completed: !s.completed })))} />
          <span className={`flex-1 ${s.completed ? 'text-gray-400 line-through' : ''}`}>{s.title}</span>
          <button aria-label={`Delete subtask ${s.title}`} onClick={() => run(() => api(`/api/subtasks/${s.id}`, send('DELETE')))} className="text-gray-400 hover:text-red-500">✕</button>
        </div>
      ))}
      <div className="flex gap-2">
        <input aria-label="Add subtask" placeholder="Add a subtask" value={title} onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()} className={`${INPUT} flex-1 py-1`} />
        <button onClick={add} className={`${BTN} bg-blue-600 py-1 hover:bg-blue-700`}>Add</button>
      </div>
    </div>
  );
}

interface TodoItemProps {
  todo: Todo; nowLocal: string; section: 'overdue' | 'pending' | 'completed';
  onToggle: (t: Todo) => void; onEdit: (t: Todo) => void; onDelete: (t: Todo) => void;
  onTagClick: (tagId: number) => void; onChanged: () => Promise<void>; onError: (m: string) => void;
}

function TodoItem({ todo, nowLocal, section, onToggle, onEdit, onDelete, onTagClick, onChanged, onError }: TodoItemProps) {
  const [open, setOpen] = useState(false);
  const progress = subtaskProgress(todo.subtasks);
  const due = todo.due_date ? describeDue(todo.due_date, nowLocal, parseSingaporeLocal) : null;
  return (
    <li data-testid="todo-item" data-section={section} className={`rounded-lg border p-4 shadow-sm ${section === 'overdue' ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'}`}>
      <div className="flex items-start gap-3">
        <input type="checkbox" aria-label={`Complete ${todo.title}`} checked={todo.completed} onChange={() => onToggle(todo)} className="mt-1.5 h-4 w-4" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`font-medium ${todo.completed ? 'text-gray-400 line-through' : ''}`}>{todo.title}</span>
            <PriorityBadge priority={todo.priority} />
            {todo.is_recurring && todo.recurrence_pattern && (
              <span data-testid="recurrence-badge" className="rounded border border-purple-300 bg-purple-100 px-2 py-0.5 text-xs text-purple-800 dark:border-purple-700 dark:bg-purple-900/40 dark:text-purple-300">🔄 {todo.recurrence_pattern}</span>
            )}
            {todo.reminder_minutes && (
              <span data-testid="reminder-badge" className="rounded border border-orange-300 bg-orange-100 px-2 py-0.5 text-xs text-orange-800 dark:border-orange-700 dark:bg-orange-900/40 dark:text-orange-300">🔔 {REMINDER_LABELS[todo.reminder_minutes] ?? `${todo.reminder_minutes}m`}</span>
            )}
            {(todo.tags ?? []).map((t) => <button key={t.id} onClick={() => onTagClick(t.id)} aria-label={`Filter by tag ${t.name}`}><TagPill tag={t} /></button>)}
          </div>
          {due && !todo.completed && <p data-testid="due-text" className={`mt-1 text-sm ${URGENCY_STYLES[due.urgency]}`}>{section === 'overdue' ? '⚠️ ' : ''}{due.text}</p>}
          {progress.total > 0 && (
            <div className="mt-2" data-testid="progress">
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div role="progressbar" aria-valuenow={progress.percent} style={{ width: `${progress.percent}%` }} className={`h-full ${progress.percent === 100 ? 'bg-green-500' : 'bg-blue-500'}`} />
              </div>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{progress.completed}/{progress.total} subtasks completed ({progress.percent}%)</p>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3 text-sm">
          <button onClick={() => setOpen(!open)} className="text-gray-600 dark:text-gray-300">{open ? '▼' : '▶'} Subtasks</button>
          <button onClick={() => onEdit(todo)} className="text-blue-600 dark:text-blue-400">Edit</button>
          <button onClick={() => onDelete(todo)} className="text-red-600 dark:text-red-400">Delete</button>
        </div>
      </div>
      {open && <SubtaskPanel todo={todo} onChanged={onChanged} onError={onError} />}
    </li>
  );
}

const PAGE_SIZE = 100;

function Section({ title, todos, tone, render }: { title: string; todos: Todo[]; tone: string; render: (t: Todo) => React.ReactNode }) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  if (todos.length === 0) return null;
  return (
    <section className="mb-6">
      <h2 className={`mb-2 text-lg font-semibold ${tone}`}>{title} ({todos.length})</h2>
      <ul className="space-y-2">{todos.slice(0, limit).map(render)}</ul>
      {todos.length > limit && (
        <button onClick={() => setLimit(limit + PAGE_SIZE)} className="mt-2 text-sm text-blue-600 dark:text-blue-400">Show more ({todos.length - limit} remaining)</button>
      )}
    </section>
  );
}

function TagManager({ tags, onClose, onChanged, onError }: { tags: Tag[]; onClose: () => void; onChanged: () => Promise<void>; onError: (m: string) => void }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [editing, setEditing] = useState<{ id: number; name: string; color: string } | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    try { await fn(); await onChanged(); } catch (e) { onError(e instanceof Error ? e.message : 'Tag update failed'); }
  };
  return (
    <Modal title="Manage Tags" onClose={onClose}>
      <div className="mb-4 flex gap-2">
        <input aria-label="Tag name" placeholder="Tag name" value={name} onChange={(e) => setName(e.target.value)} className={`${INPUT} flex-1`} />
        <input aria-label="Tag color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-12 rounded" />
        <button disabled={!name.trim()} onClick={() => run(async () => { await api('/api/tags', send('POST', { name: name.trim(), color })); setName(''); })} className={`${BTN} bg-blue-600`}>Create Tag</button>
      </div>
      <ul className="space-y-2">
        {tags.map((t) => (
          <li key={t.id} data-testid="tag-row" className="flex items-center gap-2">
            {editing?.id === t.id ? (
              <>
                <input aria-label="Edit tag name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={`${INPUT} flex-1`} />
                <input aria-label="Edit tag color" type="color" value={editing.color} onChange={(e) => setEditing({ ...editing, color: e.target.value })} className="h-10 w-12" />
                <button onClick={() => run(async () => { await api(`/api/tags/${t.id}`, send('PUT', { name: editing.name.trim(), color: editing.color })); setEditing(null); })} className={`${BTN} bg-blue-600`}>Update</button>
              </>
            ) : (
              <>
                <span className="flex-1"><TagPill tag={t} /></span>
                <button onClick={() => setEditing({ id: t.id, name: t.name, color: t.color })} className="text-sm text-blue-600">Edit</button>
                <button onClick={() => window.confirm(`Delete tag "${t.name}"?`) && run(() => api(`/api/tags/${t.id}`, send('DELETE')))} className="text-sm text-red-600">Delete</button>
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-4 text-right"><button onClick={onClose} className={`${BTN} bg-gray-500`}>Close</button></div>
    </Modal>
  );
}

function TemplateManager({ templates, onClose, onUse, onChanged, onError }: { templates: Template[]; onClose: () => void; onUse: (id: number) => Promise<void>; onChanged: () => Promise<void>; onError: (m: string) => void }) {
  const [category, setCategory] = useState('');
  const categories = useMemo(() => [...new Set(templates.map((t) => t.category).filter((c): c is string => !!c))].sort(), [templates]);
  const shown = category ? templates.filter((t) => t.category === category) : templates;
  return (
    <Modal title="Templates" onClose={onClose}>
      {categories.length > 0 && (
        <select aria-label="Template category" value={category} onChange={(e) => setCategory(e.target.value)} className={`${INPUT} mb-3`}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      )}
      {shown.length === 0 && <p className="text-sm text-gray-500">No templates yet.</p>}
      <ul className="space-y-3">
        {shown.map((t) => (
          <li key={t.id} data-testid="template-row" className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className="flex-1 font-semibold">{t.name}</span>
              <button onClick={() => onUse(t.id).then(onClose).catch((e) => onError(e.message))} className="text-sm text-blue-600">Use</button>
              <button onClick={async () => {
                if (!window.confirm(`Delete template "${t.name}"?`)) return;
                try { await api(`/api/templates/${t.id}`, send('DELETE')); await onChanged(); } catch (e) { onError(e instanceof Error ? e.message : 'Delete failed'); }
              }} className="text-sm text-red-600">Delete</button>
            </div>
            {t.description && <p className="text-sm text-gray-600 dark:text-gray-400">{t.description}</p>}
            <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
              {t.category && <span className="rounded bg-gray-200 px-2 py-0.5 dark:bg-gray-600">{t.category}</span>}
              <PriorityBadge priority={t.priority} />
              {t.is_recurring && <span className="rounded bg-purple-100 px-2 py-0.5 text-purple-800">🔄 {t.recurrence_pattern}</span>}
              {t.reminder_minutes && <span className="rounded bg-orange-100 px-2 py-0.5 text-orange-800">🔔 {REMINDER_LABELS[t.reminder_minutes]}</span>}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 text-right"><button onClick={onClose} className={`${BTN} bg-gray-500`}>Close</button></div>
    </Modal>
  );
}

export default function Home() {
  const router = useRouter();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [username, setUsername] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editing, setEditing] = useState<{ id: number; form: FormState } | null>(null);
  const [modal, setModal] = useState<'tags' | 'templates' | 'saveTemplate' | 'saveFilter' | null>(null);
  const [templateDraft, setTemplateDraft] = useState({ name: '', description: '', category: '' });
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [presetName, setPresetName] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [nowLocal, setNowLocal] = useState(nowSingaporeLocal);
  const importRef = useRef<HTMLInputElement>(null);
  const { permission, enable } = useNotifications();

  const load = useCallback(async () => {
    try {
      const [t, g, tp] = await Promise.all([
        api<{ todos: Todo[] }>('/api/todos'), api<{ tags: Tag[] }>('/api/tags'), api<{ templates: Template[] }>('/api/templates'),
      ]);
      setTodos(t.todos); setTags(g.tags); setTemplates(tp.templates);
    } catch (e) {
      if (e instanceof Error && e.message === 'Not authenticated') router.push('/login');
      else setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoaded(true);
    }
  }, [router]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      setPresets(loadPresets());
      return load();
    });
    void api<{ username: string }>('/api/auth/me').then((m) => setUsername(m.username)).catch(() => undefined);
  }, [load]);
  useEffect(() => {
    const timer = setInterval(() => setNowLocal(nowSingaporeLocal()), 30_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setFilters((f) => (f.search === searchInput ? f : { ...f, search: searchInput })), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const sections = useMemo(() => groupTodos(applyFilters(todos, filters), nowLocal), [todos, filters, nowLocal]);
  const visibleCount = sections.overdue.length + sections.pending.length + sections.completed.length;
  const fail = (e: unknown) => setError(e instanceof Error ? e.message : 'Something went wrong');
  const flash = (m: string) => { setNotice(m); setError(''); };

  async function addTodo(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api('/api/todos', send('POST', formToBody(form)));
      setForm(EMPTY_FORM);
      await load();
    } catch (err) { fail(err); } finally { setSubmitting(false); }
  }

  async function toggleTodo(t: Todo) {
    setTodos((prev) => prev.map((x) => (x.id === t.id ? { ...x, completed: !x.completed } : x)));
    try { await api(`/api/todos/${t.id}`, send('PUT', { completed: !t.completed })); } catch (err) { fail(err); }
    await load();
  }

  async function deleteTodo(t: Todo) {
    if (!window.confirm(`Delete "${t.title}"? This also removes its subtasks and tag links.`)) return;
    setTodos((prev) => prev.filter((x) => x.id !== t.id));
    try { await api(`/api/todos/${t.id}`, send('DELETE')); } catch (err) { fail(err); await load(); }
  }

  function openEdit(t: Todo) {
    setEditing({
      id: t.id,
      form: {
        title: t.title, priority: t.priority, due_date: t.due_date ?? '', is_recurring: t.is_recurring,
        recurrence_pattern: t.recurrence_pattern ?? 'daily', reminder_minutes: t.reminder_minutes ? String(t.reminder_minutes) : '',
        tag_ids: (t.tags ?? []).map((g) => g.id),
      },
    });
  }

  async function saveEdit() {
    if (!editing) return;
    try {
      await api(`/api/todos/${editing.id}`, send('PUT', formToBody(editing.form)));
      setEditing(null);
      await load();
    } catch (err) { fail(err); }
  }

  async function saveTemplate() {
    try {
      await api('/api/templates', send('POST', {
        name: templateDraft.name.trim(), description: templateDraft.description.trim() || null, category: templateDraft.category.trim() || null,
        title_template: form.title.trim(), priority: form.priority, is_recurring: form.is_recurring,
        recurrence_pattern: form.is_recurring ? form.recurrence_pattern : null,
        reminder_minutes: form.reminder_minutes ? Number(form.reminder_minutes) : null,
        subtasks: [],
      }));
      setModal(null); setTemplateDraft({ name: '', description: '', category: '' });
      flash('Template saved');
      await load();
    } catch (err) { fail(err); }
  }

  async function createFromTemplate(id: number) {
    await api(`/api/templates/${id}/use`, send('POST'));
    await load();
  }

  async function importFile(file: File) {
    try {
      const payload = JSON.parse(await file.text());
      const res = await api<{ imported: number }>('/api/todos/import', send('POST', payload));
      flash(`Successfully imported ${res.imported} todos`);
      await load();
    } catch (err) {
      setError(err instanceof SyntaxError ? 'Invalid JSON format' : err instanceof Error ? err.message : 'Failed to import todos');
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  }

  async function logout() {
    await api('/api/auth/logout', send('POST')).catch(() => undefined);
    router.push('/login');
    router.refresh();
  }

  function savePreset() {
    const name = presetName.trim();
    if (!name) return;
    const next = [...presets, { id: crypto.randomUUID(), name, filters, createdAt: new Date().toISOString() }];
    setPresets(next); savePresets(next); setPresetName(''); setModal(null);
  }
  const removePreset = (id: string) => { const next = presets.filter((p) => p.id !== id); setPresets(next); savePresets(next); };
  const applyPreset = (p: FilterPreset) => { setFilters(p.filters); setSearchInput(p.filters.search); };
  const clearFilters = () => { setFilters(EMPTY_FILTERS); setSearchInput(''); };
  const setFilter = <K extends keyof FilterState>(k: K, v: FilterState[K]) => setFilters((f) => ({ ...f, [k]: v }));

  const itemProps = { nowLocal, onToggle: toggleTodo, onEdit: openEdit, onDelete: deleteTodo, onTagClick: (id: number) => setFilter('tagId', id), onChanged: load, onError: setError };
  const active = hasActiveFilters(filters);

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Todo App</h1>
        <nav className="flex flex-wrap items-center gap-2">
          {permission !== 'unsupported' && (
            <button onClick={enable} disabled={permission === 'granted'} className={`${BTN} ${permission === 'granted' ? 'bg-green-600' : 'bg-orange-500'}`}>
              {permission === 'granted' ? '🔔 Notifications On' : '🔔 Enable Notifications'}
            </button>
          )}
          <button onClick={() => setModal('templates')} className={`${BTN} bg-indigo-600`}>📋 Templates</button>
          <a href="/api/todos/export?format=json" download className={`${BTN} bg-green-600`}>Export JSON</a>
          <a href="/api/todos/export?format=csv" download className={`${BTN} bg-emerald-800`}>Export CSV</a>
          <button onClick={() => importRef.current?.click()} className={`${BTN} bg-blue-600`}>Import</button>
          <input ref={importRef} type="file" accept="application/json,.json" aria-label="Import file" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
          <Link href="/calendar" className={`${BTN} bg-purple-600`}>Calendar</Link>
          <span className="text-sm text-gray-600 dark:text-gray-300">{username}</span>
          <button onClick={logout} className={`${BTN} bg-gray-600`}>Logout</button>
        </nav>
      </header>

      {error && <p role="alert" data-testid="error-message" className="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-800 dark:bg-red-900/40 dark:text-red-200">{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-lg bg-green-100 p-3 text-sm text-green-800 dark:bg-green-900/40 dark:text-green-200">{notice}</p>}

      <form onSubmit={addTodo} className="mb-6 rounded-xl bg-white p-4 shadow dark:bg-gray-800">
        <TodoFields form={form} setForm={setForm} tags={tags} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="submit" disabled={!form.title.trim() || submitting} className={`${BTN} bg-blue-600 hover:bg-blue-700`}>{submitting ? 'Adding…' : 'Add'}</button>
          {form.title.trim() && <button type="button" onClick={() => setModal('saveTemplate')} className={`${BTN} bg-indigo-500`}>💾 Save as Template</button>}
          <button type="button" onClick={() => setModal('tags')} className={`${BTN} bg-gray-600`}>+ Manage Tags</button>
          {templates.length > 0 && (
            <select aria-label="Use Template" value="" onChange={(e) => e.target.value && createFromTemplate(Number(e.target.value)).catch(fail)} className={INPUT}>
              <option value="">Use Template…</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.category ? ` (${t.category})` : ''}</option>)}
            </select>
          )}
        </div>
      </form>

      <div className="mb-6 space-y-3 rounded-xl bg-white p-4 shadow dark:bg-gray-800">
        <div className="relative">
          <input aria-label="Search todos" placeholder="🔍 Search todos, subtasks and tags..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className={`${INPUT} w-full`} />
          {searchInput && <button aria-label="Clear search" onClick={() => setSearchInput('')} className="absolute right-3 top-2 text-gray-400">✕</button>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Filter by priority" value={filters.priority} onChange={(e) => setFilter('priority', e.target.value as FilterState['priority'])} className={INPUT}>
            <option value="all">All Priorities</option><option value="high">High Priority</option><option value="medium">Medium Priority</option><option value="low">Low Priority</option>
          </select>
          {tags.length > 0 && (
            <select aria-label="Filter by tag" value={filters.tagId ?? ''} onChange={(e) => setFilter('tagId', e.target.value ? Number(e.target.value) : null)} className={INPUT}>
              <option value="">All Tags</option>
              {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          <button onClick={() => setShowAdvanced(!showAdvanced)} className={`${BTN} ${showAdvanced ? 'bg-blue-600' : 'bg-gray-500'}`}>{showAdvanced ? '▼' : '▶'} Advanced</button>
          {active && <button onClick={clearFilters} className={`${BTN} bg-red-600`}>Clear All</button>}
          {active && <button onClick={() => setModal('saveFilter')} className={`${BTN} bg-green-600`}>💾 Save Filter</button>}
        </div>
        {showAdvanced && (
          <div className="grid gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50 sm:grid-cols-3">
            <select aria-label="Completion status" value={filters.completion} onChange={(e) => setFilter('completion', e.target.value as FilterState['completion'])} className={INPUT}>
              <option value="all">All Todos</option><option value="incomplete">Incomplete Only</option><option value="completed">Completed Only</option>
            </select>
            <label className="text-xs">Due Date From<input aria-label="Due date from" type="date" value={filters.dueDateFrom} onChange={(e) => setFilter('dueDateFrom', e.target.value)} className={`${INPUT} w-full`} /></label>
            <label className="text-xs">Due Date To<input aria-label="Due date to" type="date" value={filters.dueDateTo} onChange={(e) => setFilter('dueDateTo', e.target.value)} className={`${INPUT} w-full`} /></label>
            {presets.length > 0 && (
              <div className="flex flex-wrap gap-2 sm:col-span-3" aria-label="Saved Filter Presets">
                {presets.map((p) => (
                  <span key={p.id} className="flex items-center gap-1 rounded-full border border-gray-300 px-3 py-1 text-sm dark:border-gray-500">
                    <button onClick={() => applyPreset(p)}>{p.name}</button>
                    <button aria-label={`Delete preset ${p.name}`} onClick={() => removePreset(p.id)} className="text-gray-400">✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {active && (
        <div data-testid="filter-summary" className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <span>Showing {visibleCount} of {todos.length} todos</span>
          {filters.tagId !== null && (
            <span data-testid="tag-filter-indicator" className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-0.5 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
              Tag: {tags.find((t) => t.id === filters.tagId)?.name}
              <button aria-label="Clear tag filter" onClick={() => setFilter('tagId', null)}>✕</button>
            </span>
          )}
        </div>
      )}
      {!loaded && <p role="status">Loading…</p>}
      {loaded && visibleCount === 0 && <p data-testid="empty-state" className="py-8 text-center text-gray-500">{active ? 'No results match your filters.' : 'No todos yet. Add one above!'}</p>}
      <Section title="Overdue" todos={sections.overdue} tone="text-red-600 dark:text-red-400" render={(t) => <TodoItem key={t.id} todo={t} section="overdue" {...itemProps} />} />
      <Section title="Pending" todos={sections.pending} tone="" render={(t) => <TodoItem key={t.id} todo={t} section="pending" {...itemProps} />} />
      <Section title="Completed" todos={sections.completed} tone="text-gray-500" render={(t) => <TodoItem key={t.id} todo={t} section="completed" {...itemProps} />} />

      {editing && (
        <Modal title="Edit Todo" onClose={() => setEditing(null)}>
          <TodoFields form={editing.form} setForm={(f) => setEditing({ ...editing, form: f })} tags={tags} />
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setEditing(null)} className={`${BTN} bg-gray-500`}>Cancel</button>
            <button onClick={saveEdit} disabled={!editing.form.title.trim()} className={`${BTN} bg-blue-600`}>Update</button>
          </div>
        </Modal>
      )}
      {modal === 'tags' && <TagManager tags={tags} onClose={() => setModal(null)} onChanged={load} onError={setError} />}
      {modal === 'templates' && <TemplateManager templates={templates} onClose={() => setModal(null)} onUse={createFromTemplate} onChanged={load} onError={setError} />}
      {modal === 'saveTemplate' && (
        <Modal title="Save as Template" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <input aria-label="Template name" placeholder="Template name (required)" value={templateDraft.name} onChange={(e) => setTemplateDraft({ ...templateDraft, name: e.target.value })} className={`${INPUT} w-full`} />
            <input aria-label="Template description" placeholder="Description (optional)" value={templateDraft.description} onChange={(e) => setTemplateDraft({ ...templateDraft, description: e.target.value })} className={`${INPUT} w-full`} />
            <input aria-label="Template category" placeholder="Category (optional)" value={templateDraft.category} onChange={(e) => setTemplateDraft({ ...templateDraft, category: e.target.value })} className={`${INPUT} w-full`} />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setModal(null)} className={`${BTN} bg-gray-500`}>Cancel</button>
            <button onClick={saveTemplate} disabled={!templateDraft.name.trim()} className={`${BTN} bg-indigo-600`}>Save Template</button>
          </div>
        </Modal>
      )}
      {modal === 'saveFilter' && (
        <Modal title="Save Filter" onClose={() => setModal(null)}>
          <input aria-label="Preset name" placeholder="Preset name" value={presetName} onChange={(e) => setPresetName(e.target.value)} className={`${INPUT} w-full`} />
          <ul className="mt-3 text-sm text-gray-600 dark:text-gray-300">
            {filters.search && <li>• Search: “{filters.search}”</li>}
            {filters.priority !== 'all' && <li>• Priority: {filters.priority}</li>}
            {filters.tagId !== null && <li>• Tag: {tags.find((t) => t.id === filters.tagId)?.name}</li>}
            {filters.completion !== 'all' && <li>• Completion: {filters.completion}</li>}
            {(filters.dueDateFrom || filters.dueDateTo) && <li>• Date Range: {filters.dueDateFrom || '…'} to {filters.dueDateTo || '…'}</li>}
          </ul>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setModal(null)} className={`${BTN} bg-gray-500`}>Cancel</button>
            <button onClick={savePreset} disabled={!presetName.trim()} className={`${BTN} bg-green-600`}>Save</button>
          </div>
        </Modal>
      )}
    </main>
  );
}
