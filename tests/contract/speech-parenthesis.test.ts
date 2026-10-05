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
import { evaluateScriptCheck } from '../../src/domain/scriptCheck';
import { captureEditor, refusedRow } from '../../src/editor/sourceBridge';
import {
  applyEditorTransaction,
  createEditorState,
} from '../../src/editor/state';

// AUDIT-PARK-H-F4-03: speech text that opens with a parenthesis saves exactly
// as typed. Where Fountain reads it as another speech element, the typed
// element is recovery-only intent. A line that merely begins with a closed
// parenthetical is no longer protected when a file is opened.
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
const speech = '@BOB\nOne.\nTwo.\n';
const aside = '@BOB\n(beat)\nHi.\n';

describe('AUDIT-PARK-H-F4-03 a line that begins with a closed parenthetical opens editable', () => {
  it.each([
    ['@BOB\n(laughs) Oh no.\n', 1, 'dialogue', '(laughs) Oh no.'],
    ['@BOB\n(a) (b)\nMore.\n', 1, 'dialogue', '(a) (b)'],
    ['@BOB\n   (laughs) Oh no.\n', 1, 'dialogue', '   (laughs) Oh no.'],
    ['@BOB\n(beat) x\nHi.\n', 1, 'dialogue', '(beat) x'],
    ['!Alpha.\n\n(laughs) Oh no.\n\n!Omega.\n', 2, 'action', '(laughs) Oh no.'],
    ['\ufeff@BOB\r\n(laughs) Oh no.\r\n', 1, 'dialogue', '(laughs) Oh no.'],
  ] as const)(
    '%j: same element, text and bytes, no diagnostic',
    (source, index, kind, value) => {
      const document = parseFountain(bytes(source));
      expect(document.lines[index]).toMatchObject({
        kind,
        text: value,
        editable: true,
      });
      expect(document.lines[index]!.intendedKind).toBeUndefined();
      expect(
        document.diagnostics.filter(
          (diagnostic) => diagnostic.code === 'malformed-parenthetical',
        ),
      ).toEqual([]);
      expect(text(serializeFountain(document))).toBe(source);
      const state = open(source);
      expect(state.doc.child(index).type.name).toBe(kind);
      expect(state.doc.child(index).attrs.protected).toBe(false);
      // Opening and capturing with no edit keeps every byte.
      expect(saved(state)).toBe(source);
    },
  );

  it('the row can be edited and saves as the same element', () => {
    const state = typed(caret(open('@BOB\n(laughs) Oh no.\n'), 1, -1), ' Why?');
    expect(rows(state)[1]).toBe('dialogue:(laughs) Oh no. Why?');
    expect(saved(state)).toBe('@BOB\n(laughs) Oh no. Why?\n');
    const action = typed(
      caret(open('!Alpha.\n\n(laughs) Oh no.\n\n!Omega.\n'), 2, -1),
      ' Why?',
    );
    // An edited Action row takes the codec's forced spelling, as any does.
    expect(saved(action)).toBe('!Alpha.\n\n!(laughs) Oh no. Why?\n\n!Omega.\n');
    // An edit elsewhere leaves an indented line's bytes alone.
    const indented = typed(
      caret(open('@BOB\n   (laughs) Oh no.\nMore.\n'), 2, -1),
      '!',
    );
    expect(saved(indented)).toBe('@BOB\n   (laughs) Oh no.\nMore.!\n');
  });

  it('an unclosed parenthesis stays protected, with its diagnostic and Script Check finding', () => {
    for (const [source, index] of [
      ['\n@ALICE\n(unclosed\nHello.\n', 2],
      ['!Alpha.\n\n(unclosed\n\n!Omega.\n', 2],
    ] as const) {
      const document = parseFountain(bytes(source));
      expect(document.lines[index]!.editable).toBe(false);
      expect(document.diagnostics).toContainEqual(
        expect.objectContaining({
          code: 'malformed-parenthetical',
          line: index,
        }),
      );
      expect(evaluateScriptCheck(document).issues).toContainEqual(
        expect.objectContaining({ code: 'SC002', line: index }),
      );
      expect(open(source).doc.child(index).attrs.protected).toBe(true);
    }
  });

  it('Script Check drops the protection finding; the export gate still names the profile difference', () => {
    const document = parseFountain(bytes('@BOB\n(laughs) Oh no.\n'));
    expect(evaluateScriptCheck(document).issues).toEqual([]);
    const assessment = evaluateExportAssessment(document, {
      identity,
      version: 1,
      sourceSha256: 'a'.repeat(64),
    });
    expect(assessment.status).toBe('verified');
    if (assessment.status !== 'verified') return;
    expect(assessment.issues).toEqual([
      expect.objectContaining({
        code: 'SC005',
        severity: 'blocking',
        line: 1,
        message: expect.stringContaining(
          'treats a speech line that starts with “(”',
        ),
      }),
    ]);
  });
});

