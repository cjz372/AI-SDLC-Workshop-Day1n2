import { test, expect } from './fixtures';
import { sgLocal } from './helpers';

test.describe('Calendar', () => {
  test('navigates between months via the URL', async ({ app, page }) => {
    await page.goto('/calendar');
    await expect(page.getByTestId('month-title')).toBeVisible();
    await page.getByRole('button', { name: 'Next month' }).click();
    await expect(page).toHaveURL(/\?month=\d{4}-\d{2}/);
    const next = new URL(page.url()).searchParams.get('month');
    await page.getByRole('button', { name: 'Previous month' }).click();
    await expect(page).not.toHaveURL(new RegExp(`month=${next}`));
  });

  test('shows holidays and todos on their due day', async ({ app, page }) => {
    await app.page.goto('/');
    await app.createTodo({ title: 'Calendar task', dueDate: sgLocal(60 * 24 * 2) });
    await page.goto('/calendar?month=2026-12');
    await expect(page.locator('[data-testid="calendar-day"][data-date="2026-12-25"]')).toContainText('Christmas Day');

    await page.goto('/calendar');
    const todo = page.getByTestId('calendar-todo').filter({ hasText: 'Calendar task' });
    await expect(todo).toBeVisible();
    await todo.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByTestId('day-todo').filter({ hasText: 'Calendar task' })).toBeVisible();
  });
});
