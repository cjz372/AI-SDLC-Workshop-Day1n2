import { test, expect } from './fixtures';

test.describe('Subtasks', () => {
  test('shows progress and turns the bar green at 100%', async ({ app, page }) => {
    const item = await app.createTodo({ title: 'Trip prep' });
    await app.addSubtask('Trip prep', 'Passport');
    await app.addSubtask('Trip prep', 'Tickets');
    await page.getByRole('checkbox', { name: 'Complete subtask Passport' }).click();
    await expect(item.getByTestId('progress')).toContainText('1/2 subtasks completed (50%)');
    const bar = item.getByRole('progressbar');
    await expect(bar).toHaveClass(/bg-blue-500/);

    await page.getByRole('checkbox', { name: 'Complete subtask Tickets' }).click();
    await expect(item.getByTestId('progress')).toContainText('2/2 subtasks completed (100%)');
    await expect(bar).toHaveClass(/bg-green-500/);
  });

  test('deletes a todo after confirmation', async ({ app, page }) => {
    await app.createTodo({ title: 'Disposable' });
    page.once('dialog', (d) => d.accept());
    await app.todo('Disposable').getByRole('button', { name: 'Delete' }).click();
    await expect(app.todo('Disposable')).toHaveCount(0);
  });
});
