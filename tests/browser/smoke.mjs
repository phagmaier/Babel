import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import process from 'node:process';
import console from 'node:console';

const server = spawn('pnpm', ['dev', '--host', '127.0.0.1'], { stdio: 'pipe' });
let browser;
try {
  await new Promise((resolve, reject) => {
    const timeout = globalThis.setTimeout(
      () => reject(new Error('Vite did not start')),
      15000,
    );
    server.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('Local:')) {
        globalThis.clearTimeout(timeout);
        resolve();
      }
    });
    server.on('exit', (code) => reject(new Error(`Vite exited ${code}`)));
  });
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5173');
  await page.getByRole('heading', { name: 'babel' }).waitFor();
  await page
    .getByText('Browser preview only; native services are unavailable.')
    .waitFor();
  if (await page.getByRole('button', { name: /New screenplay/ }).isEnabled())
    throw new Error('New screenplay unexpectedly enabled');
  if (await page.getByRole('button', { name: /Open Fountain/ }).isEnabled())
    throw new Error('Open Fountain unexpectedly enabled');
  await page.screenshot({ path: '/tmp/babel-m0-browser.png', fullPage: true });
  console.log('Browser smoke passed; screenshot: /tmp/babel-m0-browser.png');
} finally {
  await browser?.close();
  server.kill();
}
