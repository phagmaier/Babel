import type { EditorState } from 'prosemirror-state';
import type { Node as EditorNode } from 'prosemirror-model';
import {
  FountainEditError,
  replaceKnownSourceContext,
  replaceLines,
  serializeFountain,
} from '../domain/fountainCodec';
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
function originRuns(
  node: EditorNode,
  line?: FountainLine,
): readonly StyledText[] {
  return !node.attrs.literal && line?.inline?.complete
    ? line.inline.runs
    : [{ text: line?.text ?? '', styles: [] }];
}

function editForNode(node: EditorNode, prior?: FountainLine): LineEdit {
  const runs = nodeRuns(node);
  const priorRuns = originRuns(node, prior);
  const unchanged = prior && sameRuns(runs, priorRuns);
  const kind =
    node.type.name === 'action' &&
    !node.textContent &&
    (!prior || prior.kind === 'blank')
      ? 'blank'
      : node.type.name;
  return {
    kind: kind as EditableKind,
    text: unchanged
      ? prior.text
      : node.attrs.literal
        ? node.textContent
        : sourceForInline(runs),
    ...(node.attrs.sceneNumber
      ? { sceneNumber: node.attrs.sceneNumber as string }
      : {}),
    ...(node.attrs.sectionLevel
      ? { sectionLevel: node.attrs.sectionLevel as number }
      : {}),
    ...(kind === 'action'
      ? {
          actionSubtype:
            node.attrs.actionSubtype === 'shot' ? ('shot' as const) : null,
        }
      : {}),
  };
}

function matchingOrigin(node: EditorNode, line: FountainLine | undefined) {
  if (!line || node.attrs.id !== line.id) return false;
  const kind =
    line.intendedKind ?? (line.kind === 'blank' ? 'action' : line.kind);
  return (
    node.type.name === kind &&
    (node.attrs.actionSubtype ?? null) === (line.actionSubtype ?? null)
  );
}
function sameSourceRow(node: EditorNode, line: FountainLine | undefined) {
  return (
    matchingOrigin(node, line) &&
    sameRuns(nodeRuns(node), originRuns(node, line))
  );
}

