import { test, expect } from './fixtures';

test.describe('Export and import', () => {
  test('exports JSON without ids and CSV with the expected header', async ({ app, page }) => {
    await app.createTodo({ title: 'Export me' });
    const json = await page.request.get('/api/todos/export?format=json');
    const body = await json.json();
    expect(body.version).toBe(1);
    expect(body.todos.some((t: { title: string }) => t.title === 'Export me')).toBe(true);
    expect(body.todos.every((t: Record<string, unknown>) => !('id' in t))).toBe(true);

    const csv = await page.request.get('/api/todos/export?format=csv');
    const header = (await csv.text()).split(/\r?\n/)[0];
    expect(header).toBe('ID,Title,Completed,Due Date,Priority,Recurring,Pattern,Reminder');
  });

  test('imports a JSON file and rejects invalid JSON', async ({ app, page }) => {
    await page.getByLabel('Import file').setInputFiles({
      name: 't.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ version: 1, todos: [{ title: 'Imported' }] })),
    });
    await expect(page.getByRole('status')).toContainText('Successfully imported 1 todos');
    await expect(app.todo('Imported')).toBeVisible();

    await page.getByLabel('Import file').setInputFiles({
      name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{not json'),
    });
    await expect(page.getByTestId('error-message')).toHaveText('Invalid JSON format');
  });
});
