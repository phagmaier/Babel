import { Fragment, type Node as EditorNode } from 'prosemirror-model';
import { closeHistory } from 'prosemirror-history';
import { TextSelection, type EditorState } from 'prosemirror-state';
import { screenplaySchema } from './schema';
import { captureEditor } from './sourceBridge';
import { authorizeStructuralTransaction, editorOrigin } from './state';
import type { EditorCommandResult } from './commands';

export const clipboardMime = 'application/x-babel-screenplay-v1';
export const MAX_CLIPBOARD_CHARS = 1024 * 1024;
const invalidUnicode =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u;
const kinds = [
  'action',
  'sceneHeading',
  'character',
  'dialogue',
  'parenthetical',
  'transition',
  'lyrics',
  'centered',
  'section',
  'synopsis',
  'pageBreak',
];
interface ClipboardRow {
  kind: string;
  runs: { text: string; styles: string[] }[];
  speech: number | null;
  dual: number | null;
  sceneNumber: string | null;
  sectionLevel: number | null;
  shot: boolean;
}
interface StructuredClipboard {
  schema: 1;
  wholeRows: boolean;
  rows: ClipboardRow[];
}
export interface ClipboardInput {
  text: string;
  html?: string;
  structured?: string;
}
const refuse = (reason: string): EditorCommandResult => ({
  handled: true,
  reason,
});
function selectedRows(state: EditorState) {
  const { $from, $to, from, to } = state.selection;
  if (!$from.depth || !$to.depth) return null;
  const first = $from.index(0);
  const last = $to.index(0) - (to > from && $to.parentOffset === 0 ? 1 : 0);
  return {
    first,
    last: Math.max(first, last),
    fromOffset: $from.parentOffset,
    toOffset:
      last < $to.index(0)
        ? state.doc.child(last).content.size
        : $to.parentOffset,
  };
}
export function copyEditorSelection(state: EditorState): ClipboardInput {
  const range = selectedRows(state);
  if (!range || state.selection.empty) return { text: '' };
  const nodes = state.doc.content.content.slice(range.first, range.last + 1);
  const text = nodes
    .map((node, index) =>
      node.textContent.slice(
        index === 0 ? range.fromOffset : 0,
        index === nodes.length - 1 ? range.toOffset : undefined,
      ),
    )
    .join('\n');
  const wholeRows =
    range.fromOffset === 0 && range.toOffset === nodes.at(-1)!.content.size;
  if (
    nodes.some(
      (node) =>
        node.attrs.protected ||
        node.attrs.hiddenOf ||
        node.attrs.literal ||
        !kinds.includes(node.type.name),
    )
  )
    return { text };
  const ids = nodes.map((node) => node.attrs.id);
  const rows: ClipboardRow[] = nodes.map((node, index) => {
    const content = node.content.cut(
      index === 0 ? range.fromOffset : 0,
      index === nodes.length - 1 ? range.toOffset : node.content.size,
    );
    return {
      kind: node.type.name,
      runs: content.content.map((child) => ({
        text: child.text!,
        styles: child.marks.map((mark) => mark.type.name),
      })),
      speech: node.attrs.speechOf ? ids.indexOf(node.attrs.speechOf) : null,
      dual: node.attrs.dualWith ? ids.indexOf(node.attrs.dualWith) : null,
      sceneNumber: node.attrs.sceneNumber,
      sectionLevel: node.attrs.sectionLevel,
      shot: node.attrs.actionSubtype === 'shot',
    };
  });
  return { text, structured: JSON.stringify({ schema: 1, wholeRows, rows }) };
}
/** Inert template parsing only. No parsed element or attribute is ever adopted into the editor. */
export function clipboardHtmlText(html: string): string {
  if (html.length > MAX_CLIPBOARD_CHARS)
    throw new RangeError('Clipboard content exceeds the local paste limit');
  const template = document.createElement('template');
  template.innerHTML = html;
  const forbidden = new Set([
    'SCRIPT',
    'STYLE',
    'TEMPLATE',
    'IFRAME',
    'OBJECT',
    'EMBED',
    'SVG',
    'MATH',
    'IMG',
    'VIDEO',
    'AUDIO',
    'SOURCE',
    'LINK',
    'META',
    'INPUT',
    'TEXTAREA',
    'SELECT',
  ]);
  const blocks = new Set([
    'P',
    'DIV',
    'LI',
    'TR',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'PRE',
    'BLOCKQUOTE',
  ]);
  const output: string[] = [];
  function read(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      output.push(node.textContent ?? '');
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    if (forbidden.has(element.tagName.toUpperCase())) return;
    if (element.tagName === 'BR') {
      output.push('\n');
      return;
    }
    const block = blocks.has(element.tagName);
    if (block && output.length && !output.at(-1)!.endsWith('\n'))
      output.push('\n');
    element.childNodes.forEach(read);
    if (block) output.push('\n');
  }
  template.content.childNodes.forEach(read);
  // Strip the single structural terminator added by a final HTML block, not authored blank lines.
  return output.join('').replace(/\n$/, '');
}
function decodeStructured(value: string): StructuredClipboard {
  if (value.length > MAX_CLIPBOARD_CHARS)
    throw new Error('Structured clipboard exceeds the local paste limit');
  const parsed = JSON.parse(value) as StructuredClipboard;
  if (
    parsed?.schema !== 1 ||
    Object.keys(parsed).sort().join(',') !== 'rows,schema,wholeRows' ||
    typeof parsed.wholeRows !== 'boolean' ||
    !Array.isArray(parsed.rows) ||
    !parsed.rows.length ||
    parsed.rows.length > 10000
  )
    throw new Error('Invalid structured clipboard');
  for (const row of parsed.rows) {
    if (
      !row ||
      Object.keys(row).sort().join(',') !==
        'dual,kind,runs,sceneNumber,sectionLevel,shot,speech' ||
      !kinds.includes(row.kind) ||
      !Array.isArray(row.runs) ||
      typeof row.shot !== 'boolean' ||
      (row.sceneNumber !== null &&
        (typeof row.sceneNumber !== 'string' ||
          !/^[\p{L}\p{N}.-]+$/u.test(row.sceneNumber))) ||
      (row.sectionLevel !== null &&
        (!Number.isInteger(row.sectionLevel) ||
          row.sectionLevel < 1 ||
          row.sectionLevel > 256))
    )
      throw new Error('Invalid structured clipboard row');
    for (const ref of [row.speech, row.dual])
      if (
        ref !== null &&
        (!Number.isInteger(ref) || ref < -1 || ref >= parsed.rows.length)
      )
        throw new Error('Invalid clipboard relationship');
    for (const run of row.runs)
      if (
        !run ||
        Object.keys(run).sort().join(',') !== 'styles,text' ||
        typeof run.text !== 'string' ||
        /[\r\n]/.test(run.text) ||
        invalidUnicode.test(run.text) ||
        !Array.isArray(run.styles) ||
        run.styles.some(
          (style) => !['bold', 'italic', 'underline'].includes(style),
        )
      )
        throw new Error('Invalid clipboard text or emphasis');
  }
  return parsed;
}
function runsContent(runs: ClipboardRow['runs']): Fragment {
  return Fragment.from(
    runs
      .filter((run) => run.text)
      .map((run) =>
        screenplaySchema.text(
          run.text,
          run.styles.map((style) => screenplaySchema.marks[style]!.create()),
        ),
      ),
  );
}
/** Literal multiline paste retains the target element type, never guesses Fountain grammar. */
export function pasteEditorContent(
  state: EditorState,
  input: ClipboardInput,
): EditorCommandResult {
  try {
    if (
      input.text.length > MAX_CLIPBOARD_CHARS ||
      (input.html?.length ?? 0) > MAX_CLIPBOARD_CHARS
    )
      return refuse(
        'Clipboard content exceeds the local paste limit; content retained',
      );
    const range = selectedRows(state);
    if (!range || editorOrigin(state).document.readOnlyReason)
      return refuse('Paste needs an editable screenplay selection');
    const old = state.doc.content.content.slice(range.first, range.last + 1);
    if (
      old.some(
        (node) =>
          node.attrs.protected ||
          node.attrs.hiddenOf ||
          !kinds.includes(node.type.name),
      )
    )
      return refuse('Paste cannot replace protected or hidden source');
    const first = old[0]!,
      last = old.at(-1)!;
    const prefix = first.content.cut(0, range.fromOffset);
    const suffix = last.content.cut(range.toOffset);
    const structured = input.structured
      ? decodeStructured(input.structured)
      : null;
    if (
      structured &&
      structured.rows
        .map((row) => row.runs.map((run) => run.text).join(''))
        .join('\n') !== input.text
    )
      return refuse('Structured clipboard text mismatch; content retained');
    const text = (
      input.text || (input.html ? clipboardHtmlText(input.html) : '')
    ).replace(/\r\n?/g, '\n');
    if (invalidUnicode.test(text))
      return refuse(
        'Paste contains an invalid Unicode scalar; content retained',
      );
    let nextId = editorOrigin(state).nextId;
    const allocate = () => `b${nextId++}`;
    let rows: EditorNode[];
    if (
      structured &&
      !structured.wholeRows &&
      structured.rows.length > 1 &&
      new Set(structured.rows.map((row) => row.kind)).size > 1
    )
      return refuse('Copy complete element rows to preserve mixed structure');
    // A single speech paragraph copied without its cue is inline content when pasted
    // into an existing paragraph of the same speech type, retaining the target cue.
    const inlineSpeech =
      structured?.rows.length === 1 &&
      ['dialogue', 'parenthetical'].includes(first.type.name) &&
      first.type.name === structured.rows[0]!.kind &&
      old.every(
        (node) =>
          node.type === first.type &&
          node.attrs.speechOf === first.attrs.speechOf,
      );
    if (structured?.wholeRows && !inlineSpeech) {
      if (
        (prefix.size || suffix.size) &&
        (first.type.name !== 'action' || last.type.name !== 'action')
      )
        return refuse(
          'Structured paste at a speech/heading caret needs an empty element or complete selection',
        );
      const ids = structured.rows.map(() => allocate());
      rows = structured.rows.map((row, index) => {
        if (row.speech === -1 || row.dual === -1)
          throw new Error(
            'Copy the complete speech/dual group or paste its literal text',
          );
        const speechOf = row.speech === null ? null : ids[row.speech];
        const dualWith = row.dual === null ? null : ids[row.dual];
        if (
          (['dialogue', 'parenthetical'].includes(row.kind) &&
            (!speechOf || row.speech! >= index)) ||
          (row.sceneNumber !== null && row.kind !== 'sceneHeading') ||
          (row.sectionLevel !== null && row.kind !== 'section') ||
          (row.shot && row.kind !== 'action') ||
          (speechOf && !['dialogue', 'parenthetical'].includes(row.kind)) ||
          (dualWith &&
            (row.kind !== 'character' ||
              structured.rows[row.dual!]!.kind !== 'character')) ||
          (speechOf && structured.rows[row.speech!]!.kind !== 'character')
        )
          throw new Error('Invalid clipboard speech relationship');
        return screenplaySchema.nodes[row.kind]!.create(
          {
            id: ids[index],
            sourceIndex: -1,
            protected: false,
            literal: false,
            speechOf,
            dualWith,
            sceneNumber: row.sceneNumber,
            sectionLevel: row.sectionLevel,
            actionSubtype: row.shot ? 'shot' : null,
          },
          runsContent(row.runs),
        );
      });
      if (prefix.size) rows.unshift(first.copy(prefix));
      if (suffix.size)
        rows.push(
          last.type.create(
            {
              ...last.attrs,
              id: prefix.size ? allocate() : last.attrs.id,
              sourceIndex: prefix.size ? -1 : last.attrs.sourceIndex,
            },
            suffix,
          ),
        );
    } else {
      const singleRich =
        structured?.rows.length === 1
          ? runsContent(structured.rows[0]!.runs)
          : null;
      const chunks = text.split('\n');
      if (singleRich && chunks.length !== 1)
        return refuse('Structured clipboard text mismatch; content retained');
      if (
        old.some(
          (node) =>
            node.type !== first.type ||
            node.attrs.speechOf !== first.attrs.speechOf,
        ) &&
        (!state.selection.empty || chunks.length > 1)
      )
        return refuse(
          'Literal paste across different element/group boundaries needs an explicit structural selection',
        );
      if (
        chunks.length > 1 &&
        ['character', 'parenthetical', 'pageBreak'].includes(first.type.name)
      )
        return refuse(
          'Multiline paste in this element needs a complete structured group or explicit Fountain import',
        );
      rows = chunks.map((chunk, index) => {
        let content =
          singleRich ??
          (chunk
            ? Fragment.from(
                screenplaySchema.text(
                  chunk,
                  state.storedMarks ?? state.selection.$from.marks(),
                ),
              )
            : Fragment.empty);
        if (index === 0) content = prefix.append(content);
        if (index === chunks.length - 1) content = content.append(suffix);
        return first.type.create(
          {
            ...first.attrs,
            id: index === 0 ? first.attrs.id : allocate(),
            sourceIndex: index === 0 ? first.attrs.sourceIndex : -1,
            sceneNumber: index === 0 ? first.attrs.sceneNumber : null,
          },
          content,
        );
      });
    }
    const remaining = [
      ...state.doc.content.content.slice(0, range.first),
      ...rows,
      ...state.doc.content.content.slice(range.last + 1),
    ];
    const ids = new Set(remaining.map((node) => node.attrs.id));
    if (
      remaining.some(
        (node) =>
          (node.attrs.speechOf && !ids.has(node.attrs.speechOf)) ||
          (node.attrs.dualWith && !ids.has(node.attrs.dualWith)),
      )
    )
      return refuse('Paste would detach an existing dialogue relationship');
    const start = state.selection.$from.start() - 1;
    const end = start + old.reduce((size, node) => size + node.nodeSize, 0);
    const tr = closeHistory(state.tr)
      .replaceWith(start, end, rows)
      .setMeta('paste', true)
      .setMeta('uiEvent', 'paste');
    const caret =
      structured?.wholeRows && suffix.size
        ? start +
          rows.slice(0, -1).reduce((n, node) => n + node.nodeSize, 0) -
          1
        : start +
          rows.reduce((n, node) => n + node.nodeSize, 0) -
          1 -
          suffix.size;
    tr.setSelection(TextSelection.create(tr.doc, caret));
    authorizeStructuralTransaction(tr, nextId);
    const candidate = state.applyTransaction(tr);
    if (!candidate.transactions.length)
      return refuse('Paste cannot safely replace this source region');
    // Explicit paste may validate source off the typing path. Refuse atomically if the target
    // grammar cannot carry literal text; the clipboard and current manuscript remain intact.
    captureEditor(candidate.state);
    return { handled: true, transaction: tr };
  } catch (error) {
    return refuse(
      error instanceof Error
        ? error.message
        : 'Paste refused; content retained',
    );
  }
}
