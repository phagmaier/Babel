import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { afterAll, expect, it } from 'vitest';
import { parseFountain } from '../../src/domain/fountainCodec';
import { buildManuscriptIndex } from '../../src/domain/manuscriptIndex';
const measurements: unknown[] = [];
afterAll(() => {
  if (process.env.BABEL_INDEX_MEASUREMENTS)
    writeFileSync(
      process.env.BABEL_INDEX_MEASUREMENTS,
      JSON.stringify(measurements, null, 2) + '\n',
    );
});

// Independent synthetic workloads: exactly 18 physical lines per scene;
// 4 Action rows, 2 cues, 6 Dialogue rows, 3 blanks, heading and 2 synopses.
// These labels make no PDF page or compositor-paint claim.
for (const [name, scenes] of [
  ['typical', 150],
  ['stress', 1500],
] as const) {
  it(`${name} immutable index measurement (V8, parser excluded)`, () => {
    const text =
      'Title: Synthetic index workload\n\n# Act\n' +
      Array.from(
        { length: scenes },
        (_, at) =>
          `.INT. ROOM ${at} - DAY #${at % 7}#\n= Arrival ${at}\n= Conflict unfolds\n!Zoë arrives with a worn notebook and reads the sign.\n!A lamp flickers above the doorway.\n\n@MAYA\nThe door is open.\nCome inside.\nWe have time.\n\n@NOAH\nI saw the signal.\nWe should leave.\nWait here.\n\n!They cross the room in silence.\n!A bell rings outside.\n`,
      ).join('');
    const source = new TextEncoder().encode(text);
    const document = parseFountain(source);
    expect(document.lines.length).toBe(3 + scenes * 18);
    buildManuscriptIndex(document); // warmup, not measured
    const samples: number[] = [];
    for (let at = 0; at < 7; at++) {
      const started = performance.now();
      const index = buildManuscriptIndex(document);
      samples.push(performance.now() - started);
      expect(index.items.length).toBe(scenes + 1);
      expect(index.items.at(-1)!.ordinal).toBe(scenes);
      expect(index.lineCount).toBe(document.lines.length);
    }
    samples.sort((a, b) => a - b);
    measurements.push({
      name,
      scenes,
      bytes: source.length,
      lines: document.lines.length,
      sha256: createHash('sha256').update(source).digest('hex'),
      method:
        '7 warm V8 index builds from immutable codec document; parse/capture/paint excluded',
      medianMs: samples[3],
      maxMs: samples[6],
      samples,
    });
    // Functional guard against accidental pathological growth; 200ms is
    // evaluated from the isolated measurement and real native UI separately.
    expect(samples[3]).toBeLessThan(1500);
  });
}
