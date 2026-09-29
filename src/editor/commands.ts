import { closeHistory } from 'prosemirror-history';
import type { Node as EditorNode } from 'prosemirror-model';
import {
  TextSelection,
  type EditorState,
  type Transaction,
} from 'prosemirror-state';
import { screenplaySchema } from './schema';
import { authorizeStructuralTransaction, editorOrigin } from './state';

export type SmartKey = 'Enter' | 'ShiftEnter' | 'Backspace' | 'Delete';
export type EditorCommandResult =
  | {
      readonly handled: false;
      readonly transaction?: never;
      readonly reason?: never;
    }
  | {
      readonly handled: true;
      readonly transaction?: Transaction;
      readonly reason?: string;
    };

const handled = (transaction: Transaction): EditorCommandResult => ({
  handled: true,
  transaction,
});
const refused = (reason: string): EditorCommandResult => ({
  handled: true,
  reason,
});
const ordinary: EditorCommandResult = { handled: false };

function rowStart(state: EditorState, index: number): number {
  let position = 0;
  for (let at = 0; at < index; at++) position += state.doc.child(at).nodeSize;
  return position;
}
function location(state: EditorState, position: number) {
  const resolved = state.doc.resolve(position);
  const index = Math.min(resolved.index(0), state.doc.childCount - 1);
  const offset = resolved.depth
    ? resolved.parentOffset
    : position === state.doc.content.size
      ? state.doc.child(index).textContent.length
      : 0;
  return { index, offset };
}
function newNode(
  kind: string,
  source: EditorNode,
  id: string,
  content?: EditorNode['content'],
) {
  const attrs = {
    ...source.attrs,
    id,
    sourceIndex: id === source.attrs.id ? source.attrs.sourceIndex : -1,
    protected: false,
    sceneNumber: kind === 'sceneHeading' ? source.attrs.sceneNumber : null,
    sectionLevel: kind === 'section' ? source.attrs.sectionLevel : null,
    actionSubtype: kind === 'action' ? source.attrs.actionSubtype : null,
    speechOf: ['dialogue', 'parenthetical'].includes(kind)
      ? source.attrs.speechOf
      : null,
    dualWith: kind === 'character' ? source.attrs.dualWith : null,
  };
  return screenplaySchema.nodes[kind]!.create(attrs, content);
}
function nextKind(kind: string): string {
  switch (kind) {
    case 'character':
    case 'parenthetical':
      return 'dialogue';
    case 'lyrics':
      return 'lyrics';
    default:
      return 'action';
  }
}
function replaceRows(
  state: EditorState,
  from: number,
  count: number,
  rows: readonly EditorNode[],
  caretRow: number,
  caretOffset: number,
  nextId: number,
): EditorCommandResult {
  const surviving = [
    ...state.doc.content.content.slice(0, from),
    ...rows,
    ...state.doc.content.content.slice(from + count),
  ];
  const ids = new Set(surviving.map((node) => node.attrs.id));
  if (
    surviving.some(
      (node) =>
        (node.attrs.speechOf && !ids.has(node.attrs.speechOf)) ||
        (node.attrs.dualWith && !ids.has(node.attrs.dualWith)),
    )
  )
    return refused('This edit would detach a dialogue relationship');
  const start = rowStart(state, from);
  const end = rowStart(state, from + count);
  let tr = closeHistory(state.tr).replaceWith(start, end, rows);
  let caret = start + 1;
  for (let index = 0; index < caretRow; index++) caret += rows[index]!.nodeSize;
  caret += caretOffset;
  tr = tr.setSelection(TextSelection.create(tr.doc, caret));
  return handled(authorizeStructuralTransaction(tr, nextId));
}
function editable(nodes: readonly EditorNode[]) {
  return nodes.every((node) => !node.attrs.protected);
}

