import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname) } },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    env: { DB_PATH: ':memory:', JWT_SECRET: 'unit-test-secret-unit-test-secret-0123456789' },
    coverage: { provider: 'v8', include: ['lib/**/*.ts'], exclude: ['lib/hooks/**', 'lib/auth.ts', 'lib/api.ts', 'lib/rate-limit.ts', 'lib/webauthn-config.ts'] },
  },
});
