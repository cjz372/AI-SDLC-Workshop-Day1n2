import { test, expect } from './fixtures';
import { sgLocal } from './helpers';

test.describe('Due dates', () => {
  test('shows a relative "Due in" message for a todo due soon', async ({ app }) => {
    const item = await app.createTodo({ title: 'Soon task', dueDate: sgLocal(30) });
    await expect(item.getByTestId('due-text')).toContainText('Due in');
  });

  test('rejects a due date less than one minute ahead', async ({ app, page }) => {
    await page.getByLabel('Todo title').fill('Instant task');
    await page.getByLabel('Due date').first().fill(sgLocal(0));
    await page.getByRole('button', { name: 'Add', exact: true }).first().click();
    await expect(page.getByTestId('error-message')).toBeVisible();
    await expect(app.todo('Instant task')).toHaveCount(0);
  });
});
