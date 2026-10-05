import { describe, expect, it } from 'vitest';
import { closeHistory, redo, undo } from 'prosemirror-history';
import { TextSelection, type EditorState } from 'prosemirror-state';
import { EditorCaptureBoundary } from '../../src/application/editorCapture';
import {
  editorRecovery,
  metadataSelection,
  verifiedEditorMetadata,
} from '../../src/application/editorMetadata';
import {
  evaluateExportAssessment,
  PUBLICATION_ASSESSMENT_IDENTITY as identity,
} from '../../src/domain/exportAssessment';
import {
  FountainEditError,
  parseFountain,
  replaceLine,
  serializeFountain,
  spellsAlone,
} from '../../src/domain/fountainCodec';
import type { FountainRecovery } from '../../src/domain/fountainModel';
import {
  evaluateScriptCheck,
  requiresExportReview,
} from '../../src/domain/scriptCheck';
import { captureEditor, refusedRow } from '../../src/editor/sourceBridge';
import {
  applyEditorTransaction,
  createEditorState,
} from '../../src/editor/state';

// AUDIT-PARK-H-F4-04: typed text Fountain reads as other syntax saves with
// its exact bytes where those bytes are one editable Action line (or
// Dialogue still inside its speech). The typed element is recovery-only
// intent; a non-blocking Script Check advisory names the row. Marker texts
// that would reopen as a cue, heading, section or other restructuring
// element stay refused.
const bytes = (text: string) => new TextEncoder().encode(text);
const text = (source: Uint8Array) =>
  new TextDecoder('utf-8', { ignoreBOM: true }).decode(source);
const open = (source: string) => createEditorState(bytes(source));
const saved = (state: EditorState) => text(captureEditor(state).source);
const rows = (state: EditorState) =>
  state.doc.content.content.map(
    (node) => `${node.type.name}:${node.textContent}`,
  );
function at(state: EditorState, row: number, offset: number) {
  let position = 1;
  for (let index = 0; index < row; index++)
    position += state.doc.child(index).nodeSize;
  return (
    position +
    (offset < 0 ? state.doc.child(row).content.size + offset + 1 : offset)
  );
}
/** Caret in `row`; a negative offset counts back from the row's end. */
function caret(state: EditorState, row: number, offset: number, to?: number) {
  return state.apply(
    state.tr.setSelection(
      TextSelection.create(
        state.doc,
        at(state, row, offset),
        to === undefined ? undefined : at(state, row, to),
      ),
    ),
  );
}
function typed(state: EditorState, value: string) {
  const applied = applyEditorTransaction(state, state.tr.insertText(value));
  expect(applied.accepted).toBe(true);
  return applied.state;
}
/** The whole text of `row` replaced by `value`. */
const rewritten = (state: EditorState, row: number, value: string) =>
  typed(caret(state, row, 0, -1), value);
function erased(state: EditorState, row: number, from: number, to: number) {
  const selected = caret(state, row, from, to);
  const applied = applyEditorTransaction(
    selected,
    selected.tr.deleteSelection(),
  );
  expect(applied.accepted).toBe(true);
  return applied.state;
}
function step(state: EditorState, command: typeof undo) {
  let next = state;
  expect(
    command(state, (tr) => {
      const applied = applyEditorTransaction(state, tr);
      expect(applied.accepted).toBe(true);
      next = applied.state;
    }),
  ).toBe(true);
  return next;
}
function refusal(run: () => unknown): FountainEditError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(FountainEditError);
    return error as FountainEditError;
  }
  throw new Error('Expected a refusal');
}
/** Reopen from the captured bytes and the sparse hash-bound draft metadata. */
async function recovered(state: EditorState) {
  const snapshot = (await new EditorCaptureBoundary(() => state).capture())
    .snapshot;
  const source = Uint8Array.from(snapshot.source);
  const metadata = await verifiedEditorMetadata(
    snapshot.source,
    snapshot.draftMetadata,
  );
  expect(metadata).toBeDefined();
  const restored = createEditorState(source, editorRecovery(source, metadata));
  return { snapshot, source, metadata, restored };
}
const headingBase = '.HALL\n\nAfter.\n';
const cueAlone = '@BOB\n\nAfter.\n';
const speech = '@BOB\nOne.\nTwo.\n';
const cueLine = '@BOB\nHi.\n\nAfter.\n';

