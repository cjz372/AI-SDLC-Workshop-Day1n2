import { test, expect } from './fixtures';
import { sgLocal } from './helpers';

test.describe('Todo CRUD', () => {
  test('creates a title-only todo, edits it, toggles completion and deletes it', async ({ app, page }) => {
    await app.createTodo({ title: 'Buy milk' });
    await app.todo('Buy milk').getByRole('button', { name: 'Edit' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit Todo' });
    await dialog.getByLabel('Todo title').fill('Buy oat milk');
    await dialog.getByRole('button', { name: 'Update' }).click();
    await expect(app.todo('Buy oat milk')).toBeVisible();

    await page.getByRole('checkbox', { name: 'Complete Buy oat milk' }).click();
    await expect(app.todo('Buy oat milk')).toHaveAttribute('data-section', 'completed');

    page.once('dialog', (d) => d.accept());
    await app.todo('Buy oat milk').getByRole('button', { name: 'Delete' }).click();
    await expect(app.todo('Buy oat milk')).toHaveCount(0);
  });

  test('disables Add when the title is empty and rejects a past due date', async ({ app, page }) => {
    const add = page.getByRole('button', { name: 'Add', exact: true }).first();
    await expect(add).toBeDisabled();

    await page.getByLabel('Todo title').fill('Too late');
    await page.getByLabel('Due date').first().fill(sgLocal(-60));
    await add.click();
    await expect(page.getByTestId('error-message')).toBeVisible();
  });
});
