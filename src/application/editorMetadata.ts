/** Sparse editor intent is accepted only for the exact source hash. */
import { TextSelection, type EditorState } from 'prosemirror-state';
import { parseFountain } from '../domain/fountainCodec';
import type { DraftKind, FountainRecovery } from '../domain/fountainModel';
import type { JsonValue } from './documents';
import { sha256 } from './editorCapture';

function record(
  value: JsonValue | undefined,
): value is { readonly [key: string]: JsonValue } {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export async function verifiedEditorMetadata(
  source: readonly number[],
  metadata?: JsonValue,
): Promise<JsonValue | undefined> {
  if (!record(metadata) || metadata.schema !== 'babel-editor-capture-v1')
    return undefined;
  const hash = await sha256(Uint8Array.from(source));
  return metadata.sourceSha256 === hash ? metadata : undefined;
}

export function editorRecovery(
  bytes: Uint8Array,
  metadata?: JsonValue,
): FountainRecovery | undefined {
  if (!record(metadata) || !Array.isArray(metadata.drafts)) return undefined;
  const parsed = parseFountain(bytes);
  const drafts = new Map<
    number,
    { intendedKind?: DraftKind; actionSubtype?: 'shot' }
  >();
  for (const item of metadata.drafts) {
    if (
      !record(item) ||
      !Number.isSafeInteger(item.index) ||
      typeof item.index !== 'number' ||
      item.index < 0 ||
      item.index >= parsed.lines.length ||
      drafts.has(item.index)
    )
      return undefined;
    const intendedKind = item.intendedKind;
    const actionSubtype = item.actionSubtype;
    if (
      (intendedKind !== undefined &&
        ![
          'sceneHeading',
          'character',
          'dialogue',
          'parenthetical',
          // AUDIT-PARK-H-F4-04: transition fallback intent.
          'transition',
        ].includes(String(intendedKind))) ||
      (actionSubtype !== undefined && actionSubtype !== 'shot')
    )
      return undefined;
    drafts.set(item.index, {
      ...(intendedKind ? { intendedKind: intendedKind as DraftKind } : {}),
      ...(actionSubtype ? { actionSubtype } : {}),
    });
  }
  return {
    ...parsed.recovery,
    lines: parsed.recovery.lines.map((line, index) => ({
      ...line,
      ...drafts.get(index),
    })),
  };
}

export function metadataSelection(
  state: EditorState,
  metadata?: JsonValue,
): TextSelection | null {
  if (!record(metadata)) return null;
  const selection = metadata.selection;
  if (!record(selection)) return null;
  const position = (value: JsonValue | undefined) => {
    if (
      !record(value) ||
      typeof value.sourceIndex !== 'number' ||
      typeof value.utf16Offset !== 'number' ||
      !Number.isSafeInteger(value.sourceIndex) ||
      !Number.isSafeInteger(value.utf16Offset) ||
      value.sourceIndex < 0 ||
      value.utf16Offset < 0 ||
      value.sourceIndex >= state.doc.childCount
    )
      return null;
    let start = 1;
    for (let index = 0; index < value.sourceIndex; index++)
      start += state.doc.child(index).nodeSize;
    const text = state.doc.child(value.sourceIndex).textContent;
    let offset = Math.min(value.utf16Offset, text.length);
    if (
      offset &&
      /[\uD800-\uDBFF]/.test(text[offset - 1]!) &&
      /[\uDC00-\uDFFF]/.test(text[offset] ?? '')
    )
      offset--;
    return start + offset;
  };
  const anchor = position(selection.anchor),
    head = position(selection.head);
  return anchor === null || head === null
    ? null
    : TextSelection.create(state.doc, anchor, head);
}
