import { test, expect } from './fixtures';

test.describe('Templates', () => {
  test('saves a template and uses it to create a todo', async ({ app, page }) => {
    const name = `tpl${Date.now().toString(36)}`;
    await app.createTemplate('Weekly report', name);
    await page.reload();
    await page.getByLabel('Use Template').selectOption({ label: name });
    await expect(app.todo('Weekly report').first()).toBeVisible();
  });

  test('template subtasks are copied onto the created todo', async ({ app, page }) => {
    const res = await page.request.post('/api/templates', {
      data: { name: 'T', title_template: 'From tpl', subtasks: [{ title: 'A' }, { title: 'B' }] },
    });
    expect(res.status()).toBe(201);
    const { template } = await res.json();
    const use = await page.request.post(`/api/templates/${template.id}/use`);
    expect(use.ok()).toBe(true);
    await page.reload();
    await expect(app.todo('From tpl').first()).toContainText('0/2 subtasks completed (0%)');
  });
});