function enter(state: EditorState): EditorCommandResult {
  const { from, to } = state.selection;
  const start = location(state, from);
  const finish = location(state, to);
  if (
    start.index >= state.doc.childCount ||
    finish.index >= state.doc.childCount
  )
    return refused('No editable screenplay row at the caret');
  const owned = state.doc.content.content.slice(start.index, finish.index + 1);
  if (!editable(owned)) return refused('Protected source cannot be split');
  const left = owned[0]!;
  const right = owned.at(-1)!;
  let nextId = editorOrigin(state).nextId;
  const allocate = () => `b${nextId++}`;
  const prefix = left.content.cut(0, start.offset);
  const suffix = right.content.cut(finish.offset);
  if (left.type.name === 'note') {
    if (
      start.index !== finish.index ||
      !left.attrs.hiddenOf ||
      prefix.size === 0 ||
      suffix.size === 0 ||
      (left.textContent.startsWith('[[') && start.offset === 1) ||
      (left.textContent.endsWith(']]') &&
        finish.offset === left.textContent.length - 1)
    )
      return refused(
        'Note split needs two nonempty, safely delimited note lines',
      );
    const first = newNode('note', left, String(left.attrs.id), prefix);
    const second = newNode('note', left, allocate(), suffix);
    return replaceRows(state, start.index, 1, [first, second], 1, 0, nextId);
  }
  if (from !== to) {
    if (owned.some((node) => node.attrs.dualWith))
      return refused('Selection crosses a dual-dialogue relationship');
    if (
      start.index !== finish.index &&
      owned.some(
        (node) =>
          node.attrs.id !== left.attrs.id &&
          node.attrs.speechOf &&
          !owned.some(
            (candidate) => candidate.attrs.id === node.attrs.speechOf,
          ),
      )
    )
      return refused('Selection would detach a dialogue group');
    const first = newNode(left.type.name, left, String(left.attrs.id), prefix);
    const created = newNode(right.type.name, right, allocate(), suffix);
    const second =
      right.type.name === 'sceneHeading'
        ? created.type.create(
            { ...created.attrs, sceneNumber: null },
            created.content,
          )
        : created;
    return replaceRows(
      state,
      start.index,
      owned.length,
      [first, second],
      1,
      0,
      nextId,
    );
  }
  if (left.type.name === 'raw' || left.type.name === 'boneyard')
    return refused('This source region has no safe structural Enter rule');
  if (
    !left.textContent &&
    ['dialogue', 'character', 'parenthetical', 'lyrics'].includes(
      left.type.name,
    )
  ) {
    const action = newNode('action', left, String(left.attrs.id));
    return replaceRows(state, start.index, 1, [action], 0, 0, nextId);
  }
  if (start.offset === 0 && left.textContent) {
    const created = newNode('action', left, allocate());
    const before =
      left.attrs.actionSubtype === 'shot'
        ? created.type.create({ ...created.attrs, actionSubtype: null })
        : created;
    return replaceRows(state, start.index, 1, [before, left], 0, 0, nextId);
  }
  if (start.offset < left.textContent.length) {
    if (left.attrs.dualWith)
      return refused('Split the complete dual-dialogue group explicitly');
    const first = newNode(left.type.name, left, String(left.attrs.id), prefix);
    const created = newNode(left.type.name, left, allocate(), suffix);
    const second =
      left.type.name === 'sceneHeading'
        ? created.type.create(
            { ...created.attrs, sceneNumber: null },
            created.content,
          )
        : created;
    return replaceRows(state, start.index, 1, [first, second], 1, 0, nextId);
  }
  const following =
    start.index + 1 < state.doc.childCount
      ? state.doc.child(start.index + 1)
      : undefined;
  if (
    (left.type.name === 'parenthetical' || left.type.name === 'character') &&
    following?.type.name === 'dialogue' &&
    following.attrs.speechOf ===
      (left.type.name === 'character' ? left.attrs.id : left.attrs.speechOf)
  )
    return handled(
      state.tr.setSelection(
        TextSelection.create(state.doc, rowStart(state, start.index + 1) + 1),
      ),
    );
  const kind = nextKind(left.type.name);
  const created = newNode(kind, left, allocate());
  const next =
    kind === 'action' && left.attrs.actionSubtype === 'shot'
      ? created.type.create({ ...created.attrs, actionSubtype: null })
      : created;
  const attached =
    kind === 'dialogue'
      ? next.type.create({
          ...next.attrs,
          speechOf:
            left.type.name === 'character'
              ? left.attrs.id
              : left.attrs.speechOf,
        })
      : next;
  return replaceRows(state, start.index, 1, [left, attached], 1, 0, nextId);
}