/** Explicit deferred capture only. Live content comes from state.doc, never a source peer. */
export function captureEditor(state: EditorState): EditorCapture {
  const original = editorOrigin(state).document;
  let document = original;
  // A closed note owns its full source region, including literal delimiters.
  for (const originalRegion of [...original.hiddenRegions].reverse()) {
    if (
      originalRegion.kind !== 'note' ||
      !originalRegion.closed ||
      originalRegion.ambiguous ||
      original.lines
        .slice(originalRegion.from, originalRegion.from + originalRegion.count)
        .some((line) => line.kind !== 'note')
    )
      continue;
    const noteRows = state.doc.content.content.filter(
      (node) =>
        node.type.name === 'note' && node.attrs.hiddenOf === originalRegion.id,
    );
    const oldRows = original.lines.slice(
      originalRegion.from,
      originalRegion.from + originalRegion.count,
    );
    if (
      noteRows.length === oldRows.length &&
      noteRows.every(
        (node, index) =>
          node.attrs.id === oldRows[index]!.id &&
          node.textContent === oldRows[index]!.text,
      )
    )
      continue;
    const region = document.hiddenRegions.find(
      (candidate) => candidate.id === originalRegion.id,
    );
    if (!region || noteRows.length === 0)
      throw new FountainEditError(
        'unrepresentable',
        'A note region lost its owned rows',
      );
    document = replaceKnownSourceContext(
      document,
      region.from,
      region.count,
      noteRows.map((node) => ({
        source: node.textContent,
        kind: 'note' as const,
        text: node.textContent,
      })),
      noteRows.map((node) => String(node.attrs.id)),
    );
  }
  // Newly authored hidden conversions own a complete, contiguous set of existing rows.
  // Reuse the codec's checked concrete transaction; no unverified syntax enters a capture.
  const hiddenGroups = new Map<string, EditorNode[]>();
  for (const node of state.doc.content.content) {
    if (
      typeof node.attrs.hiddenOf === 'string' &&
      node.attrs.hiddenOf.startsWith('editor-hidden:')
    ) {
      const group = hiddenGroups.get(node.attrs.hiddenOf) ?? [];
      group.push(node);
      hiddenGroups.set(node.attrs.hiddenOf, group);
    }
  }
  for (const rows of [...hiddenGroups.values()].reverse()) {
    const from =
      document.lines.length === 0
        ? 0
        : document.lines.findIndex((line) => line.id === rows[0]!.attrs.id);
    const priorIndices = rows
      .map((node) =>
        document.lines.findIndex((line) => line.id === node.attrs.id),
      )
      .filter((index) => index >= 0);
    if (
      from < 0 ||
      priorIndices.some((index, offset) => index !== from + offset)
    )
      throw new FountainEditError(
        'unrepresentable',
        'Hidden conversion lost its contiguous source ownership',
      );
    if (
      rows.every((node, offset) =>
        sameSourceRow(node, document.lines[from + offset]),
      )
    )
      continue;
    document = replaceKnownSourceContext(
      document,
      from,
      priorIndices.length,
      rows.map((node) => ({
        source: node.textContent,
        text: node.textContent,
        kind: node.type.name as 'note' | 'boneyard',
      })),
      rows.map((node) => String(node.attrs.id)),
    );
  }
  const base = document;
  const structural =
    (state.doc.childCount !== base.lines.length && base.lines.length !== 0) ||
    state.doc.content.content.some(
      (node, index) =>
        base.lines[index] && !matchingOrigin(node, base.lines[index]),
    );
  if (structural || (base.lines.length === 0 && state.doc.childCount > 1)) {
    const rows = state.doc.content.content;
    const byId = new Map(
      rows.map((node, index) => [node.attrs.id as string, index]),
    );
    const anchors = [{ old: -1, next: -1 }];
    for (const [index, line] of base.lines.entries()) {
      const next = byId.get(line.id);
      if (next === undefined || !rows[next]!.attrs.protected) continue;
      if (!sameSourceRow(rows[next]!, line) || next <= anchors.at(-1)!.next)
        throw new FountainEditError(
          'protected-region',
          'Protected row identity or order changed',
        );
      anchors.push({ old: index, next });
    }
    anchors.push({ old: base.lines.length, next: rows.length });
    for (let segment = anchors.length - 2; segment >= 0; segment--) {
      const lower = anchors[segment]!;
      const upper = anchors[segment + 1]!;
      let from = lower.old + 1;
      let newFrom = lower.next + 1;
      let oldEnd = upper.old;
      let newEnd = upper.next;
      while (
        from < oldEnd &&
        newFrom < newEnd &&
        sameSourceRow(rows[newFrom]!, base.lines[from])
      ) {
        from++;
        newFrom++;
      }
      while (
        oldEnd > from &&
        newEnd > newFrom &&
        sameSourceRow(rows[newEnd - 1]!, base.lines[oldEnd - 1])
      ) {
        oldEnd--;
        newEnd--;
      }
      if (from === oldEnd && newFrom === newEnd) continue;
      if (
        from === base.lines.length &&
        from > lower.old + 1 &&
        base.lines[from - 1]!.newline === ''
      ) {
        from--;
        newFrom--;
      }
      for (;;) {
        const changed = rows.slice(newFrom, newEnd);
        const priorById = new Map(
          document.lines.map((line) => [line.id, line]),
        );
        try {
          document = replaceLines(
            document,
            from,
            oldEnd - from,
            changed.map((node) =>
              editForNode(node, priorById.get(String(node.attrs.id))),
            ),
            changed.map((node) => String(node.attrs.id)),
          );
          break;
        } catch (error) {
          if (
            !(error instanceof FountainEditError) ||
            error.code !== 'neighbor-drift'
          )
            throw error;
          if (oldEnd < upper.old && newEnd < upper.next) {
            oldEnd++;
            newEnd++;
          } else if (from > lower.old + 1 && newFrom > lower.next + 1) {
            from--;
            newFrom--;
          } else throw error;
        }
      }
    }
  } else {
    const edits: { index: number; edit: LineEdit }[] = [];
    state.doc.forEach((node, _position, index) => {
      const prior = base.lines[index];
      if (!prior && !node.textContent) return; // Empty virtual placeholder has no portable row.
      if (node.attrs.protected) return;
      const runs = nodeRuns(node);
      const previous = originRuns(node, prior);
      if (sameRuns(runs, previous)) return;
      edits.push({ index, edit: editForNode(node, prior) });
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
        base.lines.length ? replacements.length : 0,
        replacements,
      );
      at++;
    }
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
