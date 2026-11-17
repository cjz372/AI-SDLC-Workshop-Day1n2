import { expect, type Locator, type Page } from '@playwright/test';
import { addMinutes, formatSingaporeDate, getSingaporeNow } from '../lib/timezone';

/** Singapore local 'YYYY-MM-DDTHH:mm' for `minutes` from now. */
export const sgLocal = (minutes: number): string => formatSingaporeDate(addMinutes(getSingaporeNow(), minutes));

export interface NewTodo {
  title: string;
  priority?: 'high' | 'medium' | 'low';
  dueDate?: string;
  recurring?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  reminder?: string; // option label, e.g. '1 hour before'
  tags?: string[];
}

/** Attach a CDP virtual authenticator so passkey prompts succeed headlessly. */
export async function addVirtualAuthenticator(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true,
      isUserVerified: true, automaticPresenceSimulation: true,
    },
  });
}

export class TodoApp {
  constructor(readonly page: Page) {}

  static uniqueName(prefix = 'user'): string {
    return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  }

  async register(username = TodoApp.uniqueName()): Promise<string> {
    await this.page.goto('/login');
    await this.page.getByLabel('Username').fill(username);
    await this.page.getByRole('button', { name: 'Register' }).click();
    await expect(this.page).toHaveURL('/');
    return username;
  }

  async login(username: string): Promise<void> {
    await this.page.goto('/login');
    await this.page.getByLabel('Username').fill(username);
    await this.page.getByRole('button', { name: 'Login' }).click();
    await expect(this.page).toHaveURL('/');
  }

  async logout(): Promise<void> {
    await this.page.getByRole('button', { name: 'Logout' }).click();
    await expect(this.page).toHaveURL(/\/login/);
  }

  todo(title: string): Locator {
    return this.page.getByTestId('todo-item').filter({ hasText: title });
  }

  async createTodo(t: NewTodo): Promise<Locator> {
    const { page } = this;
    await page.getByLabel('Todo title').fill(t.title);
    if (t.priority) await page.getByLabel('Priority', { exact: true }).first().selectOption(t.priority);
    if (t.dueDate) await page.getByLabel('Due date').first().fill(t.dueDate);
    if (t.recurring) {
      await page.getByLabel('Repeat').first().check();
      await page.getByLabel('Recurrence pattern').first().selectOption(t.recurring);
    }
    if (t.reminder) await page.getByLabel('Reminder').first().selectOption({ label: t.reminder });
    for (const tag of t.tags ?? []) await page.getByRole('button', { name: tag, exact: true }).first().click();
    await page.getByRole('button', { name: 'Add', exact: true }).first().click();
    const item = this.todo(t.title).first();
    await expect(item).toBeVisible();
    return item;
  }

  async addSubtask(todoTitle: string, subtask: string): Promise<void> {
    const item = this.todo(todoTitle).first();
    if (!(await item.getByLabel('Add subtask').isVisible())) await item.getByRole('button', { name: /Subtasks/ }).click();
    await item.getByLabel('Add subtask').fill(subtask);
    await item.getByLabel('Add subtask').press('Enter');
    await expect(item.getByTestId('subtask').filter({ hasText: subtask })).toBeVisible();
  }

  async createTag(name: string, color = '#10B981'): Promise<void> {
    await this.page.getByRole('button', { name: '+ Manage Tags' }).click();
    const dialog = this.page.getByRole('dialog', { name: 'Manage Tags' });
    await dialog.getByLabel('Tag name').fill(name);
    await dialog.getByLabel('Tag color').fill(color);
    await dialog.getByRole('button', { name: 'Create Tag' }).click();
    await expect(dialog.getByTestId('tag-row').filter({ hasText: name })).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();
  }

  async createTemplate(todoTitle: string, name: string, category = ''): Promise<void> {
    await this.page.getByLabel('Todo title').fill(todoTitle);
    await this.page.getByRole('button', { name: '💾 Save as Template' }).click();
    const dialog = this.page.getByRole('dialog', { name: 'Save as Template' });
    await dialog.getByLabel('Template name').fill(name);
    if (category) await dialog.getByLabel('Template category').fill(category);
    await dialog.getByRole('button', { name: 'Save Template' }).click();
    await expect(dialog).toBeHidden();
    await this.page.getByLabel('Todo title').fill('');
  }
}
