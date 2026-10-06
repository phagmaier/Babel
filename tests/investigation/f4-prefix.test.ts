import { describe, expect, it } from 'vitest';
import { closeHistory, redo, undo } from 'prosemirror-history';
import type { EditorState } from 'prosemirror-state';
import { sha256 } from '../../src/application/editorCapture';
import {
  editorRecovery,
  verifiedEditorMetadata,
} from '../../src/application/editorMetadata';
import {
  FountainEditError,
  parseFountain,
  replaceLine,
  serializeFountain,
} from '../../src/domain/fountainCodec';
import { captureEditor, refusedRow } from '../../src/editor/sourceBridge';
import {
  applyEditorTransaction,
  createEditorState,
} from '../../src/editor/state';

// AUDIT-PARK-H-F4-PREFIX: green characterization of an OPEN defect, not a
// repair. Run by name with tests/investigation/vitest.config.ts only.
const bytes = (source: string) => new TextEncoder().encode(source);
// The codec and JSDOM may construct typed arrays in different realms.
const expectBytes = (actual: Uint8Array, expected: Uint8Array) =>
  expect([...actual]).toEqual([...expected]);
const samples = [
  {
    name: 'LF',
    before: '@BOB\n(beat)\nHi.\n\n!After.\n',
    exact: '@BOB\nx (beat)\nHi.\n\n!After.\n',
  },
  {
    name: 'BOM/CRLF with an untouched unknown region',
    before:
      '\ufeff@BOB\r\n(beat)\r\nHi.\r\n\r\nopaque [[unknown]] tail\r\n!After.\r\n',
    exact:
      '\ufeff@BOB\r\nx (beat)\r\nHi.\r\n\r\nopaque [[unknown]] tail\r\n!After.\r\n',
  },
] as const;

function refusal(run: () => unknown) {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(FountainEditError);
    return error as FountainEditError;
  }
  throw new Error('Expected the currently open prefix refusal');
}

function historyStep(state: EditorState, command: typeof undo) {
  let after = state;
  expect(
    command(state, (transaction) => (after = state.apply(transaction))),
  ).toBe(true);
  return after;
}

