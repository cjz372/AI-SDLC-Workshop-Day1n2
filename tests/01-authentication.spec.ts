import { test, expect } from './fixtures';
import { TodoApp } from './helpers';

test.describe('Authentication', () => {
  test('registers a new user with a passkey and lands on the todo page', async ({ rawApp, page }) => {
    const name = await rawApp.register();
    await expect(page.getByRole('heading', { name: 'Todo App' })).toBeVisible();
    await expect(page.getByText(name)).toBeVisible();
  });

  test('logs out and logs back in with the same passkey', async ({ rawApp, page }) => {
    const name = await rawApp.register();
    await rawApp.logout();
    await rawApp.login(name);
    await expect(page.getByText(name)).toBeVisible();
  });

  test('logout clears the session immediately', async ({ rawApp, page }) => {
    await rawApp.register();
    await rawApp.logout();
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
    expect((await page.request.get('/api/auth/me')).status()).toBe(401);
  });

  test('protected routes redirect unauthenticated users to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/calendar');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login page redirects authenticated users to /', async ({ rawApp, page }) => {
    await rawApp.register();
    await page.goto('/login');
    await expect(page).toHaveURL('/');
  });

  test('rejects duplicate usernames', async ({ rawApp, page }) => {
    const name = await rawApp.register();
    await rawApp.logout();
    await page.getByLabel('Username').fill(name);
    await page.getByRole('button', { name: 'Register' }).click();
    await expect(page.getByTestId('error-message')).toContainText('already taken');
  });

  test('session cookie is HTTP-only with a 7-day lifetime', async ({ rawApp, page }) => {
    await rawApp.register();
    const cookie = (await page.context().cookies()).find((c) => c.name === 'session');
    expect(cookie?.httpOnly).toBe(true);
    const days = ((cookie?.expires ?? 0) - Date.now() / 1000) / 86400;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThanOrEqual(7.01);
    expect(TodoApp.uniqueName()).toBeTruthy();
  });
});
