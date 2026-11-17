import { test, expect } from './fixtures';
import { sgLocal } from './helpers';
import { calculateNextDueDate } from '../lib/recurrence';

test.describe('Recurring todos', () => {
  test('completing a daily todo creates the next instance one day later', async ({ app, page }) => {
    const due = sgLocal(60);
    const next = calculateNextDueDate(due, 'daily');
    const item = await app.createTodo({ title: 'Standup', dueDate: due, recurring: 'daily' });
    await expect(item.getByTestId('recurrence-badge')).toHaveText('🔄 daily');

    await page.getByRole('checkbox', { name: 'Complete Standup' }).click();
    const pending = page.locator('[data-testid="todo-item"][data-section="pending"]').filter({ hasText: 'Standup' });
    await expect(pending).toHaveCount(1);
    await expect(pending.getByTestId('due-text')).toContainText(next.replace('T', ' '));
  });

  test('rejects a recurring todo without a due date', async ({ app, page }) => {
    await page.getByLabel('Todo title').fill('Floating repeat');
    await page.getByLabel('Repeat').first().check();
    await page.getByRole('button', { name: 'Add', exact: true }).first().click();
    await expect(page.getByTestId('error-message')).toContainText('Recurring todos require a due date');
  });
});
