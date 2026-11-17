import { test as base } from '@playwright/test';
import { addVirtualAuthenticator, TodoApp } from './helpers';

/** `app` is a TodoApp already registered/logged in as a fresh user with a virtual authenticator. */
export const test = base.extend<{ app: TodoApp; rawApp: TodoApp }>({
  rawApp: async ({ page }, provide) => {
    await addVirtualAuthenticator(page);
    await provide(new TodoApp(page));
  },
  app: async ({ rawApp }, provide) => {
    await rawApp.register();
    await provide(rawApp);
  },
});
export { expect } from '@playwright/test';