describe('AUDIT-PARK-H-F4-04 typed text Fountain reads as action saves as typed', () => {
  it.each([
    ['sceneHeading', headingBase, "'TIL DAWN"],
    ['sceneHeading', headingBase, '"X"'],
    ['sceneHeading', headingBase, ' x'],
    ['sceneHeading', headingBase, '\tx'],
    ['sceneHeading', headingBase, '..x'],
    ['sceneHeading', headingBase, '. x'],
    ['sceneHeading', headingBase, '<x'],
    ['sceneHeading', headingBase, '#x'],
    ['sceneHeading', headingBase, 'x #1#'],
    ['sceneHeading', headingBase, '-x'],
    ['sceneHeading', headingBase, '*x*'],
    ['character', cueAlone, 'BOB ^'],
    ['character', cueAlone, '^'],
    ['transition', '>CUT TO:\n\nAfter.\n', 'CUT<'],
    ['transition', '>CUT TO:\n\nAfter.\n', '<'],
  ] as const)(
    '%s %j saves exact bytes as action with recovery-only intent',
    (kind, base, value) => {
      const before = parseFountain(bytes(base));
      const after = replaceLine(before, 0, { kind, text: value });
      // The one owned row is an editable Action holding the exact bytes.
      expect(after.lines[0]).toMatchObject({
        kind: 'action',
        text: value,
        intendedKind: kind,
        editable: true,
      });
      expect(text(serializeFountain(after))).toBe(
        `${value}\n${base.slice(base.indexOf('\n') + 1)}`,
      );
      // Capturing again without touching anything changes no byte.
      const again = replaceLine(after, 0, { kind, text: value });
      expect(text(serializeFountain(again))).toBe(
        text(serializeFountain(after)),
      );
      // Without recovery the same bytes open as Fountain reads them.
      const plain = parseFountain(serializeFountain(after));
      expect(plain.lines[0]).toMatchObject({ kind: 'action' });
      expect(plain.lines[0]!.intendedKind).toBeUndefined();
      expect(plain.lines[0]!.editable).toBe(true);
    },
  );

  it.each([['!hey'], ['! hey'], ['!!hey']] as const)(
    'dialogue %j saves as an action line with dialogue intent',
    (value) => {
      const after = replaceLine(parseFountain(bytes(cueLine)), 1, {
        kind: 'dialogue',
        text: value,
      });
      expect(after.lines[1]).toMatchObject({
        kind: 'action',
        intendedKind: 'dialogue',
        editable: true,
      });
      expect(after.lines[1]!.text).toBe(value);
      expect(text(serializeFountain(after))).toBe(`@BOB\n${value}\n\nAfter.\n`);
      const plain = parseFountain(serializeFountain(after));
      expect(plain.lines[1]).toMatchObject({ kind: 'action' });
      expect(plain.lines[1]!.intendedKind).toBeUndefined();
    },
  );

  it('a last-of-two dialogue starting with `!` saves without touching its speech', () => {
    const after = replaceLine(parseFountain(bytes(speech)), 2, {
      kind: 'dialogue',
      text: '!hey',
    });
    expect(after.lines[1]).toMatchObject({ kind: 'dialogue' });
    expect(after.lines[2]).toMatchObject({
      kind: 'action',
      intendedKind: 'dialogue',
    });
    expect(text(serializeFountain(after))).toBe('@BOB\nOne.\n!hey\n');
  });

  it('a forged intent on an action line the author never typed does not adopt', () => {
    const plain = parseFountain(bytes('!Alpha.\n\n!hey\n\n!Omega.\n'));
    const claimed: FountainRecovery = {
      ...plain.recovery,
      lines: plain.recovery.lines.map((line, index) =>
        index === 2 ? { ...line, intendedKind: 'sceneHeading' } : line,
      ),
    };
    // A heading intent fits an action line only for exact fallback bytes;
    // `!hey` was authored as action text `hey`, so the claim mismatches.
    expect(
      parseFountain(
        bytes('!Alpha.\n\n!hey\n\n!Omega.\n'),
        claimed,
      ).diagnostics.map(({ code }) => code),
    ).toContain('recovery-mismatch');
  });

  it('a row read alone under a cue counts as spelled only for the `!` dialogue', () => {
    expect(spellsAlone({ kind: 'dialogue', text: '!hey' }, true)).toBe(true);
    expect(spellsAlone({ kind: 'dialogue', text: '@hey' }, true)).toBe(false);
    expect(spellsAlone({ kind: 'dialogue', text: '>hey' }, true)).toBe(false);
    expect(spellsAlone({ kind: 'sceneHeading', text: "'hey" }, false)).toBe(
      false,
    );
    expect(spellsAlone({ kind: 'character', text: 'BOB ^' }, false)).toBe(
      false,
    );
    expect(spellsAlone({ kind: 'transition', text: 'CUT<' }, false)).toBe(
      false,
    );
  });
});

