import { expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { TextSelection } from 'prosemirror-state';
import * as baseCodec from '@baseline/domain/fountainCodec';
import * as baseState from '@baseline/editor/state';
import * as baseBridge from '@baseline/editor/sourceBridge';
import * as codec from '../../src/domain/fountainCodec';
import * as editor from '../../src/editor/state';
import * as bridge from '../../src/editor/sourceBridge';
import type { EditableKind } from '../../src/domain/fountainModel';

const bytes = (source: string) => new TextEncoder().encode(source);
const text = (source: Uint8Array) =>
  new TextDecoder('utf-8', { ignoreBOM: true }).decode(source);
const texts = [
  '',
  ' x',
  'x ',
  '\tx',
  '.x',
  '..x',
  '. x',
  '!x',
  '@x',
  '>x',
  'x<',
  'x <',
  '>x<',
  '<x',
  '~x',
  '#x',
  '# x',
  '=x',
  '= x',
  '===',
  'x #1#',
  'x#1#',
  'x ^',
  'x^',
  'X ^',
  '(x',
  '(x)',
  '(x) y',
  'y (x)',
  'x)',
  '(x) (y)',
  "'x",
  '"x"',
  '-x',
  '1x',
  '*x*',
  '_x_',
  '[[x]]',
  '[[x',
  'x]]',
  'x [[n]]',
  '/*x*/',
  '/*x',
  '{{x}}',
  'INT. X',
  'int. x',
  'BOB',
  'CUT TO:',
  'Key: v',
  '  ',
  ' ',
  'é',
  '\\*x',
];
const contexts: [string, number][] = [
  ['!Alpha.\n\n.HALL\n\n!Omega.\n', 2],
  ['Alpha.\n\nINT. HOUSE - DAY\n\nOmega.\n', 2],
  ['!Alpha.\n\n.HALL #12#\n\n!Omega.\n', 2],
  ['Alpha.\n\nMiddle.\n\nOmega.\n', 2],
  ['Alpha.\n\n@BOB\nHi.\n\nOmega.\n', 2],
  ['Alpha.\n\nBOB\nHi.\n\nOmega.\n', 2],
  ['Alpha.\n\n@BOB\nHi.\n\nOmega.\n', 3],
  ['Alpha.\n\n@BOB\nOne.\nTwo.\n\nOmega.\n', 3],
  ['Alpha.\n\n@BOB\nOne.\nTwo.\n\nOmega.\n', 4],
  ['Alpha.\n\n@BOB\n(beat)\nHi.\n\nOmega.\n', 3],
  ['Alpha.\n\n>FADE\n\nOmega.\n', 2],
  ['Alpha.\n\nCUT TO:\n\nOmega.\n', 2],
  ['Alpha.\n\n>THE END<\n\nOmega.\n', 2],
  ['Alpha.\n\n~la la\n\nOmega.\n', 2],
  ['Alpha.\n\n# Act\n\nOmega.\n', 2],
  ['Alpha.\n\n= Sum\n\nOmega.\n', 2],
];
type Outcome = { ok: false } | { ok: true; source: string; facts?: string };
function outcome(
  run: () => Omit<Extract<Outcome, { ok: true }>, 'ok'>,
): Outcome {
  try {
    return { ok: true, ...run() };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error)
      return { ok: false };
    throw error; // Unexpected exceptions are not approved capture refusals.
  }
}
function compare(old: Outcome, now: Outcome, label: unknown) {
  if (!old.ok) return; // New successes are permitted; named tests own their semantics.
  expect(now, JSON.stringify(label)).toEqual(old);
}
function edit(
  tree: typeof editor,
  capture: typeof bridge,
  source: string,
  row: number,
  value: string,
) {
  let state = tree.createEditorState(bytes(source));
  let start = 1;
  for (let i = 0; i < row; i++) start += state.doc.child(i).nodeSize;
  const end = start + state.doc.child(row).content.size;
  const tr = state.tr.setSelection(TextSelection.create(state.doc, start, end));
  const applied = tree.applyEditorTransaction(
    state,
    value ? tr.insertText(value) : tr.deleteSelection(),
  );
  if (!applied.accepted) return { ok: false } as const;
  state = applied.state;
  return outcome(() => ({ source: text(capture.captureEditor(state).source) }));
}

