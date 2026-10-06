import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  // Scan the app entry, without walking accumulated native/build artifacts.
  optimizeDeps: {
    entries: ['index.html'],
  },
  server: {
    port: 5173,
    strictPort: true,
    host: process.env.TAURI_DEV_HOST || false,
    watch: {
      ignored: ['**/target/**'],
    },
  },
  // Leave CPU/memory headroom for native compilation on development laptops.
  // Override per host: VITEST_WORKERS=8 on a many-core desktop, default 2.
  test: {
    environment: 'jsdom',
    include: configDefaults.include.map(
      (pattern) => `tests/{contract,ui}/${pattern}`,
    ),
    exclude: [...configDefaults.exclude, 'target/**'],
    maxWorkers: Number(process.env.VITEST_WORKERS ?? 2),
  },
});
