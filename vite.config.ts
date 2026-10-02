import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: process.env.TAURI_DEV_HOST || false,
  },
  // Leave CPU/memory headroom for native compilation on development laptops.
  test: { environment: 'jsdom', maxWorkers: 2 },
});
