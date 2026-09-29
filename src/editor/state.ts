import { type Node as EditorNode } from 'prosemirror-model';
import { history } from 'prosemirror-history';
import {
  EditorState,
  Plugin,
  PluginKey,
  TextSelection,
  type Transaction,
} from 'prosemirror-state';
import { parseFountain } from '../domain/fountainCodec';
import type {
  FountainDocument,
  FountainRecovery,
  StyledText,
} from '../domain/fountainModel';
import { screenplaySchema } from './schema';

interface SourceOrigin {
  readonly document: FountainDocument;
  readonly session: object;
  readonly version: number;
}
const originKey = new PluginKey<SourceOrigin>('babel-source-origin');
const invalidUnicode =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u;

export function editorOrigin(state: EditorState): SourceOrigin {
  const origin = originKey.getState(state);
  if (!origin)
    throw new TypeError('Expected a production screenplay EditorState');
  return origin;
}
export function editorVersion(state: EditorState): number {
  return editorOrigin(state).version;
}
export function nodeRuns(node: EditorNode): StyledText[] {
  const runs: StyledText[] = [];
  node.forEach((child) => {
    runs.push({
      text: child.text!,
      styles: child.marks.map(
        (mark) => mark.type.name as StyledText['styles'][number],
      ),
    });
  });
  return runs;
}

/** Cheap shape/content checks over changed rows; no codec, source encoding or hashing here. */
function permitted(transaction: Transaction, state: EditorState): boolean {
  if (transaction.before !== state.doc) return false;
  if (!transaction.docChanged) return true;
  if (
    editorOrigin(state).document.readOnlyReason ||
    transaction.doc.childCount !== state.doc.childCount
  )
    return false;
  const start = state.doc.content.findDiffStart(transaction.doc.content);
  const end = state.doc.content.findDiffEnd(transaction.doc.content);
  if (start === null || end === null) return true;
  const from = Math.min(
    state.doc.resolve(start).index(0),
    transaction.doc.resolve(start).index(0),
  );
  const to = Math.max(
    state.doc.resolve(end.a).index(0),
    transaction.doc.resolve(end.b).index(0),
  );
  for (let index = from; index <= to && index < state.doc.childCount; index++) {
    const before = state.doc.child(index);
    const after = transaction.doc.child(index);
    if (before === after) continue;
    if (
      before.type !== after.type ||
      JSON.stringify(before.attrs) !== JSON.stringify(after.attrs)
    )
      return false;
    if (before.attrs.protected && !before.eq(after)) return false;
    if (
      after.content.content.some(
        (node) =>
          invalidUnicode.test(node.textContent) ||
          node.marks.some(
            (mark) => mark.type !== screenplaySchema.marks[mark.type.name],
          ),
      )
    )
      return false;
    if (
      /[\r\n]/.test(after.textContent) ||
      invalidUnicode.test(after.textContent)
    )
      return false;
    if (
      after.attrs.literal &&
      after.content.content.some((node) => node.marks.length)
    )
      return false;
  }
  return true;
}

export function createEditorState(
  bytes: Uint8Array,
  recovery?: FountainRecovery,
): EditorState {
  const source = parseFountain(bytes, recovery);
  const nodes = source.lines.map((line, sourceIndex) => {
    const kind =
      line.intendedKind ?? (line.kind === 'blank' ? 'action' : line.kind);
    const literal = line.kind === 'blank' ? false : !line.inline?.complete;
    const runs = literal
      ? [{ text: line.text, styles: [] }]
      : (line.inline?.runs ?? [{ text: line.text, styles: [] }]);
    return screenplaySchema.nodes[kind]!.create(
      {
        id: line.id,
        sourceIndex,
        protected: !line.editable,
        literal,
        sceneNumber: line.sceneNumber ?? null,
        sectionLevel: line.sectionLevel ?? null,
        actionSubtype: line.actionSubtype ?? null,
        speechOf: line.speechOf ?? null,
        dualWith: source.lines[line.dualWith ?? -1]?.id ?? null,
        titleOf: line.titleOf ?? null,
        hiddenOf: line.hiddenOf ?? null,
      },
      runs
        .filter((run) => run.text)
        .map((run) =>
          screenplaySchema.text(
            run.text,
            run.styles.map((style) => screenplaySchema.marks[style]!.create()),
          ),
        ),
    );
  });
  if (!nodes.length)
    nodes.push(
      screenplaySchema.nodes[source.readOnlyReason ? 'raw' : 'action']!.create(
        {
          id: 'b0',
          sourceIndex: -1,
          protected: Boolean(source.readOnlyReason),
          literal: false,
        },
        source.readOnlyReason
          ? screenplaySchema.text(
              new TextDecoder().decode(bytes) || 'Unreadable source',
            )
          : undefined,
      ),
    );
  const doc = screenplaySchema.nodes.doc!.create(null, nodes);
  const sourcePlugin = new Plugin<SourceOrigin>({
    key: originKey,
    state: {
      init: () =>
        Object.freeze({
          document: source,
          session: Object.freeze({}),
          version: 1,
        }),
      apply(tr, previous) {
        if (!tr.docChanged && !tr.selectionSet) return previous;
        if (previous.version >= Number.MAX_SAFE_INTEGER)
          throw new RangeError('Editor version exhausted');
        return Object.freeze({ ...previous, version: previous.version + 1 });
      },
    },
    filterTransaction: permitted,
  });
  let first = 1;
  for (const node of nodes) {
    if (!node.attrs.protected) break;
    first += node.nodeSize;
  }
  if (first > doc.content.size) first = 1;
  return EditorState.create({
    doc,
    selection: TextSelection.create(doc, first),
    plugins: [sourcePlugin, history()],
  });
}

export function applyEditorTransaction(
  state: EditorState,
  transaction: Transaction,
) {
  const result = state.applyTransaction(transaction);
  return { state: result.state, accepted: result.transactions.length > 0 };
}