describe('AUDIT-PARK-H-F4-03 the codec keeps the typed speech element as intent', () => {
  it('Dialogue that Fountain reads as a parenthetical is written exactly', () => {
    for (const value of ['(laughs)', '(laughs) ', ' (laughs)', '(a (b)']) {
      const before = parseFountain(bytes(speech));
      const after = replaceLine(before, 1, { kind: 'dialogue', text: value });
      expect(text(serializeFountain(after))).toBe(`@BOB\n${value}\nTwo.\n`);
      expect(after.lines[1]).toMatchObject({
        id: before.lines[1]!.id,
        kind: 'parenthetical',
        intendedKind: 'dialogue',
        sourceText: value,
        text: value,
        editable: true,
        speechOf: before.lines[0]!.id,
      });
      expect(after.lines[2]).toMatchObject({ kind: 'dialogue', text: 'Two.' });
      expect(after.diagnostics).toContainEqual(
        expect.objectContaining({ code: 'draft-intent', line: 1 }),
      );
      // Read alone, the bytes are Fountain's parenthetical.
      expect(parseFountain(serializeFountain(after)).lines[1]).toMatchObject({
        kind: 'parenthetical',
        text: value.trim(),
        editable: true,
      });
    }
  });

  it('a Parenthetical with text after its closing parenthesis is written exactly', () => {
    for (const [value, kind] of [
      ['(beat) x', 'dialogue'],
      ['(beat) (again)', 'dialogue'],
      ['(beat) ', 'parenthetical'],
      ['(beat)\t', 'parenthetical'],
    ] as const) {
      const before = parseFountain(bytes(aside));
      const after = replaceLine(before, 1, {
        kind: 'parenthetical',
        text: value,
      });
      expect(text(serializeFountain(after))).toBe(`@BOB\n${value}\nHi.\n`);
      expect(after.lines[1]).toMatchObject({
        id: before.lines[1]!.id,
        kind,
        intendedKind: 'parenthetical',
        sourceText: value,
        text: value,
        editable: true,
      });
      expect(after.lines[2]).toMatchObject({ kind: 'dialogue', text: 'Hi.' });
    }
  });

  it('an ordinary row carries no intent', () => {
    const before = parseFountain(bytes(aside));
    for (const [index, edit] of [
      [1, { kind: 'parenthetical', text: '(pause)' }],
      [2, { kind: 'dialogue', text: '(laughs) Oh no.' }],
      [2, { kind: 'dialogue', text: 'Said (softly) then.' }],
    ] as const) {
      const after = replaceLine(before, index, edit);
      expect(after.lines[index]).toMatchObject({ ...edit, editable: true });
      expect(after.lines[index]!.intendedKind).toBeUndefined();
    }
  });

  it('exact recovery restores the element and text; a mismatched intent is ignored', () => {
    for (const [source, edit, alone] of [
      [speech, { kind: 'dialogue', text: ' (laughs) ' }, 'parenthetical'],
      [aside, { kind: 'parenthetical', text: '(beat) x' }, 'dialogue'],
      [aside, { kind: 'parenthetical', text: '(beat) ' }, 'parenthetical'],
    ] as const) {
      const after = replaceLine(parseFountain(bytes(source)), 1, edit);
      const restored = parseFountain(serializeFountain(after), after.recovery);
      expect(restored.diagnostics.map(({ code }) => code)).not.toContain(
        'recovery-mismatch',
      );
      expect(restored.lines[1]).toMatchObject({
        id: after.lines[1]!.id,
        kind: alone,
        intendedKind: edit.kind,
        text: edit.text,
        editable: true,
      });
      // The same line cannot be claimed as a heading or a cue.
      for (const intendedKind of ['sceneHeading', 'character'] as const) {
        const forged: FountainRecovery = {
          ...after.recovery,
          lines: after.recovery.lines.map((line, index) =>
            index === 1 ? { ...line, intendedKind } : line,
          ),
        };
        expect(
          parseFountain(serializeFountain(after), forged).diagnostics.map(
            ({ code }) => code,
          ),
        ).toContain('recovery-mismatch');
      }
    }
    // Parenthetical intent needs the line to open with its parenthesis.
    const plain = parseFountain(bytes(speech));
    const claimed: FountainRecovery = {
      ...plain.recovery,
      lines: plain.recovery.lines.map((line, index) =>
        index === 1 ? { ...line, intendedKind: 'parenthetical' } : line,
      ),
    };
    expect(
      parseFountain(bytes(speech), claimed).diagnostics.map(({ code }) => code),
    ).toContain('recovery-mismatch');
  });

  it('a row read alone under a cue counts as spelled, as capture now writes it', () => {
    expect(spellsAlone({ kind: 'dialogue', text: '(laughs)' }, true)).toBe(
      true,
    );
    expect(spellsAlone({ kind: 'dialogue', text: ' (laughs) ' }, true)).toBe(
      true,
    );
    expect(spellsAlone({ kind: 'parenthetical', text: '(beat) x' }, true)).toBe(
      true,
    );
    expect(spellsAlone({ kind: 'parenthetical', text: '(beat) ' }, true)).toBe(
      true,
    );
    expect(spellsAlone({ kind: 'parenthetical', text: 'x (beat)' }, true)).toBe(
      false,
    );
    // Outside a speech Fountain reads the text as Action.
    expect(spellsAlone({ kind: 'dialogue', text: '(laughs)' }, false)).toBe(
      false,
    );
  });
});