describe('AUDIT-PARK-H-F4-04 the editor saves the fallback rows', () => {
  it('every keystroke of a `!` typed at a dialogue start saves', () => {
    let state = caret(rewritten(open(cueLine), 1, '!'), 1, -1);
    expect(rows(state)[1]).toBe('dialogue:!');
    expect(saved(state)).toBe('@BOB\n!\n\nAfter.\n');
    expect(captureEditor(state).document.lines[1]!.intendedKind).toBe(
      'dialogue',
    );
    state = typed(state, 'hey');
    expect(rows(state)[1]).toBe('dialogue:!hey');
    expect(saved(state)).toBe('@BOB\n!hey\n\nAfter.\n');
  });

  it('text typed elsewhere is captured with the fallback row', () => {
    const state = typed(
      caret(rewritten(open('@BOB\nOne.\n\n!Act.\n'), 1, '!hey'), 3, -1),
      ' More.',
    );
    expect(saved(state)).toBe('@BOB\n!hey\n\n!Act. More.\n');
  });

  it('sparse hash-bound metadata recovers the element and the exact text', async () => {
    for (const [original, row, value, kind, alone] of [
      ['.HALL\n\nAfter.\n', 0, "'TIL DAWN", 'sceneHeading', "action:'TIL DAWN"],
      ['@BOB\n\nAfter.\n', 0, 'BOB ^', 'character', 'action:BOB ^'],
      ['>CUT TO:\n\nAfter.\n', 0, 'CUT<', 'transition', 'action:CUT<'],
      ['@BOB\nHi.\n\nAfter.\n', 1, '!hey', 'dialogue', 'action:hey'],
    ] as const) {
      const state = rewritten(open(original), row, value);
      const { snapshot, source, restored } = await recovered(state);
      expect(snapshot.draftMetadata).toMatchObject({
        schema: 'babel-editor-capture-v1',
        drafts: [{ index: row, intendedKind: kind }],
      });
      expect(rows(restored)).toEqual(rows(state));
      expect(restored.doc.child(row).type.name).toBe(kind);
      expect(restored.doc.child(row).attrs.protected).toBe(false);
      // The restored draft captures the same bytes and intent again.
      const again = captureEditor(restored);
      expect([...again.source]).toEqual([...source]);
      expect(again.document.lines[row]!.intendedKind).toBe(kind);
      // Without the metadata the same bytes open as Fountain reads them.
      const plain = createEditorState(source);
      expect(rows(plain)[row]).toBe(alone);
      expect(plain.doc.child(row).attrs.protected).toBe(false);
      // Metadata for other bytes is not adopted.
      expect(
        await verifiedEditorMetadata(
          [...bytes(original)],
          snapshot.draftMetadata,
        ),
      ).toBeUndefined();
    }
  });

  it('typing on in the recovered row drops the intent once Fountain agrees', async () => {
    const hey = await recovered(rewritten(open(cueLine), 1, '!hey'));
    const trimmed = erased(hey.restored, 1, 0, 1);
    expect(rows(trimmed)[1]).toBe('dialogue:hey');
    expect(saved(trimmed)).toBe('@BOB\nhey\n\nAfter.\n');
    expect(
      captureEditor(trimmed).document.lines[1]!.intendedKind,
    ).toBeUndefined();
    const dawn = await recovered(rewritten(open(headingBase), 0, "'TIL DAWN"));
    const hall = rewritten(dawn.restored, 0, 'HALL');
    expect(rows(hall)[0]).toBe('sceneHeading:HALL');
    expect(saved(hall)).toBe('.HALL\n\nAfter.\n');
    expect(captureEditor(hall).document.lines[0]!.intendedKind).toBeUndefined();
  });

  it('the caret in the row maps to the same byte and back', async () => {
    const state = caret(rewritten(open(cueLine), 1, '!hey'), 1, 2);
    const capture = captureEditor(state);
    const line = capture.document.lines[1]!;
    // `@BOB\n` is 5 bytes: `!hey` is bytes 5 to 9, then LF.
    expect([line.sourceStart, line.contentEnd, line.sourceEnd]).toEqual([
      5, 9, 10,
    ]);
    const anchor = {
      id: line.id,
      sourceIndex: 1,
      utf16Offset: 2,
      byteOffset: 7,
      graphemeIndex: 2,
      graphemeUtf16Offset: 0,
    };
    expect(capture.selection).toEqual({ anchor, head: anchor });
    const { restored, metadata } = await recovered(state);
    const selection = metadataSelection(restored, metadata);
    expect(selection).not.toBeNull();
    expect(selection!.head).toBe(at(restored, 1, 2));
    expect(selection!.$head.parent.type.name).toBe('dialogue');
    expect(selection!.$head.parent.textContent).toBe('!hey');
  });

  it('Undo and Redo capture the bytes and intent of each step', () => {
    let state = open(cueLine);
    state = state.apply(closeHistory(state.tr));
    state = typed(caret(state, 1, 0), '!');
    expect(saved(state)).toBe('@BOB\n!Hi.\n\nAfter.\n');
    expect(captureEditor(state).document.lines[1]!.intendedKind).toBe(
      'dialogue',
    );
    state = step(state, undo);
    expect(rows(state)[1]).toBe('dialogue:Hi.');
    expect(saved(state)).toBe(cueLine);
    expect(
      captureEditor(state).document.lines.some((line) => line.intendedKind),
    ).toBe(false);
    state = step(state, redo);
    expect(saved(state)).toBe('@BOB\n!Hi.\n\nAfter.\n');
    expect(captureEditor(state).document.lines[1]!.intendedKind).toBe(
      'dialogue',
    );
  });
});

