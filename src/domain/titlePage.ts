/** Explicit title authorship; untouched rows are retained byte for byte. */
import {
  FountainEditError,
  parseFountain,
  replaceTitleField,
  semanticView,
  serializeFountain,
} from './fountainCodec';
import type { FountainDocument, FountainRecovery } from './fountainModel';

export type TitleAction =
  | { kind: 'edit'; id: string; key: string; values: readonly string[] }
  | { kind: 'add'; key: string; values: readonly string[] }
  | { kind: 'remove'; id: string }
  | { kind: 'move'; id: string; direction: 'up' | 'down' };

function meaning(document: FountainDocument) {
  return semanticView(document).map((value, index) => {
    const line = document.lines[index]!;
    return {
      ...value,
      dualWith: document.lines[line.dualWith ?? -1]?.id,
      speechOf: line.speechOf,
      titleOf: line.titleOf,
      hiddenOf: line.hiddenOf,
      intendedKind: line.intendedKind,
      actionSubtype: line.actionSubtype,
      blankRole: line.blankRole,
      editable: line.editable,
    };
  });
}

export function changeTitlePage(
  document: FountainDocument,
  action: TitleAction,
): FountainDocument {
  const original = serializeFountain(document); // verifies codec ownership
  if (document.readOnlyReason)
    throw new FountainEditError('read-only', document.readOnlyReason);
  if (action.kind === 'edit')
    return replaceTitleField(document, action.id, action.key, action.values);
  const field =
    action.kind === 'add'
      ? null
      : document.titleFields.find((f) => f.id === action.id);
  if (action.kind !== 'add' && !field)
    throw new FountainEditError('range', 'Title field no longer exists.');
  let nextId = document.recovery.nextId;
  type Row = FountainRecovery['lines'][number];
  const rows: Row[] = [...document.recovery.lines];
  if (action.kind === 'remove') {
    rows.splice(field!.from, field!.count);
  } else if (action.kind === 'move') {
    const at = document.titleFields.indexOf(field!);
    const target =
      document.titleFields[at + (action.direction === 'up' ? -1 : 1)];
    if (!target)
      throw new FountainEditError('range', 'No title field in that direction.');
    const moved = rows.splice(field!.from, field!.count);
    rows.splice(
      action.direction === 'up'
        ? target.from
        : target.from + target.count - field!.count,
      0,
      ...moved,
    );
  } else {
    const ending = document.lines.find((l) => l.newline)?.newline ?? '\n';
    // Validate a new field with the same checked codec contract as replacements.
    // A valued first field keeps the seed a title page even for empty values;
    // the result below must still be a title page in the real document.
    const seed = parseFountain(
      new TextEncoder().encode('Seed: value' + ending + 'Title: seed' + ending),
    );
    const replaced = replaceTitleField(
      seed,
      seed.titleFields[1]!.id,
      action.key,
      action.values,
    );
    const added = { recovery: { lines: replaced.recovery.lines.slice(1) } };
    const end = document.titleFields.at(-1);
    const at = end ? end.from + end.count : 0;
    const fresh: Row[] = added.recovery.lines.map((row) => ({
      ...row,
      id: `b${nextId++}`,
    }));
    // A new page needs an explicit separator before existing body content.
    if (!end && rows.length && document.lines[0]!.kind !== 'blank')
      fresh.push({
        id: `b${nextId++}`,
        sourceStart: 0,
        sourceEnd: 0,
        sourceText: '',
        newline: ending,
      });
    // Keep the empty manuscript's original EOF convention.
    if (!rows.length)
      fresh[fresh.length - 1] = { ...fresh.at(-1)!, newline: '' };
    rows.splice(at, 0, ...fresh);
  }
  const encoded = new TextEncoder().encode(
    (document.bom ? '\ufeff' : '') +
      rows.map((r) => r.sourceText + r.newline).join(''),
  );
  let offset = document.bom ? 3 : 0;
  const recovery: FountainRecovery = {
    schema: 1,
    bom: document.bom,
    nextId,
    lines: rows.map((row) => {
      const start = offset;
      offset += new TextEncoder().encode(row.sourceText + row.newline).length;
      return { ...row, sourceStart: start, sourceEnd: offset };
    }),
  };
  const next = parseFountain(encoded, recovery);
  if (
    next.lines.length !== rows.length ||
    next.diagnostics.some((d) => d.code === 'recovery-mismatch')
  )
    throw new FountainEditError(
      'unrepresentable',
      'This action would join source rows at EOF. Source retained; no endings were changed.',
    );
  const oldMeaning = new Map(
    meaning(document).map((v, i) => [document.lines[i]!.id, v]),
  );
  const nextMeaning = meaning(next);
  for (const [i, line] of next.lines.entries()) {
    const prior = oldMeaning.get(line.id);
    if (prior && JSON.stringify(prior) !== JSON.stringify(nextMeaning[i]))
      throw new FountainEditError(
        'neighbor-drift',
        'This action would change another source region. Source retained.',
      );
  }
  if (action.kind === 'add') {
    const added = next.titleFields.at(-1);
    if (
      !added ||
      added.key !== action.key ||
      JSON.stringify(added.values.map((v) => v.text)) !==
        JSON.stringify(action.values)
    )
      throw new FountainEditError(
        'unrepresentable',
        'The new field cannot be represented at this title-page boundary.',
      );
  }
  if (
    action.kind === 'move' &&
    encoded.every((byte, i) => byte === original[i])
  )
    return document;
  return next;
}
