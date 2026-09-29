/** Chromium resource interception: browser evidence, not native input. Requires owned dev server. */
import process from 'node:process';
import console from 'node:console';
import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage();
  const external = [];
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (
      !url.startsWith('http://localhost:5173/') &&
      !url.startsWith('http://127.0.0.1:5173/')
    ) {
      external.push(url);
      await route.abort();
    } else await route.continue();
  });
  await page.goto('http://localhost:5173/tests/native/editor-input/index.html');
  await page.waitForFunction(() => globalThis.inputView);
  const result = await page.evaluate(() => {
    const view = globalThis.inputView;
    const event = new globalThis.ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: new globalThis.DataTransfer(),
    });
    event.clipboardData.setData(
      'text/html',
      '<p onclick="globalThis.clipboardExecuted=true">safe<img src="https://invalid.example/image" onerror="globalThis.clipboardExecuted=true"><iframe src="https://invalid.example/frame"></iframe><svg><image href="https://invalid.example/svg"></image></svg></p><link rel="stylesheet" href="https://invalid.example/style"><style>@import "https://invalid.example/css";</style><script>globalThis.clipboardExecuted=true</script>',
    );
    view.dom.dispatchEvent(event);
    return {
      text: view.state.doc.child(2).textContent,
      unsafe: !!view.dom.querySelector(
        'img,iframe,svg,link,style,script,[onclick],[onerror]',
      ),
      executed: !!globalThis.clipboardExecuted,
      prevented: event.defaultPrevented,
    };
  });
  await new Promise((resolve) => globalThis.setTimeout(resolve, 250));
  if (
    external.length ||
    result.unsafe ||
    result.executed ||
    !result.prevented ||
    result.text !== 'Hello world.safe'
  )
    throw new Error(JSON.stringify({ external, result }));
  console.log(
    JSON.stringify({ browser: 'Chromium', externalRequests: external, result }),
  );
} finally {
  await browser.close();
}
