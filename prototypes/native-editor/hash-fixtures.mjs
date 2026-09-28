import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import { makeFixture } from './fixture.ts';

for (const pages of [120, 300, 600]) {
  const fixture = makeFixture(pages);
  const bytes = Buffer.from(fixture.text, 'utf8');
  console.log(
    JSON.stringify({
      pages,
      blocks: fixture.blocks,
      lines: fixture.lines,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    }),
  );
}