describe('AUDIT-PARK-H-F4-04 the fallback row is an advisory, not a blocker', () => {
  it('Script Check names the row, the typed element and the element on disk', () => {
    const state = rewritten(open('@BOB\nOne.\nTwo.\n'), 2, '!hey');
    const report = evaluateScriptCheck(captureEditor(state).document);
    const advisory = report.issues.filter((issue) => issue.code === 'SC009');
    expect(advisory).toHaveLength(1);
    expect(advisory[0]).toMatchObject({
      severity: 'advisory',
      line: 2,
      endLine: 2,
      hasFix: false,
    });
    expect(advisory[0]!.message).toBe(
      'Row 3, Dialogue “!hey”, is saved as Action; the typed element is kept in recovery only.',
    );
    // An advisory never pauses saving or gates export review.
    expect(requiresExportReview(report)).toBe(false);
  });

  it('a `!` that orphans its cue keeps the cue warning', () => {
    const state = rewritten(open(cueLine), 1, '!hey');
    const report = evaluateScriptCheck(captureEditor(state).document);
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: 'SC001',
        severity: 'warning',
        message: 'Cue “BOB” has no dialogue.',
      }),
    );
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: 'SC009', severity: 'advisory' }),
    );
  });

  it('a heading saved as action carries the same advisory', () => {
    const state = rewritten(open(headingBase), 0, "'TIL DAWN");
    const report = evaluateScriptCheck(captureEditor(state).document);
    expect(
      report.issues
        .filter((issue) => issue.code === 'SC009')
        .map((issue) => issue.message),
    ).toEqual([
      "Row 1, Scene Heading “'TIL DAWN”, is saved as Action; the typed element is kept in recovery only.",
    ]);
    expect(requiresExportReview(report)).toBe(false);
  });

  it('the export gate treats the fallback rows as the action they are', () => {
    // A heading saved as action prints as action on both sides: no finding.
    const heading = rewritten(open('.HALL\n\nAfter.\n'), 0, "'TIL DAWN");
    const clean = evaluateExportAssessment(captureEditor(heading).document, {
      identity,
      version: 1,
      sourceSha256: 'a'.repeat(64),
    });
    expect(clean.status).toBe('verified');
    if (clean.status !== 'verified') return;
    expect(clean.issues).toEqual([]);
    // A `!` action where dialogue was breaks the speech paragraph the
    // profile reads, so export review still names the difference — as with
    // the F4-03 parenthesis rows. The advisory itself never blocks.
    for (const [original, row, absorb] of [
      ['@BOB\nHi.\n\nAfter.\n', 1, 1],
      ['@BOB\nOne.\nTwo.\n', 2, 2],
    ] as const) {
      const state = rewritten(open(original), row, '!hey');
      const assessment = evaluateExportAssessment(
        captureEditor(state).document,
        { identity, version: 1, sourceSha256: 'a'.repeat(64) },
      );
      expect(assessment.status).toBe('verified');
      if (assessment.status !== 'verified') continue;
      expect(assessment.issues).toEqual([
        expect.objectContaining({
          code: 'SC005',
          severity: 'blocking',
          line: 0,
          message: expect.stringContaining('separate speech paragraph'),
        }),
        expect.objectContaining({
          code: 'SC005',
          severity: 'blocking',
          line: absorb,
          message: expect.stringContaining('preceding speech paragraph'),
        }),
      ]);
    }
  });
});

