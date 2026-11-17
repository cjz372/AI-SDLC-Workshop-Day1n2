import { test, expect } from '@playwright/test';

test.describe('Smoke', () => {
  test('login page renders heading and auth buttons', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Todo App' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Register' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
  });

  test('unknown route shows 404 page', async ({ page }) => {
    await page.goto('/no-such-page');
    await expect(page.getByText('404').first()).toBeVisible();
  });
});
