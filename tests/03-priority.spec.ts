import { test, expect } from './fixtures';

test.describe('Priority', () => {
  test('shows the priority badge with a colour class matching the level', async ({ app }) => {
    const item = await app.createTodo({ title: 'Urgent task', priority: 'high' });
    const badge = item.getByTestId('priority-badge');
    await expect(badge).toHaveText('high');
    await expect(badge).toHaveClass(/bg-red-100/);
  });

  test('lists pending todos ordered high, medium, low', async ({ app, page }) => {
    await app.createTodo({ title: 'Low task', priority: 'low' });
    await app.createTodo({ title: 'High task', priority: 'high' });
    await app.createTodo({ title: 'Medium task', priority: 'medium' });
    const pending = page.locator('[data-testid="todo-item"][data-section="pending"]');
    await expect(pending).toHaveCount(3);
    await expect(pending.nth(0)).toContainText('High task');
    await expect(pending.nth(1)).toContainText('Medium task');
    await expect(pending.nth(2)).toContainText('Low task');
  });
});