describe('AUDIT-PARK-H-F4-04 shapes left refused', () => {
  it.each([
    ['dialogue', '@BOB\nHi.\n\nAfter.\n', 1, '@hey'],
    ['dialogue', '@BOB\nHi.\n\nAfter.\n', 1, '>hey'],
    ['dialogue', '@BOB\nHi.\n\nAfter.\n', 1, '~hey'],
    ['dialogue', '@BOB\nHi.\n\nAfter.\n', 1, '# hey'],
    ['dialogue', '@BOB\nHi.\n\nAfter.\n', 1, '=hey'],
    ['dialogue', '@BOB\nHi.\n\nAfter.\n', 1, '= hey'],
    ['dialogue', '@BOB\nHi.\n\nAfter.\n', 1, '==='],
    ['dialogue', '@BOB\nHi.\n\nAfter.\n', 1, '.hey'],
    ['dialogue', '@BOB\nHi.\n\nAfter.\n', 1, '>hey<'],
    ['dialogue', '@BOB\nHi.\n\nAfter.\n', 1, '{{hey}}'],
    ['dialogue', '@BOB\nOne.\nTwo.\n\nAfter.\n', 1, '!One.'],
    ['sceneHeading', '.HALL\n\nAfter.\n', 0, '@hey'],
    ['sceneHeading', '.HALL\n\nAfter.\n', 0, '>hey'],
    ['sceneHeading', '.HALL\n\nAfter.\n', 0, '# hey'],
    ['sceneHeading', '.HALL\n\nAfter.\n', 0, '=hey'],
    ['sceneHeading', '.HALL\n\nAfter.\n', 0, '==='],
    ['sceneHeading', '.HALL\n\nAfter.\n', 0, '.hey'],
    ['sceneHeading', '.HALL\n\nAfter.\n', 0, '(hey)'],
    ['sceneHeading', '.HALL\n\nAfter.\n', 0, '!hey'],
    ['sceneHeading', '.HALL\n\nAfter.\n', 0, ' !hey'],
    ['character', '@BOB\n\nAfter.\n', 0, 'BOB {{hi}}'],
    ['character', '@BOB\n\nAfter.\n', 0, 'BOB [[hi]]'],
    ['transition', '>CUT TO:\n\nAfter.\n', 0, '>THE END<'],
    ['transition', '>CUT TO:\n\nAfter.\n', 0, '{{hey}}'],
    ['section', '# Act\n\nAfter.\n', 0, ' Act'],
    ['synopsis', '= Sum\n\nAfter.\n', 0, ' Sum'],
  ] as const)('%s %j stays refused with its code', (kind, base, row, value) => {
    const error = refusal(() =>
      replaceLine(parseFountain(bytes(base)), row, { kind, text: value }),
    );
    expect(error.code).toBe('round-trip');
    expect(error.edit).toBe(0);
  });

  it('a parenthetical that does not open with `(` is still an invalid edit', () => {
    const error = refusal(() =>
      replaceLine(parseFountain(bytes('@BOB\n(beat)\nHi.\n')), 1, {
        kind: 'parenthetical',
        text: '!hey',
      }),
    );
    expect([error.code, error.message]).toEqual([
      'invalid-edit',
      'Parenthetical must begin with an opening parenthesis',
    ]);
  });

  it('a character cue that keeps its speech keeps its dual refusal', () => {
    const error = refusal(() =>
      replaceLine(parseFountain(bytes('@BOB\nHi.\n\nAfter.\n')), 0, {
        kind: 'character',
        text: 'BOB ^',
      }),
    );
    expect(error.code).toBe('round-trip');
  });

  it('a `!` that would end a speech mid-list pauses the whole draft', () => {
    const state = rewritten(open(speech), 1, '!One.');
    const error = refusal(() => captureEditor(state));
    expect(error.code).toBe('round-trip');
    // The typed row is named, before and after the fallback: a `!` action
    // ends the speech, and following rows the author did not touch are never
    // rewritten to keep it, so no drift expansion happens.
    expect(refusedRow(error)).toEqual({
      index: 1,
      kind: 'dialogue',
      text: '!One.',
    });
    // Nothing typed meanwhile reaches the file.
    expect(text(captureEditor(open(speech)).source)).toBe(speech);
  });

  it('dialogue outside a speech that opens with a parenthesis is unchanged', () => {
    const before = parseFountain(bytes('!Alpha.\n\n!Omega.\n'));
    const error = refusal(() =>
      replaceLine(before, 1, { kind: 'dialogue', text: '(laughs)' }),
    );
    expect(error.code).toBe('round-trip');
  });
});
