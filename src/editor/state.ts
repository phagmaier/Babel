import { type Node as EditorNode } from 'prosemirror-model';
import {
  history,
  isHistoryTransaction,
  closeHistory,
} from 'prosemirror-history';
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
  readonly nextId: number;
}
const originKey = new PluginKey<SourceOrigin>('babel-source-origin');
const sourceDocuments = new WeakMap<object, FountainDocument>();
const importTransactions = new WeakSet<Transaction>();
const adoptedVersions = new WeakMap<Transaction, number>();
const structuralTransactions = new WeakMap<Transaction, number>();
export function authorizeStructuralTransaction(
  transaction: Transaction,
  nextId: number,
) {
  structuralTransactions.set(transaction, nextId);
  return transaction;
}
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
  const sourceChanged =
    transaction.doc.attrs.sourceOrigin !== state.doc.attrs.sourceOrigin;
  if (
    sourceChanged &&
    (!sourceDocuments.has(transaction.doc.attrs.sourceOrigin as object) ||
      (!importTransactions.has(transaction) &&
        !isHistoryTransaction(transaction)))
  )
    return false;
  if (!sourceChanged && editorOrigin(state).document.readOnlyReason)
    return false;
  if (
    structuralTransactions.has(transaction) ||
    isHistoryTransaction(transaction)
  ) {
    const oldProtected: [string, EditorNode][] = state.doc.content.content
      .filter((node) => node.attrs.protected)
      .map((node) => [node.attrs.id as string, node]);
    const newProtected: [string, EditorNode][] = transaction.doc.content.content
      .filter((node) => node.attrs.protected)
      .map((node) => [node.attrs.id as string, node]);
    if (
      !sourceChanged &&
      (oldProtected.length !== newProtected.length ||
        oldProtected.some(
          ([id, node], index) =>
            id !== newProtected[index]?.[0] ||
            !node.eq(newProtected[index]![1]),
        ))
    )
      return false;
    const ids = new Set<string>();
    for (const node of transaction.doc.content.content) {
      const id = node.attrs.id;
      if (
        typeof id !== 'string' ||
        !/^b(?:0|[1-9]\d*)$/.test(id) ||
        ids.has(id) ||
        (/[\r\n]/.test(node.textContent) &&
          !(
            sourceChanged &&
            node.attrs.protected &&
            sourceDocuments.get(transaction.doc.attrs.sourceOrigin as object)
              ?.readOnlyReason
          )) ||
        invalidUnicode.test(node.textContent) ||
        node.content.content.some((child) =>
          child.marks.some(
            (mark) => mark.type !== screenplaySchema.marks[mark.type.name],
          ),
        )
      )
        return false;
      ids.add(id);
    }
    return true;
  }
  if (transaction.doc.childCount !== state.doc.childCount) return false;
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
  initialVersion = 1,
): EditorState {
  if (!Number.isSafeInteger(initialVersion) || initialVersion < 1)
    throw new RangeError('Invalid initial editor version');
  const source = parseFountain(bytes, recovery);
  const safeNoteIndices = new Set<number>();
  for (const region of source.hiddenRegions) {
    if (
      region.kind !== 'note' ||
      !region.closed ||
      region.ambiguous ||
      source.lines
        .slice(region.from, region.from + region.count)
        .some((line) => line.kind !== 'note')
    )
      continue;
    for (let index = region.from; index < region.from + region.count; index++)
      safeNoteIndices.add(index);
  }
  const nodes = source.lines.map((line, sourceIndex) => {
    const safeNote = safeNoteIndices.has(sourceIndex);
    const kind =
      line.intendedKind ?? (line.kind === 'blank' ? 'action' : line.kind);
    const literal =
      line.kind === 'note'
        ? true
        : line.kind === 'blank'
          ? false
          : !line.inline?.complete;
    const runs = literal
      ? [{ text: line.text, styles: [] }]
      : (line.inline?.runs ?? [{ text: line.text, styles: [] }]);
    return screenplaySchema.nodes[kind]!.create(
      {
        id: line.id,
        sourceIndex,
        protected: !line.editable && !safeNote,
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
          id: `b${source.recovery.nextId}`,
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
  const sourceToken = Object.freeze({});
  sourceDocuments.set(sourceToken, source);
  const doc = screenplaySchema.nodes.doc!.create(
    { sourceOrigin: sourceToken },
    nodes,
  );
  const sourcePlugin = new Plugin<SourceOrigin>({
    key: originKey,
    state: {
      init: () =>
        Object.freeze({
          document: source,
          session: Object.freeze({}),
          version: initialVersion,
          nextId: nodes.reduce(
            (next, node) =>
              Math.max(next, Number(String(node.attrs.id).slice(1)) + 1),
            source.recovery.nextId,
          ),
        }),
      apply(tr, previous) {
        if (!tr.docChanged && !tr.selectionSet) return previous;
        if (previous.version >= Number.MAX_SAFE_INTEGER)
          throw new RangeError('Editor version exhausted');
        return Object.freeze({
          ...previous,
          document: sourceDocuments.get(tr.doc.attrs.sourceOrigin as object)!,
          version: adoptedVersions.get(tr) ?? previous.version + 1,
          nextId: Math.max(
            previous.nextId,
            structuralTransactions.get(tr) ?? 0,
          ),
        });
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

/** Only editor commands may authorize row changes; the counter survives undo. */
export function applyStructuralEditorTransaction(
  state: EditorState,
  transaction: Transaction,
  nextId = editorOrigin(state).nextId,
) {
  structuralTransactions.set(transaction, nextId);
  return applyEditorTransaction(state, transaction);
}

export function applyEditorTransaction(
  state: EditorState,
  transaction: Transaction,
) {
  const result = state.applyTransaction(transaction);
  return { state: result.state, accepted: result.transactions.length > 0 };
}

/** Whole-source import only; the application must obtain exact native safety protection first. */
export function sourceImportTransaction(
  state: EditorState,
  bytes: Uint8Array,
  adoptedVersion?: number,
  draftRecovery?: FountainRecovery,
): Transaction {
  const parsed = parseFountain(bytes, draftRecovery);
  let nextId = editorOrigin(state).nextId;
  const recovery: FountainRecovery = {
    ...parsed.recovery,
    lines: parsed.recovery.lines.map((line) => ({
      ...line,
      id: `b${nextId++}`,
    })),
    nextId: nextId,
  };
  // Avoid any accidental ID reuse even for an empty or invalid imported source.
  const imported = createEditorState(bytes, { ...recovery, nextId });
  let tr = closeHistory(state.tr)
    .replaceWith(0, state.doc.content.size, imported.doc.content)
    .setDocAttribute('sourceOrigin', imported.doc.attrs.sourceOrigin);
  // Selection must refer to the transaction document, including its imported origin attribute.
  tr = tr.setSelection(TextSelection.create(tr.doc, imported.selection.from));
  if (adoptedVersion !== undefined) {
    if (
      !Number.isSafeInteger(adoptedVersion) ||
      adoptedVersion <= editorVersion(state)
    )
      throw new RangeError('Adopted version must advance the live sequence');
    adoptedVersions.set(tr, adoptedVersion);
  }
  importTransactions.add(tr);
  return authorizeStructuralTransaction(
    tr,
    Math.max(nextId, editorOrigin(imported).nextId),
  );
}