describe('AUDIT-PARK-H-F4-PREFIX current mechanism boundary', () => {
  for (const sample of samples) {
    it(`${sample.name}: exact Dialogue control preserves source and every neighbor`, () => {
      const before = parseFountain(bytes(sample.before));
      const control = replaceLine(before, 1, {
        kind: 'dialogue',
        text: 'x (beat)',
      });
      expectBytes(serializeFountain(control), bytes(sample.exact));
      expectBytes(serializeFountain(before), bytes(sample.before));
      expect(control.lines[1]).toMatchObject({
        id: before.lines[1]!.id,
        kind: 'dialogue',
        text: 'x (beat)',
        sourceText: 'x (beat)',
        intendedKind: undefined,
        editable: true,
        speechOf: before.lines[0]!.id,
      });
      expect(control.lines).toHaveLength(before.lines.length);
      for (const [index, line] of before.lines.entries()) {
        if (index === 1) continue;
        // The only offset change is the two authored prefix bytes.
        const delta = index > 1 ? 2 : 0;
        expect(control.lines[index]).toEqual({
          ...line,
          sourceStart: line.sourceStart + delta,
          contentEnd: line.contentEnd + delta,
          sourceEnd: line.sourceEnd + delta,
        });
      }
      const plain = parseFountain(bytes(sample.exact));
      expect(plain.lines[1]).toMatchObject({
        kind: 'dialogue',
        text: 'x (beat)',
        speechOf: plain.lines[0]!.id,
        editable: true,
      });
      expect(plain.lines[2]).toMatchObject({
        kind: 'dialogue',
        text: 'Hi.',
        speechOf: plain.lines[0]!.id,
      });
      expectBytes(serializeFountain(plain), bytes(sample.exact));
      if (sample.name !== 'LF')
        expect(plain.lines[4]).toMatchObject({
          kind: 'raw',
          sourceText: 'opaque [[unknown]] tail',
          editable: false,
        });
    });

    it(`${sample.name}: accepted prefix typing refuses capture and survives Undo/Redo`, () => {
      let before = createEditorState(bytes(sample.before));
      before = before.apply(closeHistory(before.tr));
      const applied = applyEditorTransaction(
        before,
        before.tr.insertText('x ', 1 + before.doc.child(0).nodeSize),
      );
      expect(applied.accepted).toBe(true);
      const edited = applied.state;
      expect(edited.doc.child(1).type.name).toBe('parenthetical');
      expect(edited.doc.child(1).textContent).toBe('x (beat)');
      const document = edited.doc;
      const selection = edited.selection.toJSON();
      const error = refusal(() => captureEditor(edited));
      expect(edited.doc).toBe(document);
      expect(edited.selection.toJSON()).toEqual(selection);
      expect([error.code, error.message]).toEqual([
        'invalid-edit',
        'Parenthetical must begin with an opening parenthesis',
      ]);
      expect(refusedRow(error)).toEqual({
        index: 1,
        kind: 'parenthetical',
        text: 'x (beat)',
      });
      const original = historyStep(edited, undo);
      expectBytes(captureEditor(original).source, bytes(sample.before));
      const repeated = historyStep(original, redo);
      expect(repeated.doc.eq(edited.doc)).toBe(true);
      expect(refusedRow(refusal(() => captureEditor(repeated)))).toEqual(
        refusedRow(error),
      );
    });

    it(`${sample.name}: matching hash admits the envelope but not Parenthetical intent`, async () => {
      const source = bytes(sample.exact);
      const metadata = {
        schema: 'babel-editor-capture-v1',
        sourceSha256: await sha256(source),
        drafts: [{ index: 1, intendedKind: 'parenthetical' }],
      };
      const verified = await verifiedEditorMetadata([...source], metadata);
      expect(verified).toBeDefined();
      const recovery = editorRecovery(source, verified);
      expect(recovery?.lines[1]!.intendedKind).toBe('parenthetical');
      const rejected = parseFountain(source, recovery);
      expect(rejected.diagnostics.map(({ code }) => code)).toContain(
        'recovery-mismatch',
      );
      expect(rejected.lines[1]).toMatchObject({
        kind: 'dialogue',
        text: 'x (beat)',
      });
      expect(rejected.lines[1]!.intendedKind).toBeUndefined();
      expectBytes(serializeFountain(rejected), source);
      const reopened = createEditorState(source, recovery);
      expect(reopened.doc.child(1).type.name).toBe('dialogue');
      expect(reopened.doc.child(1).textContent).toBe('x (beat)');
      expectBytes(captureEditor(reopened).source, source);
      // The source hash still guards different bytes independently of intent.
      expect(
        await verifiedEditorMetadata([...bytes(sample.before)], metadata),
      ).toBeUndefined();
    });
  }

  it('the same existing metadata restores supported trailing Parenthetical text', async () => {
    const source = bytes('@BOB\n(beat) x\nHi.\n');
    const metadata = {
      schema: 'babel-editor-capture-v1',
      sourceSha256: await sha256(source),
      drafts: [{ index: 1, intendedKind: 'parenthetical' }],
    };
    const verified = await verifiedEditorMetadata([...source], metadata);
    const recovery = editorRecovery(source, verified);
    const restored = parseFountain(source, recovery);
    expect(restored.diagnostics.map(({ code }) => code)).not.toContain(
      'recovery-mismatch',
    );
    expect(restored.lines[1]).toMatchObject({
      kind: 'dialogue',
      text: '(beat) x',
      intendedKind: 'parenthetical',
    });
    const reopened = createEditorState(source, recovery);
    expect(reopened.doc.child(1).type.name).toBe('parenthetical');
    expect(reopened.doc.child(1).textContent).toBe('(beat) x');
    expectBytes(captureEditor(reopened).source, source);
  });
});
