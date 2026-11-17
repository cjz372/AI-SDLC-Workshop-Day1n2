import { z } from 'zod';

export interface TemplateSubtask { title: string; position: number; }

const storedSchema = z.array(z.object({ title: z.string().min(1), position: z.number().int().optional() }));

/** Serialize subtasks to the stored JSON shape `[{ title, position }]`, or null when there are none. */
export function toSubtasksJson(subtasks: readonly { title: string }[] | undefined): string | null {
  if (!subtasks || subtasks.length === 0) return null;
  return JSON.stringify(subtasks.map((s, i) => ({ title: s.title.trim(), position: i })));
}

/** Parse stored subtasks JSON; malformed or missing data yields an empty list. */
export function parseSubtasksJson(json: string | null): TemplateSubtask[] {
  if (!json) return [];
  try {
    const parsed = storedSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data.map((s, i) => ({ title: s.title, position: s.position ?? i })) : [];
  } catch {
    return [];
  }
}
