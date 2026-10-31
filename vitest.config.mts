import { defineConfig } from 'vitest/config'

// Tests for both halves, run from the repo root (`npm test`): the server's
// logic and the client's plain helpers. They need no network: f1db and
// OpenF1 are replaced with stubs. Builds leave *.test.ts files out.
export default defineConfig({
  test: {
    include: ['server/src/**/*.test.ts', 'client/src/**/*.test.ts'],
    environment: 'node',
  },
})
