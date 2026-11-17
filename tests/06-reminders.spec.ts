import { test, expect } from './fixtures';
import { sgLocal } from './helpers';

test.describe('Reminders', () => {
  test('shows the reminder badge for a todo with a 1 hour reminder', async ({ app }) => {
    const item = await app.createTodo({ title: 'Call bank', dueDate: sgLocal(120), reminder: '1 hour before' });
    await expect(item.getByTestId('reminder-badge')).toHaveText('🔔 1h');
  });

  test('disables the Reminder select until a due date is set', async ({ app, page }) => {
    await expect(page.getByLabel('Reminder').first()).toBeDisabled();
    await page.getByLabel('Due date').first().fill(sgLocal(120));
    await expect(page.getByLabel('Reminder').first()).toBeEnabled();
    await app.createTodo({ title: 'Other task' });
  });
});
