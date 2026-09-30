/** Exact physical-row permutations. No normalization, conversion or native authority. */
import { parseFountain, semanticView } from './fountainCodec';
import type { FountainDocument, FountainRecovery } from './fountainModel';
import {
  buildManuscriptIndex,
  indexDescribesDocument,
  type ManuscriptIndex,
} from './manuscriptIndex';

export interface MoveRequest {
  readonly itemId: string;
  readonly targetId: string;
  readonly placement: 'before' | 'after';
}
export interface MoveReview {
  readonly status: 'ready' | 'refused';
  readonly reason: string;
  readonly request: MoveRequest;
  readonly kind: 'scene' | 'section';
  readonly from: number;
  readonly to: number;
  readonly rows: number;
  readonly byteLength: number;
  readonly ambiguities: readonly { from: number; to: number; moves: boolean }[];
  readonly originalBytes: Uint8Array;
  readonly candidateBytes: Uint8Array | null;
  readonly movedBytes: Uint8Array;
}
interface ReadyMove {
  readonly document: FountainDocument;
  readonly order: readonly number[];
}
const ready = new WeakMap<MoveReview, ReadyMove>();
export function readyMove(review: MoveReview): ReadyMove {
  const result = ready.get(review);
  if (!result) throw new Error('Move has no verified exact-source plan');
  return result;
}

/** Literal preceding-owner policy; every boundary ambiguity is shown, never split. */
export function planSourceMove(
  document: FountainDocument,
  index: ManuscriptIndex,
  request: MoveRequest,
): MoveReview {
  const original = document.bytes;
  const item = index.items.find((entry) => entry.id === request.itemId);
  const target = index.items.find((entry) => entry.id === request.targetId);
  let candidate: Uint8Array | null = null;
  const from = item?.row ?? 0;
  const to = item?.endRow ?? 0;
  const moved = item
    ? original.slice(item.sourceStart, item.sourceEnd)
    : new Uint8Array();
  const ambiguities = index.attachments
    .filter(
      (a) =>
        a.ambiguous &&
        ((a.from >= from && a.from < to) ||
          a.candidates.includes(request.itemId) ||
          a.candidates.includes(request.targetId)),
    )
    .map((a) =>
      Object.freeze({
        from: a.from,
        to: a.to,
        moves: a.from >= from && a.to <= to,
      }),
    );
  const review = (status: MoveReview['status'], reason: string): MoveReview =>
    Object.freeze({
      status,
      reason,
      request: Object.freeze({ ...request }),
      kind: item?.kind ?? 'scene',
      from,
      to,
      rows: to - from,
      byteLength: moved.length,
      ambiguities: Object.freeze(ambiguities),
      get originalBytes() {
        return original.slice();
      },
      get candidateBytes() {
        return candidate?.slice() ?? null;
      },
      get movedBytes() {
        return moved.slice();
      },
    });
  if (document.readOnlyReason)
    return review('refused', document.readOnlyReason);
  // A caller cannot reuse another source's advisory ranges.
  if (!indexDescribesDocument(index, document))
    return review(
      'refused',
      'Outline does not describe this source. Refresh the preview.',
    );
  if (
    !item ||
    !target ||
    item === target ||
    item.kind !== target.kind ||
    !['before', 'after'].includes(request.placement)
  )
    return review('refused', 'Choose a different heading of the same kind.');
  if (
    item.kind === 'section' &&
    (item.level !== target.level || item.parentId !== target.parentId)
  )
    return review(
      'refused',
      'Sections can move beside sections at the same level and parent, keeping their entire subtree.',
    );
  const insertion = request.placement === 'before' ? target.row : target.endRow;
  if (insertion >= from && insertion <= to)
    return review(
      'refused',
      'This position would leave the order unchanged or move inside its own subtree.',
    );
  for (const range of index.intact) {
    const split = [from, to, insertion].some(
      (row) => range.from < row && row < range.to,
    );
    if (split)
      return review(
        'refused',
        `Move would split an intact ${range.kind} region. Original source retained.`,
      );
    if (range.kind === 'title' && range.from < to && range.to > from)
      return review(
        'refused',
        'Title-page fields cannot move with outline headings.',
      );
  }
  const order = Array.from({ length: document.lines.length }, (_, row) => row);
  const block = order.splice(from, to - from);
  order.splice(
    insertion > to ? insertion - block.length : insertion,
    0,
    ...block,
  );
  candidate = new Uint8Array(original.length);
  const bom = document.bom ? 3 : 0;
  candidate.set(original.subarray(0, bom));
  let offset = bom;
  const recovery: FountainRecovery = {
    schema: 1,
    bom: document.bom,
    nextId: document.recovery.nextId,
    lines: order.map((row) => {
      const line = document.lines[row]!;
      const start = offset;
      candidate!.set(
        original.subarray(line.sourceStart, line.sourceEnd),
        offset,
      );
      offset += line.sourceEnd - line.sourceStart;
      return {
        ...document.recovery.lines[row]!,
        sourceStart: start,
        sourceEnd: offset,
      };
    }),
  };
  const next = parseFountain(candidate, recovery);
  if (
    next.lines.length !== order.length ||
    next.diagnostics.some((d) => d.code === 'recovery-mismatch')
  )
    return review(
      'refused',
      'Exact bytes would join source rows (including an unterminated EOF). Review copies retained; no separators were added.',
    );
  const meaning = (doc: FountainDocument) =>
    semanticView(doc).map((value, row) => {
      const line = doc.lines[row]!;
      return {
        ...value,
        dualWith: doc.lines[line.dualWith ?? -1]?.id,
        speechOf: line.speechOf,
        titleOf: line.titleOf,
        hiddenOf: line.hiddenOf,
        editable: line.editable,
        intendedKind: line.intendedKind,
        actionSubtype: line.actionSubtype,
        blankRole: line.blankRole,
      };
    });
  const before = meaning(document);
  const after = meaning(next);
  if (
    order.some(
      (row, at) => JSON.stringify(before[row]) !== JSON.stringify(after[at]),
    )
  )
    return review(
      'refused',
      'Exact bytes would change Fountain meaning at a boundary. Review copies retained; no conversion was applied.',
    );
  const nextIndex = buildManuscriptIndex(next);
  const nextItems = new Map(nextIndex.items.map((entry) => [entry.id, entry]));
  if (
    index.items.some((entry) => {
      const changed = nextItems.get(entry.id);
      return (
        !changed ||
        ((entry.id !== item.id || item.kind === 'section') &&
          changed.parentId !== entry.parentId)
      );
    })
  )
    return review(
      'refused',
      'This position would change another heading’s section ownership. Source retained.',
    );
  const result = review('ready', 'Exact source and complete regions verified.');
  ready.set(
    result,
    Object.freeze({ document: next, order: Object.freeze(order) }),
  );
  return result;
}