function join(
  state: EditorState,
  direction: 'Backspace' | 'Delete',
): EditorCommandResult {
  if (!state.selection.empty) {
    const start = location(state, state.selection.from);
    const finish = location(state, state.selection.to);
    if (start.index === finish.index) return ordinary;
    const owned = state.doc.content.content.slice(
      start.index,
      finish.index + 1,
    );
    if (!editable(owned)) return refused('Protected source cannot be deleted');
    const left = owned[0]!;
    const right = owned.at(-1)!;
    if (
      owned.some(
        (node) =>
          node.type.name === 'note' ||
          node.type.name === 'character' ||
          node.attrs.speechOf,
      )
    )
      return refused(
        'Selection crosses a dialogue group; keep its speaker and lines together',
      );
    const prefix = left.content.cut(0, start.offset);
    const suffix = right.content.cut(finish.offset);
    const kind = left.type.name === right.type.name ? left.type.name : 'action';
    const merged = newNode(
      kind,
      left,
      String(left.attrs.id),
      prefix.append(suffix),
    );
    return replaceRows(
      state,
      start.index,
      owned.length,
      [merged],
      0,
      start.offset,
      editorOrigin(state).nextId,
    );
  }
  const at = location(state, state.selection.from);
  const current = state.doc.child(at.index);
  if (!current || current.attrs.protected)
    return refused('Protected source cannot be joined');
  const leftIndex = direction === 'Backspace' ? at.index - 1 : at.index;
  const rightIndex = leftIndex + 1;
  if (
    (direction === 'Backspace' && at.offset !== 0) ||
    (direction === 'Delete' && at.offset !== current.textContent.length)
  )
    return ordinary;
  if (leftIndex < 0 || rightIndex >= state.doc.childCount) return ordinary;
  const left = state.doc.child(leftIndex);
  const right = state.doc.child(rightIndex);
  if (!editable([left, right]))
    return refused('Protected source cannot be joined');
  if (left.type.name === 'note' || right.type.name === 'note')
    return refused('A note cannot be joined with another element');
  if (
    left.type.name === 'character' &&
    right.textContent &&
    ['dialogue', 'parenthetical'].includes(right.type.name)
  )
    return refused('Joining a nonempty speaker cue would detach its dialogue');
  if (right.type.name === 'character' && right.textContent && left.textContent)
    return refused(
      'Joining into a nonempty speaker cue would remove its group',
    );
  if (right.textContent === '')
    return replaceRows(
      state,
      leftIndex,
      2,
      [left],
      0,
      left.textContent.length,
      editorOrigin(state).nextId,
    );
  if (left.textContent === '')
    return replaceRows(
      state,
      leftIndex,
      2,
      [right],
      0,
      0,
      editorOrigin(state).nextId,
    );
  const kind =
    left.type.name === right.type.name
      ? left.type.name
      : left.attrs.speechOf && left.attrs.speechOf === right.attrs.speechOf
        ? 'dialogue'
        : 'action';
  const content = left.content.append(right.content);
  const merged = newNode(kind, left, String(left.attrs.id), content);
  return replaceRows(
    state,
    leftIndex,
    2,
    [merged],
    0,
    left.textContent.length,
    editorOrigin(state).nextId,
  );
}

/** Structural editing is a single transaction. Normal character deletion stays native. */
export function smartKeyTransaction(
  state: EditorState,
  key: SmartKey,
): EditorCommandResult {
  if (key === 'ShiftEnter')
    return refused('Hard breaks require a proven Fountain round trip');
  if (key === 'Enter') return enter(state);
  return join(state, key);
}

/** Explicit picker primitive; the picker and shortcut registry are M3-06. */
export function convertEditorSelection(
  state: EditorState,
  kind: string,
): EditorCommandResult {
  if (
    !screenplaySchema.nodes[kind] ||
    [
      'doc',
      'text',
      'raw',
      'title',
      'titleContinuation',
      'note',
      'boneyard',
      'pageBreak',
    ].includes(kind)
  )
    return refused('Unsupported element type');
  const start = location(state, state.selection.from);
  const finish = location(state, state.selection.to);
  const rows = state.doc.content.content.slice(start.index, finish.index + 1);
  if (!rows.length || !editable(rows))
    return refused('Protected source cannot be converted');
  if (rows.some((node) => node.type.name === 'note'))
    return refused('A note needs an explicit whole-region conversion');
  const selectedIds = new Set(rows.map((node) => node.attrs.id));
  if (
    rows.some(
      (node) =>
        node.type.name === 'character' &&
        kind !== 'character' &&
        state.doc.content.content.some(
          (other) =>
            !selectedIds.has(other.attrs.id) &&
            other.attrs.speechOf === node.attrs.id,
        ),
    )
  )
    return refused('Convert the speaker and its complete dialogue together');
  if (
    (kind === 'dialogue' || kind === 'parenthetical') &&
    rows.some((node) => !node.attrs.speechOf)
  )
    return refused('Speech conversion needs an attached speaker');
  if (
    kind === 'parenthetical' &&
    rows.some(
      (node) => node.textContent && !/^\([^)]*(?:\))?$/.test(node.textContent),
    )
  )
    return refused('Parenthetical text needs a safe wrapped form');
  const converted = rows.map((node) =>
    newNode(kind, node, String(node.attrs.id), node.content),
  );
  return replaceRows(
    state,
    start.index,
    rows.length,
    converted,
    0,
    start.offset,
    editorOrigin(state).nextId,
  );
}
