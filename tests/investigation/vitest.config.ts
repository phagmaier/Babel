import { defineConfig } from 'vitest/config';

// Investigation reproducers run by name only: `pnpm test`, the differential
// gate and CI never discover this folder. A failure here is retained evidence
// of an open finding, not a broken gate.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/investigation/*.test.ts'],
    maxWorkers: 1,
    testTimeout: 180000,
  },
});
