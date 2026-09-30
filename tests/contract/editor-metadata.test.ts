import { describe, expect, it } from 'vitest';
import type { JsonValue } from '../../src/application/documents';
import { createEditorState } from '../../src/editor/state';
import { EditorCaptureBoundary } from '../../src/application/editorCapture';
import {
  editorRecovery,
  metadataSelection,
  verifiedEditorMetadata,
} from '../../src/application/editorMetadata';

const bytes = new TextEncoder().encode('!A **bright** bell.\r\n@\r\n\r\n');
describe('source-bound sparse recovery metadata', () => {
  it('restores incomplete row intent, shot intent and a backward rich-text selection', async () => {
    const original = createEditorState(bytes);
    const captured = (await new EditorCaptureBoundary(() => original).capture())
      .snapshot;
    const metadata: JsonValue = {
      ...(captured.draftMetadata as object),
      drafts: [
        { index: 0, actionSubtype: 'shot' },
        { index: 1, intendedKind: 'character' },
      ],
      selection: {
        anchor: { sourceIndex: 0, utf16Offset: 12 },
        head: { sourceIndex: 0, utf16Offset: 2 },
      },
    };
    const verified = await verifiedEditorMetadata(Array.from(bytes), metadata);
    const restored = createEditorState(bytes, editorRecovery(bytes, verified));
    expect(restored.doc.child(0).attrs.actionSubtype).toBe('shot');
    expect(restored.doc.child(1).type.name).toBe('character');
    const selection = metadataSelection(restored, verified)!;
    expect(selection.anchor).toBe(13);
    expect(selection.head).toBe(3);
    const exact = (await new EditorCaptureBoundary(() => restored).capture())
      .snapshot;
    expect(exact.source).toEqual(Array.from(bytes));
    expect(exact.draftMetadata).toMatchObject({
      drafts: [
        { index: 0, actionSubtype: 'shot' },
        { index: 1, intendedKind: 'character' },
      ],
    });
  });
  it('ignores stale, foreign and malformed intent without altering source', async () => {
    expect(
      await verifiedEditorMetadata(Array.from(bytes), {
        schema: 'babel-editor-capture-v1',
        sourceSha256: '0'.repeat(64),
        drafts: [],
      }),
    ).toBeUndefined();
    expect(
      await verifiedEditorMetadata(Array.from(bytes), {
        schema: 'another-producer',
        sourceSha256: '0'.repeat(64),
      }),
    ).toBeUndefined();
    expect(
      editorRecovery(bytes, {
        drafts: [{ index: 999, intendedKind: 'character' }],
      }),
    ).toBeUndefined();
    expect(
      editorRecovery(bytes, { drafts: [{ index: 0, intendedKind: 'script' }] }),
    ).toBeUndefined();
  });
  it('clamps caret metadata without splitting a surrogate pair', () => {
    const state = createEditorState(new TextEncoder().encode('!😃 ok\n'));
    const selection = metadataSelection(state, {
      selection: {
        anchor: { sourceIndex: 0, utf16Offset: 1 },
        head: { sourceIndex: 0, utf16Offset: 999 },
      },
    })!;
    expect(selection.anchor).toBe(1);
    expect(selection.head).toBe(6);
    expect(
      metadataSelection(state, {
        selection: { anchor: { sourceIndex: -1, utf16Offset: 0 }, head: null },
      }),
    ).toBeNull();
  });
});
