import type { EditorState } from 'prosemirror-state';
import { replaceLines, serializeFountain } from '../domain/fountainCodec';
import { richView, sourceForInline } from '../domain/fountainInline';
import type {
  EditableKind,
  FountainDocument,
  FountainLine,
  LineEdit,
  StyledText,
} from '../domain/fountainModel';
import { editorOrigin, editorVersion, nodeRuns } from './state';

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
function extractedStart(line: FountainLine): number {
  if (line.sourceText === line.text) return 0;
  let from = line.sourceText.length - line.sourceText.trimStart().length;
  if (line.kind === 'title') {
    from = line.sourceText.indexOf(':') + 1;
    if (/[ \t]/.test(line.sourceText[from] ?? '')) from++;
  } else if (line.marker && line.kind !== 'pageBreak') {
    from += line.marker === '><' ? 1 : line.marker.length;
    if (line.kind === 'section' || line.kind === 'synopsis')
      while (from < line.sourceText.length && /\s/.test(line.sourceText[from]!))
        from++;
  }
  return line.text ? line.sourceText.indexOf(line.text, from) : from;
}
export interface EditorAnchor {
  readonly id: string;
  readonly sourceIndex: number;
  readonly utf16Offset: number;
  readonly byteOffset: number;
  readonly graphemeIndex: number;
  readonly graphemeUtf16Offset: number;
}
export interface EditorCapture {
  readonly version: number;
  readonly source: Uint8Array;
  readonly document: FountainDocument;
  readonly ranges: readonly {
    readonly id: string;
    readonly from: number;
    readonly to: number;
  }[];
  readonly selection: {
    readonly anchor: EditorAnchor;
    readonly head: EditorAnchor;
  } | null;
}

function sameRuns(a: readonly StyledText[], b: readonly StyledText[]) {
  return JSON.stringify(richView(a)) === JSON.stringify(richView(b));
}

/** Explicit deferred capture only. Live content comes from state.doc, never a source peer. */
export function captureEditor(state: EditorState): EditorCapture {
  const original = editorOrigin(state).document;
  let document = original;
  const edits: { index: number; edit: LineEdit }[] = [];
  state.doc.forEach((node, _position, index) => {
    const prior = original.lines[index];
    if (!prior && !node.textContent) return; // Empty virtual placeholder has no portable row.
    if (node.attrs.protected) return;
    const runs = nodeRuns(node);
    const previous = prior?.inline?.complete
      ? prior.inline.runs
      : [{ text: prior?.text ?? '', styles: [] }];
    if (sameRuns(runs, previous)) return;
    edits.push({
      index,
      edit: {
        kind: node.type.name as EditableKind,
        text: node.attrs.literal ? node.textContent : sourceForInline(runs),
        ...(node.attrs.actionSubtype === 'shot'
          ? { actionSubtype: 'shot' as const }
          : {}),
      },
    });
  });
  // Adjacent changed rows own one grammar context. Separate ranges cannot silently own protected text.
  for (let at = 0; at < edits.length;) {
    const first = at;
    while (
      at + 1 < edits.length &&
      edits[at + 1]!.index === edits[at]!.index + 1
    )
      at++;
    const from = edits[first]!.index;
    const replacements = edits.slice(first, at + 1).map(({ edit }) => edit);
    document = replaceLines(
      document,
      from,
      original.lines.length ? replacements.length : 0,
      replacements,
    );
    at++;
  }
  const bytes = serializeFountain(document);
  const anchor = (position: number): EditorAnchor => {
    const resolved = state.doc.resolve(position);
    const index = Math.min(resolved.index(0), state.doc.childCount - 1);
    const node = state.doc.child(index);
    const offset = resolved.depth
      ? resolved.parentOffset
      : position === state.doc.content.size
        ? node.textContent.length
        : 0;
    const text = node.textContent;
    const prefix = text.slice(0, offset);
    if (decoder.decode(encoder.encode(prefix)) !== prefix)
      throw new Error('Caret splits a Unicode scalar');
    const graphemes = [...segmenter.segment(text)].map(
      (segment) => segment.index,
    );
    graphemes.push(text.length);
    let graphemeIndex = 0;
    while (
      graphemeIndex + 1 < graphemes.length &&
      graphemes[graphemeIndex + 1]! <= offset
    )
      graphemeIndex++;
    const line = document.lines[index];
    let byteOffset = document.bom ? 3 : 0;
    if (line) {
      const contentStart = extractedStart(line);
      if (contentStart < 0)
        throw new Error('Cannot locate extracted source content');
      let sourceOffset = offset;
      if (!node.attrs.literal && line.inline?.complete) {
        // Map decoded text through retained delimiters and backslash escapes.
        let visible = 0;
        sourceOffset = line.text.length;
        for (const run of line.inline.runs) {
          if (offset > visible + run.text.length) {
            visible += run.text.length;
            continue;
          }
          let at = run.start;
          let remaining = offset - visible;
          while (remaining > 0) {
            if (
              line.text[at] === '\\' &&
              /[\\*_[\]]/.test(line.text[at + 1] ?? '')
            )
              at++;
            const scalar = String.fromCodePoint(line.text.codePointAt(at)!);
            at += scalar.length;
            remaining -= scalar.length;
          }
          sourceOffset = at;
          break;
        }
      }
      byteOffset =
        line.sourceStart +
        encoder.encode(line.sourceText.slice(0, contentStart + sourceOffset))
          .length;
    }
    return Object.freeze({
      id: String(node.attrs.id),
      sourceIndex: index,
      utf16Offset: offset,
      byteOffset,
      graphemeIndex,
      graphemeUtf16Offset: offset - graphemes[graphemeIndex]!,
    });
  };
  return Object.freeze({
    version: editorVersion(state),
    get source() {
      return bytes.slice();
    },
    document,
    ranges: Object.freeze(
      document.lines.map((line, index) =>
        Object.freeze({
          id: String(state.doc.child(index).attrs.id),
          from: line.sourceStart,
          to: line.sourceEnd,
        }),
      ),
    ),
    selection: original.readOnlyReason
      ? null
      : Object.freeze({
          anchor: anchor(state.selection.anchor),
          head: anchor(state.selection.head),
        }),
  });
}

/** A refusal still has reviewable current text/styles plus an exact original byte copy. */
export function copyEditorDraft(state: EditorState) {
  const original = serializeFountain(editorOrigin(state).document);
  const rows: { id: string; kind: string; runs: readonly StyledText[] }[] = [];
  state.doc.forEach((node) =>
    rows.push(
      Object.freeze({
        id: String(node.attrs.id),
        kind: node.type.name,
        runs: Object.freeze(
          nodeRuns(node).map((run) =>
            Object.freeze({
              text: run.text,
              styles: Object.freeze([...run.styles]),
            }),
          ),
        ),
      }),
    ),
  );
  return Object.freeze({
    version: editorVersion(state),
    get originalSource() {
      return original.slice();
    },
    rows: Object.freeze(rows),
  });
}
