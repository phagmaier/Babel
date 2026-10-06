// Layout checks only (element + shell geometry) in Chromium, without the PDF
// viewer step of smoke.mjs; for hosts whose Chromium lacks newer JS APIs.
// Usage: CHROMIUM_PATH=/path/to/chrome node tests/browser/layout.mjs
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import process from 'node:process';
import console from 'node:console';
import { checkElementLayout } from './element-layout.mjs';
import { checkShellLayout } from './shell-layout.mjs';
const server = await createServer({
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
});
await server.listen();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5174');
  await page.getByRole('heading', { name: 'babel' }).waitFor();
  console.log(
    'element',
    JSON.stringify(await checkElementLayout(page)).slice(0, 300),
  );
  console.log(
    'shell',
    JSON.stringify(await checkShellLayout(page)).slice(0, 300),
  );
} finally {
  await browser.close();
  await server.close();
}
