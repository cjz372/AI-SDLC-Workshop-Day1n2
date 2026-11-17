import { test, expect } from './fixtures';

test.describe('Tags', () => {
  test('creates a tag, assigns it to a todo and filters by it', async ({ app, page }) => {
    const tag = `work${Date.now().toString(36)}`;
    await app.createTag(tag);
    const item = await app.createTodo({ title: 'Tagged task', tags: [tag] });
    await expect(item.getByTestId('tag-pill').filter({ hasText: tag })).toBeVisible();

    await page.getByLabel('Filter by tag', { exact: true }).selectOption({ label: tag });
    await expect(page.getByTestId('tag-filter-indicator')).toContainText(tag);
    await expect(app.todo('Tagged task')).toBeVisible();
  });

  test('rejects a duplicate tag name', async ({ app, page }) => {
    const tag = `dup${Date.now().toString(36)}`;
    await app.createTag(tag);
    await page.getByRole('button', { name: '+ Manage Tags' }).click();
    const dialog = page.getByRole('dialog', { name: 'Manage Tags' });
    await dialog.getByLabel('Tag name').fill(tag);
    await dialog.getByRole('button', { name: 'Create Tag' }).click();
    await expect(page.getByTestId('error-message')).toBeVisible();
  });
});
