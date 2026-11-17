import { test, expect } from './fixtures';

test.describe('Search and filtering', () => {
  test('search and priority filter narrow the list and update the summary', async ({ app, page }) => {
    await app.createTodo({ title: 'Buy milk', priority: 'high' });
    await app.createTodo({ title: 'Walk dog', priority: 'low' });

    await page.getByLabel('Search todos').fill('milk');
    await expect(app.todo('Walk dog')).toBeHidden();
    await expect(page.getByTestId('filter-summary')).toContainText('Showing 1 of 2 todos');

    await page.getByLabel('Search todos').fill('');
    await page.getByLabel('Filter by priority').selectOption('low');
    await expect(app.todo('Buy milk')).toBeHidden();
    await expect(app.todo('Walk dog')).toBeVisible();
  });

  test('shows empty state when nothing matches and Clear All restores the list', async ({ app, page }) => {
    await app.createTodo({ title: 'Alpha item' });
    await page.getByLabel('Search todos').fill('zzz-no-match');
    await expect(page.getByTestId('empty-state')).toBeVisible();

    await page.getByRole('button', { name: 'Clear All' }).click();
    await expect(page.getByLabel('Search todos')).toHaveValue('');
    await expect(app.todo('Alpha item')).toBeVisible();
  });
});
