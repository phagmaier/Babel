/**
 * M1-03 fallback probe (pdf-lib, offline, proof only).
 *
 * Renders a tiny synthetic screenplay with US Letter geometry and base-14
 * Courier (no font file to embed) using hand-rolled greedy wrapping and
 * manual pagination. It proves the JS-bundled packaging path exists while
 * showing the cost: screenplay keep-with-next, (MORE) continuations, dual
 * dialogue, and title-page template rules are NOT implemented here. Run:
 *   node prototypes/pdf/fallback.mjs
 */
import { createHash } from 'node:crypto';
import console from 'node:console';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const root = join(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, 'out');

// US Letter, 12pt Courier, geometry mirrored from the Screenplain proof
// for comparability: 1.5in left, ~1in top, 55 lines/page, 61 chars/line.
const PAGE_W = 612;
const PAGE_H = 792;
const FONT_SIZE = 12;
const CHAR_W = 7.2; // 0.6 * 12pt for Courier
const LEFT = 108; // 1.5in
const TOP = 72; // 1in
const LINES_PER_PAGE = 55;
const FRAME_W = 61 * CHAR_W;
const LINE_H = 12;

const BLOCKS = [
  { kind: 'title', text: 'Fallback Probe' },
  { kind: 'title', text: 'An original synthetic sample' },
  { kind: 'break' },
  { kind: 'slug', text: 'INT. FERRY TERMINAL - DUSK' },
  {
    kind: 'action',
    text: 'The rope loosens under cold rain while the lantern flickers beside the dock.',
  },
  { kind: 'character', text: 'MARA' },
  { kind: 'parenthetical', text: '(under breath)' },
  {
    kind: 'dialogue',
    text: 'Keep walking. There is still time before the tide turns.',
  },
  { kind: 'transition', text: 'CUT TO:' },
  { kind: 'slug', text: 'EXT. LIGHTHOUSE - NIGHT' },
  {
    kind: 'action',
    text: 'A long unbreakable token tests the fallback wrapper: SupercalifragilisticexpialidociousSupercalifragilisticexpialidocious.',
  },
];

function wrap(text, maxChars) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (word.length > maxChars) {
      if (line) lines.push(line);
      // Hard-split an unbreakable unit rather than clipping, omitting,
      // or looping forever; the profile rule itself stays open for M5.
      for (let i = 0; i < word.length; i += maxChars) {
        lines.push(word.slice(i, i + maxChars));
      }
      line = '';
      continue;
    }
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [''];
}

function layout() {
  // Returns pages of {text, x} lines; title page separate, body numbered.
  // Column widths mirror the Screenplain proof geometry (61-char frame):
  // character 61-19=42, dialogue 45-9=36, parenthetical 61-13=48.
  const bodyLines = [];
  const titleLines = [];
  const blank = { text: '', x: LEFT };
  for (const block of BLOCKS) {
    if (block.kind === 'title') {
      titleLines.push({ text: block.text, x: LEFT, center: true });
      continue;
    } else if (block.kind === 'break') {
      titleLines.push({ text: '', x: LEFT });
      continue;
    } else if (block.kind === 'character') {
      for (const l of wrap(block.text, 42)) {
        bodyLines.push({ text: l, x: LEFT + 19 * CHAR_W });
      }
    } else if (block.kind === 'dialogue') {
      for (const l of wrap(block.text, 36)) {
        bodyLines.push({ text: l, x: LEFT + 9 * CHAR_W });
      }
    } else if (block.kind === 'parenthetical') {
      for (const l of wrap(block.text, 48)) {
        bodyLines.push({ text: l, x: LEFT + 13 * CHAR_W });
      }
    } else if (block.kind === 'transition') {
      for (const l of wrap(block.text, 61)) {
        bodyLines.push({ text: l, x: LEFT, right: true });
      }
    } else {
      for (const l of wrap(block.text, 61)) {
        bodyLines.push({ text: l, x: LEFT });
      }
    }
    bodyLines.push(blank);
  }
  const pages = [[...titleLines]];
  let current = [];
  for (const line of bodyLines) {
    current.push(line);
    if (current.length >= LINES_PER_PAGE) {
      pages.push(current);
      current = [];
    }
  }
  if (current.length > 0) pages.push(current);
  return pages;
}

const started = Date.now();
const doc = await PDFDocument.create();
doc.setTitle('Fallback Probe (synthetic)');
doc.setAuthor('babel M1-03 proof');
const font = await doc.embedFont(StandardFonts.Courier);
const pages = layout();
for (let i = 0; i < pages.length; i += 1) {
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const lines = pages[i] ?? [];
  lines.forEach((line, row) => {
    const y = PAGE_H - TOP - LINE_H * (row + 1) + 2;
    let x = line.x;
    if (line.center) x = LEFT + (FRAME_W - line.text.length * CHAR_W) / 2;
    if (line.right) x = LEFT + FRAME_W - line.text.length * CHAR_W;
    page.drawText(line.text, {
      x,
      y,
      size: FONT_SIZE,
      font,
      color: rgb(0, 0, 0),
    });
  });
  // Title page carries no number; first body page number suppressed,
  // matching the Screenplain proof convention for comparability.
  if (i >= 2) {
    const label = `${i}.`;
    page.drawText(label, {
      x: LEFT + FRAME_W - label.length * CHAR_W,
      y: PAGE_H - 42,
      size: FONT_SIZE,
      font,
      color: rgb(0, 0, 0),
    });
  }
}
const bytes = await doc.save();
const elapsedMs = Date.now() - started;
const dest = join(outDir, 'fallback.pdf');
writeFileSync(dest, bytes);
const report = {
  pdf: 'fallback.pdf',
  pdf_bytes: bytes.length,
  pdf_sha256: createHash('sha256').update(bytes).digest('hex'),
  page_count: pages.length,
  render_ms: elapsedMs,
  fonts: ['Courier(base-14, not embedded)'],
  implemented: [
    'US Letter',
    '12pt Courier',
    'title/body break',
    'greedy wrap',
    'page numbers from body p2',
  ],
  not_implemented: [
    'keep-with-next',
    '(MORE) continuations',
    'dual dialogue columns',
    'title-page template',
    'sections/synopses/notes/boneyard warnings',
    'source map',
  ],
};
writeFileSync(
  join(outDir, 'fallback.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(
  `fallback.pdf: ${pages.length} pages, ${bytes.length} bytes, ${elapsedMs}ms`,
);