it('the full F4 848 single-row probe has no new refused capture or changed successful bytes', () => {
  expect(texts).toHaveLength(53);
  let count = 0,
    successes = 0,
    refusals = 0;
  for (const [source, row] of contexts)
    for (const value of texts) {
      const old = edit(baseState, baseBridge, source, row, value);
      if (old.ok) successes++;
      else refusals++;
      compare(old, edit(editor, bridge, source, row, value), {
        source,
        row,
        value,
      });
      count++;
    }
  expect(count).toBe(848);
  if (process.env.BABEL_DIFFERENTIAL_REPORT)
    writeFileSync(
      process.env.BABEL_DIFFERENTIAL_REPORT + '.editor.json',
      JSON.stringify({
        count,
        successes,
        refusals,
        newRefusals: 0,
        changedSuccesses: 0,
      }),
      { flag: 'wx' },
    );
});

it('codec edits retain successful bytes and line facts across BOM, endings and EOF', () => {
  const seeds = [
    '.HALL',
    '!Alpha.\n\n.HALL',
    '!Alpha.\n\n.HALL #12#',
    '@BOB\nHi.',
    '@BOB\nOne.\nTwo.',
    '@BOB\n(beat)',
    '@BOB\n(beat)\nHi.',
    '@BOB\nOne.\n(beat)',
    '!Alpha.\n\n!Omega.',
    '@BOB',
    '>CUT TO:',
    '# Act',
    '= Sum',
    '~la la',
    '>center<',
    '===',
    '[[note]]',
    '/*hidden*/',
    '@BOB\nOne.\nTwo.\nThree.',
    '!Alpha.\n\n.HALL\n\n!Omega.',
    'INT. HALL - DAY\n\nAlpha.\n\nBOB\nHi.',
    'CUT TO:\n\nAlpha.',
  ];
  const values = [
    '',
    ' ',
    '  ',
    'Hello.',
    'HALL',
    "'TIL DAWN",
    '# hey',
    'x #1#',
    'BOB ^',
    'CUT<',
    '!hey',
    '@hey',
    '>hey',
    '(beat)',
    '(beat) x',
    'x (beat)',
    '(beat',
    '{{x}}',
    '😀',
    '\n',
    '\ud800',
  ];
  let count = 0;
  for (const seed of seeds)
    for (const nl of ['\n', '\r\n', '\r', 'mixed'])
      for (const bom of ['', '\ufeff'])
        for (const eof of [false, true]) {
          let n = 0;
          const source =
            bom +
            seed.replace(/\n/g, () =>
              nl === 'mixed' ? (++n % 2 ? '\r\n' : '\n') : nl,
            ) +
            (eof ? (nl === 'mixed' ? '\r\n' : nl) : '');
          const before = baseCodec.parseFountain(bytes(source));
          for (const [row, line] of before.lines.entries()) {
            if (!line.editable) continue;
            for (const value of values) {
              const edits = [{ kind: line.kind as EditableKind, text: value }];
              const run = (api: typeof codec) =>
                outcome(() => {
                  const after = api.replaceLines(
                    api.parseFountain(bytes(source)),
                    row,
                    1,
                    edits,
                  );
                  return {
                    source: text(api.serializeFountain(after)),
                    facts: JSON.stringify(after.lines),
                  };
                });
              compare(run(baseCodec), run(codec), { source, row, value });
              count++;
            }
          }
        }
  expect(count).toBeGreaterThan(13792);
  console.log(
    `capture differential: 848 editor rewrites; ${count} codec edits`,
  );
  if (process.env.BABEL_DIFFERENTIAL_REPORT)
    writeFileSync(
      process.env.BABEL_DIFFERENTIAL_REPORT + '.codec.json',
      JSON.stringify({
        count,
        newRefusals: 0,
        changedSuccessfulBytesOrFacts: 0,
      }),
      { flag: 'wx' },
    );
});
