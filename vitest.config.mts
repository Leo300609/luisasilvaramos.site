import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const alias = { '@': fileURLToPath(new URL('./src', import.meta.url)) }

export default defineConfig({
  resolve: { alias },
  test: {
    coverage: { provider: 'v8', include: ['src/**/*.ts'], reporter: ['text', 'html'] },
    projects: [
      {
        resolve: { alias },
        test: { name: 'unit', environment: 'node', include: ['tests/unit/**/*.test.ts'] },
      },
      {
        resolve: { alias },
        test: {
          name: 'db',
          environment: 'node',
          include: ['tests/db/**/*.test.ts'],
          // One shared Postgres database: run files one at a time.
          fileParallelism: false,
          globalSetup: ['tests/db/global-setup.ts'],
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
})