describe('AUDIT-PARK-H-F4-03 the editor saves speech that opens with a parenthesis', () => {
  it('every keystroke of a Dialogue row saves the text typed so far', () => {
    let state = caret(rewritten(open(speech), 1, '('), 1, -1);
    let value = '(';
    expect(saved(state)).toBe('@BOB\n(\nTwo.\n');
    for (const character of 'laughs) Oh no.') {
      state = typed(state, character);
      value += character;
      expect(rows(state)[1]).toBe(`dialogue:${value}`);
      expect(saved(state)).toBe(`@BOB\n${value}\nTwo.\n`);
    }
    const lines = captureEditor(state).document.lines;
    expect(lines[1]).toMatchObject({ kind: 'dialogue', editable: true });
    expect(lines.some((line) => line.intendedKind)).toBe(false);
  });

  it('every keystroke after a closed Parenthetical saves the text typed so far', () => {
    let state = caret(open(aside), 1, -1);
    let value = '(beat)';
    for (const character of ' and then') {
      state = typed(state, character);
      value += character;
      expect(rows(state)[1]).toBe(`parenthetical:${value}`);
      expect(saved(state)).toBe(`@BOB\n${value}\nHi.\n`);
      expect(captureEditor(state).document.lines[1]!.intendedKind).toBe(
        'parenthetical',
      );
    }
  });

  it('text typed elsewhere is captured with the row', () => {
    const state = typed(
      caret(rewritten(open('@BOB\nOne.\n\n!Act.\n'), 1, '(laughs)'), 3, -1),
      ' More.',
    );
    expect(saved(state)).toBe('@BOB\n(laughs)\n\n!Act. More.\n');
  });

  it('sparse hash-bound metadata recovers the element and the exact text', async () => {
    for (const [original, value, kind, alone] of [
      [speech, '(laughs)', 'dialogue', 'parenthetical:(laughs)'],
      [speech, ' (laughs) ', 'dialogue', 'parenthetical:(laughs)'],
      [aside, '(beat) x', 'parenthetical', 'dialogue:(beat) x'],
      [aside, '(beat) ', 'parenthetical', 'parenthetical:(beat)'],
    ] as const) {
      const state = rewritten(open(original), 1, value);
      const { snapshot, source, restored } = await recovered(state);
      expect(snapshot.draftMetadata).toMatchObject({
        schema: 'babel-editor-capture-v1',
        drafts: [{ index: 1, intendedKind: kind }],
      });
      expect(rows(restored)).toEqual(rows(state));
      expect(restored.doc.child(1).type.name).toBe(kind);
      expect(restored.doc.child(1).attrs).toMatchObject({
        id: state.doc.child(1).attrs.id,
        speechOf: state.doc.child(0).attrs.id,
        protected: false,
      });
      // The restored draft captures the same bytes and intent again.
      const again = captureEditor(restored);
      expect([...again.source]).toEqual([...source]);
      expect(again.document.lines[1]!.intendedKind).toBe(kind);
      // Without the metadata the same bytes open as Fountain reads them.
      const plain = createEditorState(source);
      expect(rows(plain)[1]).toBe(alone);
      expect(plain.doc.child(1).attrs.protected).toBe(false);
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
    const spoken = await recovered(rewritten(open(speech), 1, '(laughs)'));
    const more = typed(caret(spoken.restored, 1, -1), ' Oh no.');
    expect(rows(more)[1]).toBe('dialogue:(laughs) Oh no.');
    expect(saved(more)).toBe('@BOB\n(laughs) Oh no.\nTwo.\n');
    expect(captureEditor(more).document.lines[1]!.intendedKind).toBeUndefined();
    const beat = await recovered(rewritten(open(aside), 1, '(beat) x'));
    const trimmed = erased(beat.restored, 1, -3, -1);
    expect(rows(trimmed)[1]).toBe('parenthetical:(beat)');
    expect(saved(trimmed)).toBe(aside);
    expect(
      captureEditor(trimmed).document.lines[1]!.intendedKind,
    ).toBeUndefined();
  });

  it('the caret in the row maps to the same byte and back', async () => {
    const original = '\ufeff@BOB\r\nOne.\r\nTwo.\r\n';
    const state = caret(rewritten(open(original), 1, ' (é) '), 1, 3);
    const capture = captureEditor(state);
    const line = capture.document.lines[1]!;
    // BOM 3, `@BOB\r\n` 6: ` (é) ` is bytes 9 to 14, then CRLF.
    expect([line.sourceStart, line.contentEnd, line.sourceEnd]).toEqual([
      9, 15, 17,
    ]);
    const anchor = {
      id: line.id,
      sourceIndex: 1,
      utf16Offset: 3,
      byteOffset: 13,
      graphemeIndex: 3,
      graphemeUtf16Offset: 0,
    };
    expect(capture.selection).toEqual({ anchor, head: anchor });
    const { restored, metadata } = await recovered(state);
    const selection = metadataSelection(restored, metadata);
    expect(selection).not.toBeNull();
    expect(selection!.head).toBe(at(restored, 1, 3));
    expect(selection!.$head.parent.type.name).toBe('dialogue');
    expect(selection!.$head.parent.textContent).toBe(' (é) ');
  });

  it('Undo and Redo capture the bytes and intent of each step', () => {
    let state = open(aside);
    state = state.apply(closeHistory(state.tr));
    state = typed(caret(state, 1, -1), ' x');
    expect(saved(state)).toBe('@BOB\n(beat) x\nHi.\n');
    state = step(state, undo);
    expect(rows(state)[1]).toBe('parenthetical:(beat)');
    expect(saved(state)).toBe(aside);
    expect(
      captureEditor(state).document.lines.some((line) => line.intendedKind),
    ).toBe(false);
    state = step(state, redo);
    expect(saved(state)).toBe('@BOB\n(beat) x\nHi.\n');
    expect(captureEditor(state).document.lines[1]!.intendedKind).toBe(
      'parenthetical',
    );
  });

  it('an emptied row above such a row keeps the speech and saves both', () => {
    let state = rewritten(open('@BOB\nOne.\nTwo.\nThree.\n'), 3, '(laughs)');
    state = erased(state, 1, 0, -1);
    expect(rows(state)).toEqual([
      'character:BOB',
      'dialogue:',
      'dialogue:Two.',
      'dialogue:(laughs)',
    ]);
    expect(saved(state)).toBe('@BOB\n  \nTwo.\n(laughs)\n');
    expect(
      captureEditor(state).document.lines.map((line) => line.intendedKind),
    ).toEqual([undefined, 'dialogue', undefined, 'dialogue']);
  });
});

describe('AUDIT-PARK-H-F4-03 shapes left refused', () => {
  it('a Parenthetical whose text does not open with its parenthesis names that row', () => {
    for (const [value, from] of [
      ['x (beat)', 0],
      [' (beat)', 0],
    ] as const) {
      const state = typed(caret(open(aside), 1, from), value.slice(0, -6));
      expect(rows(state)[1]).toBe(`parenthetical:${value}`);
      const error = refusal(() => captureEditor(state));
      expect([error.code, error.message]).toEqual([
        'invalid-edit',
        'Parenthetical must begin with an opening parenthesis',
      ]);
      expect(refusedRow(error)).toEqual({
        index: 1,
        kind: 'parenthetical',
        text: value,
      });
    }
  });

  it('an imported unclosed parenthesis cannot be owned by an edit beside it', () => {
    const state = erased(open('@BOB\nOne.\n(beat\n'), 1, 0, -1);
    const drift = refusal(() => captureEditor(state));
    expect([drift.code, drift.line, refusedRow(drift)]).toEqual([
      'neighbor-drift',
      2,
      undefined,
    ]);
  });

  it('Dialogue outside a speech that opens with a parenthesis is unchanged', () => {
    // No cue: Fountain reads the text as Action, and no intent fits that.
    const before = parseFountain(bytes('!Alpha.\n\n!Omega.\n'));
    const error = refusal(() =>
      replaceLine(before, 2, { kind: 'dialogue', text: '(laughs)' }),
    );
    expect(error.code).toBe('round-trip');
  });
});
