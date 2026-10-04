import { chromium } from 'playwright-core';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';
import console from 'node:console';
import { checkElementLayout } from './element-layout.mjs';
import { checkShellLayout } from './shell-layout.mjs';

const server = spawn('pnpm', ['dev', '--host', '127.0.0.1'], { stdio: 'pipe' });
let browser;
const pdfRoot = await mkdtemp(join(tmpdir(), 'babel-viewer-smoke-'));
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
  // Display actual frozen-profile bytes in a real worker, separate from native IPC.
  const output = join(pdfRoot, 'preview.pdf');
  const source = await readFile(
    'fixtures/publication/speech-continuation.fountain',
  );
  const helper = spawnSync(
    resolve('target/pdf-helper/runtime/python/bin/python3.13'),
    [
      '-I',
      '-S',
      '-B',
      resolve('target/pdf-helper/runtime/app/babel_pdf_helper.py'),
      JSON.stringify({ protocol: 1, profile: 'us-letter-draft-v1', output }),
    ],
    { input: source, encoding: 'utf8' },
  );
  if (helper.status !== 0)
    throw new Error(
      'Offline viewer fixture render failed: ' + helper.stdout + helper.stderr,
    );
  const receipt = JSON.parse(helper.stdout);
  const pdf = await readFile(output);
  const display = await page.evaluate(
    async (bytes) => {
      const { localPdfViewer } =
        await import('/src/infrastructure/localPdfViewer.ts');
      const abort = new globalThis.AbortController();
      const documentView = await localPdfViewer.load(
        new Uint8Array(bytes),
        abort.signal,
      );
      const host = globalThis.document.createElement('div');
      globalThis.document.body.append(host);
      const text = await documentView.render(1, 1, host, abort.signal);
      const canvas = host.querySelector('canvas');
      const result = {
        pages: documentView.pages,
        text,
        width: canvas.width,
        height: canvas.height,
      };
      documentView.close();
      host.remove();
      return result;
    },
    [...pdf],
  );
  if (
    display.pages !== receipt.pageCount ||
    display.width !== 612 ||
    display.height !== 792 ||
    !display.text.includes('MORE')
  )
    throw new Error(
      'Frozen PDF viewer smoke failed: ' + JSON.stringify(display),
    );
  const layouts = await checkElementLayout(page);
  console.log('Element layout passed: ' + layouts.join(', '));
  const shell = await checkShellLayout(page);
  console.log('Shell layout passed: ' + shell.join(', '));
  await page.screenshot({ path: '/tmp/babel-m0-browser.png', fullPage: true });
  console.log('Browser smoke passed; screenshot: /tmp/babel-m0-browser.png');
} finally {
  await browser?.close();
  server.kill();
  await rm(pdfRoot, { recursive: true, force: true });
}
