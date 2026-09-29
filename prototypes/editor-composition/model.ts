/** M1-06 diagnostic subset. Original source is immutable data inside the sole EditorState. */
import { Schema, type Node as EditorNode } from 'prosemirror-model';
import { history } from 'prosemirror-history';
import {
  EditorState,
  Plugin,
  PluginKey,
  type Transaction,
} from 'prosemirror-state';
import {
  parseFountain,
  replaceLine,
  type Document as SourceDocument,
  type Kind,
} from '../fountain/codec';

const editable = ['sceneHeading', 'action', 'character', 'dialogue'] as const;
const kinds = [...editable, 'raw'] as const;
const sourceVersion = new PluginKey<number>('composition-source-version');
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

export const schema = new Schema({
  nodes: {
    doc: { content: 'line+' },
    ...Object.fromEntries(
      kinds.map((kind) => [
        kind,
        {
          group: 'line',
          content: 'text*',
          marks: '',
          attrs: { sourceIndex: { default: -1 }, id: { default: null } },
          toDOM(node: EditorNode) {
            return [
              'p',
              {
                'data-kind': kind,
                'data-id': String(node.attrs.id),
                ...(kind === 'raw' ? { contenteditable: 'false' } : {}),
              },
              0,
            ] as const;
          },
          parseDOM: [
            {
              tag: `p[data-kind="${kind}"]`,
              getAttrs: (dom: HTMLElement) => ({
                sourceIndex: Number(dom.dataset.id?.replace('line-', '')),
                id: dom.dataset.id,
              }),
            },
          ],
        },
      ]),
    ),
    text: {},
  },
});

function nodeKind(kind: Kind) {
  return editable.some((candidate) => candidate === kind) ? kind : 'raw';
}

function serialize(doc: EditorNode, original: SourceDocument): SourceDocument {
  if (doc.childCount !== original.lines.length)
    throw new Error('Line splitting/joining is outside this bounded proof');
  let derived = original;
  doc.forEach((node, _offset, index) => {
    const prior = original.lines[index]!;
    if (
      node.attrs.id !== `line-${index}` ||
      node.attrs.sourceIndex !== index ||
      node.type.name !== nodeKind(prior.kind) ||
      node.marks.length
    )
      throw new Error(
        'Node identity/type changes are outside this bounded proof',
      );
    const text = node.textContent;
    if (text === prior.text) return;
    if (node.type.name === 'raw')
      throw new Error('Protected source region is immutable');
    if (decoder.decode(encoder.encode(text)) !== text || /[\r\n]/.test(text))
      throw new Error('Unsupported newline or invalid Unicode');
    derived = replaceLine(derived, index, prior.kind, text);
  });
  if (derived.bytes.length > 4096)
    throw new Error('Proof source exceeds 4 KiB');
  return derived;
}

export function createState(bytes: Uint8Array): EditorState {
  const original = parseFountain(bytes);
  if (original.readOnlyReason) throw new Error(original.readOnlyReason);
  if (
    !original.lines.length ||
    original.lines.length > 32 ||
    bytes.length > 4096
  )
    throw new Error('Proof requires 1–32 source lines and at most 4 KiB');
  const doc = schema.nodes.doc!.create(
    null,
    original.lines.map((line, index) =>
      schema.nodes[nodeKind(line.kind)]!.create(
        { sourceIndex: index, id: `line-${index}` },
        line.text ? schema.text(line.text) : undefined,
      ),
    ),
  );
  const source = new Plugin({
    // Closure-owned original is never a mutable peer buffer. Every output is derived from doc.
    filterTransaction(transaction) {
      if (!transaction.docChanged) return true;
      try {
        serialize(transaction.doc, original);
        return true;
      } catch {
        return false;
      }
    },
  });
  const version = new Plugin<number>({
    key: sourceVersion,
    state: {
      init: () => 1,
      apply: (tr, previous) =>
        tr.docChanged || tr.selectionSet ? previous + 1 : previous,
    },
  });
  // This snapshot accessor belongs to this state's plugin, not global or view-owned source.
  const capture = new Plugin<SourceDocument>({
    key: captureKey,
    state: { init: () => original, apply: (_tr, value) => value },
  });
  return EditorState.create({
    doc,
    plugins: [source, version, capture, history()],
  });
}
const captureKey = new PluginKey<SourceDocument>('composition-original');

export interface Anchor {
  id: string;
  utf16Offset: number;
  byteOffset: number;
}
export function currentVersion(state: EditorState): number {
  const value = sourceVersion.getState(state);
  if (value === undefined) throw new Error('Not a composition proof state');
  return value;
}

export function snapshot(state: EditorState) {
  const original = captureKey.getState(state);
  if (!original) throw new Error('Not a composition proof state');
  const document = serialize(state.doc, original);
  const anchor = (position: number): Anchor => {
    const resolved = state.doc.resolve(position);
    if (resolved.depth !== 1)
      throw new Error('Selection outside a source line');
    const node = resolved.parent;
    const index = Number(node.attrs.sourceIndex);
    const line = document.lines[index]!;
    const raw = decoder.decode(
      document.bytes.subarray(
        line.sourceStart,
        line.sourceEnd - encoder.encode(line.newline).length,
      ),
    );
    const textStart = raw.indexOf(line.text);
    if (
      textStart < 0 ||
      decoder.decode(
        encoder.encode(node.textContent.slice(0, resolved.parentOffset)),
      ) !== node.textContent.slice(0, resolved.parentOffset)
    )
      throw new Error('Selection is not on a Unicode/source boundary');
    return {
      id: String(node.attrs.id),
      utf16Offset: resolved.parentOffset,
      byteOffset:
        line.sourceStart +
        encoder.encode(
          raw.slice(0, textStart) +
            node.textContent.slice(0, resolved.parentOffset),
        ).length,
    };
  };
  return {
    source: document.bytes.slice(),
    version: currentVersion(state),
    semantics: document.lines.map((line) => ({
      kind: line.kind,
      text: line.text,
    })),
    ranges: document.lines.map((line) => ({
      from: line.sourceStart,
      to: line.sourceEnd,
    })),
    selection: {
      anchor: anchor(state.selection.anchor),
      head: anchor(state.selection.head),
    },
  };
}

export function apply(state: EditorState, transaction: Transaction) {
  const result = state.applyTransaction(transaction);
  return { state: result.state, accepted: result.transactions.length > 0 };
}
