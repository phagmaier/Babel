import type {
  CodecDiagnostic,
  FountainDocument,
  FountainKind,
  FountainLine,
  FountainRecovery,
  LineEdit,
  Newline,
  SourceLineEdit,
  ConversionProposal,
  StyledText,
} from './fountainModel.ts';
import { parseInline, richView, sourceForInline } from './fountainInline.ts';
import { structureFountain } from './fountainStructure.ts';
import { unescapedIndex } from './fountainSyntax.ts';

// No writable source buffer is exposed to consumers, even through document.bytes.
const snapshots = new WeakMap<FountainDocument, Uint8Array>();
const nextIds = new WeakMap<FountainDocument, number>();
const encoder = new TextEncoder();
// Preserve U+FEFF inside individual lines; only the file's leading BOM is special.
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const heading = /^(?:INT|EXT|EST|INT\.\/EXT|INT\/EXT|I\/E)(?:\.|\s)/i;
const numberSuffix = /\s+#([\p{L}\p{N}.-]+)#$/u;
const protectedKinds = new Set<FountainKind>([
  'title',
  'titleContinuation',
  'note',
  'boneyard',
  'raw',
]);

export class FountainEditError extends Error {
  readonly code:
    | 'read-only'
    | 'range'
    | 'protected-region'
    | 'invalid-edit'
    | 'round-trip'
    | 'neighbor-drift'
    | 'unrepresentable'
    | 'stale-conversion';
  constructor(code: FountainEditError['code'], message: string) {
    super(message);
    this.code = code;
    this.name = 'FountainEditError';
  }
}

function physicalLines(bytes: Uint8Array, start: number): FountainLine[] {
  const lines: FountainLine[] = [];
  for (let at = start; at < bytes.length;) {
    let end = at;
    while (end < bytes.length && bytes[end] !== 10 && bytes[end] !== 13) end++;
    let next = end;
    if (bytes[next] === 13) next++;
    if (bytes[next] === 10) next++;
    const sourceText = decoder.decode(bytes.subarray(at, end));
    lines.push({
      id: `b${lines.length}`,
      kind: 'raw',
      text: sourceText,
      sourceText,
      sourceStart: at,
      contentEnd: end,
      sourceEnd: next,
      newline: decoder.decode(bytes.subarray(end, next)) as Newline,
      editable: true,
    });
    at = next;
  }
  return lines;
}

function classify(
  lines: readonly FountainLine[],
  diagnostics: CodecDiagnostic[],
): FountainLine[] {
  const result: FountainLine[] = [];
  let inTitle = true;
  let speaker: number | undefined;
  let previousSpeaker: number | undefined;
  let hidden:
    { kind: 'note' | 'boneyard'; close: string; start: number } | undefined;
  const diagnose = (
    code: CodecDiagnostic['code'],
    line: number,
    message: string,
  ) => diagnostics.push({ code, line, message });

  for (const [index, line] of lines.entries()) {
    const raw = line.sourceText;
    const leadingTrimmed = raw.trimStart();
    const trimmed = raw.trim();
    const prevBlank = index === 0 || lines[index - 1]!.sourceText.trim() === '';
    const nextRaw = lines[index + 1]?.sourceText ?? '';
    const nextBlank = nextRaw.trim() === '';
    const hasSpeech = !nextBlank || nextRaw === '  ';
    const emit = (
      kind: FountainKind,
      text = raw,
      fields: Partial<FountainLine> = {},
    ) => {
      result.push({
        ...line,
        kind,
        text,
        editable: !protectedKinds.has(kind),
        ...fields,
      });
    };
    if (hidden) {
      emit(hidden.kind);
      if (unescapedIndex(raw, hidden.close) >= 0) {
        // Mixed visible text stays raw; region spans are derived separately.
        if (
          raw
            .slice(unescapedIndex(raw, hidden.close) + hidden.close.length)
            .trim() !== ''
        ) {
          result[result.length - 1] = {
            ...result.at(-1)!,
            kind: 'raw',
            editable: false,
          };
          diagnose(
            'unsupported-region',
            index,
            'Mixed hidden/visible content retained verbatim',
          );
        }
        hidden = undefined;
      }
      continue;
    }
    if (speaker !== undefined && raw === '  ') {
      emit('dialogue', raw, { speechOf: lines[speaker]!.id });
      continue;
    }
    if (trimmed === '') {
      emit('blank', raw, { blankRole: 'source' });
      speaker = undefined;
      inTitle = false;
      continue;
    }
    if (inTitle) {
      const field = /^([^:\r\n]+):[ \t]?(.*)$/.exec(raw);
      if (field && !/^\s/.test(field[1]!) && !/^[!@>.~#=]/.test(raw)) {
        emit('title', field[2]!, { titleKey: field[1] });
        continue;
      }
      if (
        /^(?: {3,}|\t)/.test(raw) &&
        ['title', 'titleContinuation'].includes(result.at(-1)?.kind ?? '')
      ) {
        emit('titleContinuation', raw.trimStart());
        continue;
      }
      inTitle = false;
    }
    if (leadingTrimmed.startsWith('[[') || leadingTrimmed.startsWith('/*')) {
      const kind = leadingTrimmed.startsWith('[[') ? 'note' : 'boneyard';
      const close = kind === 'note' ? ']]' : '*/';
      const end = unescapedIndex(leadingTrimmed, close, 2);
      emit(end >= 0 && leadingTrimmed.slice(end + 2).trim() ? 'raw' : kind);
      if (end < 0) hidden = { kind, close, start: index };
      speaker = undefined;
      continue;
    }
    if (
      raw.includes('{{') ||
      ['[[', ']]', '/*', '*/'].some(
        (marker) => unescapedIndex(raw, marker) >= 0,
      )
    ) {
      emit('raw');
      const opening = ['[[', '/*']
        .map((marker) => ({ marker, at: unescapedIndex(raw, marker) }))
        .filter((candidate) => candidate.at >= 0)
        .sort((a, b) => a.at - b.at)[0];
      if (opening) {
        const kind = opening.marker === '[[' ? 'note' : 'boneyard';
        const close = kind === 'note' ? ']]' : '*/';
        if (unescapedIndex(raw, close, opening.at + 2) < 0)
          hidden = { kind, close, start: index };
      }
      diagnose(
        'unsupported-region',
        index,
        'Unsupported or mixed region retained verbatim; conversion refused',
      );
      speaker = undefined;
      continue;
    }
    // Explicit element syntax outranks inferred speech; reparse validation protects neighbors.
    if (leadingTrimmed.startsWith('!')) {
      emit('action', leadingTrimmed.slice(1), { marker: '!' });
      speaker = undefined;
      continue;
    }
    if (/^\.[\p{L}\p{N}]/u.test(leadingTrimmed)) {
      const text = leadingTrimmed.slice(1);
      const match = numberSuffix.exec(text);
      emit('sceneHeading', match ? text.slice(0, match.index) : text, {
        marker: '.',
        sceneNumber: match?.[1],
      });
      speaker = undefined;
      continue;
    }
    if (/^#+(?:\s|$)/.test(leadingTrimmed)) {
      const marker = /^#+/.exec(leadingTrimmed)![0];
      emit('section', leadingTrimmed.slice(marker.length).trimStart(), {
        marker,
        sectionLevel: marker.length,
      });
      speaker = undefined;
      continue;
    }
    if (/^={3,}$/.test(trimmed)) {
      emit('pageBreak', trimmed, { marker: trimmed });
      speaker = undefined;
      continue;
    }
    if (/^=(?!==)/.test(leadingTrimmed)) {
      emit('synopsis', leadingTrimmed.slice(1).trimStart(), { marker: '=' });
      speaker = undefined;
      continue;
    }
    if (leadingTrimmed.startsWith('~')) {
      emit('lyrics', leadingTrimmed.slice(1), { marker: '~' });
      speaker = undefined;
      continue;
    }
    if (leadingTrimmed.startsWith('>')) {
      const centered = leadingTrimmed.trimEnd().endsWith('<');
      emit(
        centered ? 'centered' : 'transition',
        centered
          ? leadingTrimmed.trimEnd().slice(1, -1)
          : leadingTrimmed.slice(1),
        { marker: centered ? '><' : '>' },
      );
      speaker = undefined;
      continue;
    }
    const forcedCue = leadingTrimmed.startsWith('@');
    const cueText = (
      forcedCue ? leadingTrimmed.slice(1) : leadingTrimmed
    ).replace(/\s*\^$/, '');
    const extension = /\s+(\([^()]*\))$/.exec(cueText);
    const name = extension ? cueText.slice(0, extension.index) : cueText;
    const automaticCue = /\p{L}/u.test(name) && name === name.toUpperCase();
    if (
      forcedCue ||
      (speaker === undefined && prevBlank && hasSpeech && automaticCue)
    ) {
      let prior = result.length - 1;
      while (prior >= 0 && result[prior]!.kind === 'blank') prior--;
      const dualMarker = leadingTrimmed.endsWith('^');
      const dualWith =
        dualMarker &&
        ['dialogue', 'parenthetical'].includes(result[prior]?.kind ?? '')
          ? previousSpeaker
          : undefined;
      emit('character', cueText, {
        marker: forcedCue ? '@' : undefined,
        characterName: name,
        characterExtension: extension?.[1],
        dualMarker: dualMarker || undefined,
        dualWith,
      });
      speaker = hasSpeech ? index : undefined;
      previousSpeaker = index;
      if (!hasSpeech)
        diagnose(
          'incomplete-cue',
          index,
          'Incomplete character cue; external interpretation may differ',
        );
      if (dualMarker && dualWith === undefined)
        diagnose(
          'unpaired-dual',
          index,
          'Dual marker has no preceding dialogue group',
        );
      continue;
    }
    if (speaker !== undefined) {
      const parenthetical = /^\([^)]*\)$/.test(trimmed);
      const malformed = trimmed.startsWith('(') && !parenthetical;
      emit(
        parenthetical ? 'parenthetical' : 'dialogue',
        parenthetical ? trimmed : raw,
        { speechOf: lines[speaker]!.id, editable: !malformed },
      );
      if (malformed)
        diagnose(
          'malformed-parenthetical',
          index,
          'Incomplete parenthetical retained verbatim; structured conversion refused',
        );
      continue;
    }
    if (prevBlank && nextBlank && heading.test(leadingTrimmed)) {
      const match = numberSuffix.exec(leadingTrimmed);
      emit(
        'sceneHeading',
        match ? leadingTrimmed.slice(0, match.index) : leadingTrimmed,
        { sceneNumber: match?.[1] },
      );
    } else if (
      prevBlank &&
      nextBlank &&
      /\p{L}/u.test(leadingTrimmed) &&
      leadingTrimmed === leadingTrimmed.toUpperCase() &&
      leadingTrimmed.endsWith('TO:')
    ) {
      emit('transition', leadingTrimmed);
    } else {
      const malformed = trimmed.startsWith('(') && !/^\([^)]*\)$/.test(trimmed);
      emit('action', raw, { editable: !malformed });
      if (malformed)
        diagnose(
          'malformed-parenthetical',
          index,
          'Incomplete parenthetical retained as authored action; structured conversion refused',
        );
    }
  }
  if (hidden)
    diagnose(
      'unclosed-region',
      hidden.start,
      'Unclosed hidden region retained through EOF; editing requires complex-region support',
    );
  return result;
}

function recoveryFor(
  lines: readonly FountainLine[],
  nextId: number,
  bom: boolean,
): FountainRecovery {
  return Object.freeze({
    schema: 1,
    bom,
    nextId,
    lines: Object.freeze(
      lines.map(
        ({
          id,
          sourceStart,
          sourceEnd,
          sourceText,
          newline,
          intendedKind,
          actionSubtype,
        }) =>
          Object.freeze({
            id,
            sourceStart,
            sourceEnd,
            sourceText,
            newline,
            intendedKind,
            actionSubtype,
          }),
      ),
    ),
  });
}

function snapshot(
  bytes: Uint8Array,
  lines: readonly FountainLine[],
  diagnostics: readonly CodecDiagnostic[],
  bom: boolean,
  readOnlyReason?: string,
  nextId = lines.reduce(
    (next, line) => Math.max(next, Number(line.id.slice(1)) + 1),
    0,
  ),
): FountainDocument {
  const structure = readOnlyReason
    ? {
        lines,
        titleFields: [],
        hiddenRegions: [],
        dialogueGroups: [],
        sourceBreaks: [],
        diagnostics: [],
      }
    : structureFountain(bytes, lines, bom);
  const frozenLines = Object.freeze(
    structure.lines.map((line) => Object.freeze({ ...line })),
  );
  const document: FountainDocument = Object.freeze({
    get bytes() {
      return bytes.slice();
    },
    lines: frozenLines,
    bom,
    readOnlyReason,
    diagnostics: Object.freeze(
      [
        ...new Map(
          [...diagnostics, ...structure.diagnostics].map((diagnostic) => [
            JSON.stringify(diagnostic),
            diagnostic,
          ]),
        ).values(),
      ].map((diagnostic) => Object.freeze({ ...diagnostic })),
    ),
    recovery: recoveryFor(frozenLines, nextId, bom),
    titleFields: Object.freeze(structure.titleFields),
    hiddenRegions: Object.freeze(structure.hiddenRegions),
    dialogueGroups: Object.freeze(structure.dialogueGroups),
    sourceBreaks: Object.freeze(structure.sourceBreaks),
  });
  snapshots.set(document, bytes);
  nextIds.set(document, nextId);
  return document;
}

/** Authored incomplete syntax can be continued only with exact matching draft intent. */
function compatibleDraft(
  line: FountainLine,
  intent: FountainLine['intendedKind'],
): boolean {
  if (intent === undefined) return true;
  if (!['character', 'dialogue', 'parenthetical'].includes(intent))
    return false;
  if (intent === 'character')
    return line.kind === 'character' && line.text === '';
  if (line.kind === 'blank' && line.text === '') return true;
  const incomplete = /^\([^)]*$/.test(line.text);
  if (intent === 'dialogue') return line.kind === 'dialogue' && incomplete;
  return (
    intent === 'parenthetical' &&
    incomplete &&
    (line.kind === 'dialogue' || line.kind === 'action')
  );
}

function draftIntent(edit: LineEdit): FountainLine['intendedKind'] {
  if (edit.kind === 'character' && edit.text === '') return 'character';
  if (
    (edit.kind === 'dialogue' || edit.kind === 'parenthetical') &&
    (edit.text === '' || /^\([^)]*$/.test(edit.text))
  )
    return edit.kind;
  return undefined;
}

function applyRecovery(
  lines: FountainLine[],
  recovery: FountainRecovery | undefined,
  diagnostics: CodecDiagnostic[],
  bom: boolean,
): FountainLine[] {
  if (!recovery) return lines;
  const ids = new Set<string>();
  const valid =
    typeof recovery === 'object' &&
    recovery.schema === 1 &&
    recovery.bom === bom &&
    Number.isSafeInteger(recovery.nextId) &&
    recovery.nextId >= lines.length &&
    recovery.nextId < Number.MAX_SAFE_INTEGER &&
    Array.isArray(recovery.lines) &&
    recovery.lines.length === lines.length &&
    recovery.lines.every((entry, index) => {
      if (!entry || typeof entry !== 'object') return false;
      const line = lines[index]!;
      const unique =
        typeof entry.id === 'string' &&
        /^b(?:0|[1-9]\d*)$/.test(entry.id) &&
        Number.isSafeInteger(Number(entry.id.slice(1))) &&
        Number(entry.id.slice(1)) < recovery.nextId &&
        !ids.has(entry.id);
      ids.add(entry.id);
      return (
        unique &&
        entry.sourceStart === line.sourceStart &&
        entry.sourceEnd === line.sourceEnd &&
        entry.sourceText === line.sourceText &&
        entry.newline === line.newline &&
        (entry.actionSubtype === undefined ||
          (entry.actionSubtype === 'shot' && line.kind === 'action')) &&
        compatibleDraft(line, entry.intendedKind)
      );
    });
  if (!valid) {
    diagnostics.push({
      code: 'recovery-mismatch',
      message:
        'Draft metadata does not match exact source lines; ignored without changing source',
    });
    return lines;
  }
  const idMap = new Map(
    lines.map((line, index) => [line.id, recovery.lines[index]!.id]),
  );
  return lines.map((line, index) => {
    const entry = recovery.lines[index]!;
    if (entry.intendedKind)
      diagnostics.push({
        code: 'draft-intent',
        line: index,
        message:
          'Incomplete block intent is recovery-only; external Fountain interpretation may differ',
      });
    return {
      ...line,
      id: entry.id,
      speechOf:
        line.speechOf === undefined ? undefined : idMap.get(line.speechOf),
      intendedKind: entry.intendedKind,
      editable: entry.intendedKind ? true : line.editable,
      actionSubtype: entry.actionSubtype,
      blankRole:
        entry.intendedKind && line.kind === 'blank' ? 'draft' : line.blankRole,
    };
  });
}

export function parseFountain(
  input: Uint8Array,
  recovery?: FountainRecovery,
): FountainDocument {
  const bytes = Uint8Array.from(input);
  const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const diagnostics: CodecDiagnostic[] = [];
  try {
    // Decode once to validate, including malformed bytes outside a parsed line.
    decoder.decode(bytes);
  } catch {
    const reason = 'Invalid UTF-8: preserve source bytes and open read-only';
    return snapshot(
      bytes,
      [],
      [{ code: 'invalid-utf8', message: reason }],
      bom,
      reason,
    );
  }
  const lines = applyRecovery(
    classify(physicalLines(bytes, bom ? 3 : 0), diagnostics),
    recovery,
    diagnostics,
    bom,
  );
  const acceptedRecovery =
    recovery &&
    !diagnostics.some((diagnostic) => diagnostic.code === 'recovery-mismatch');
  return snapshot(
    bytes,
    lines,
    diagnostics,
    bom,
    undefined,
    acceptedRecovery ? recovery.nextId : undefined,
  );
}

export function serializeFountain(document: FountainDocument): Uint8Array {
  const bytes = snapshots.get(document);
  if (!bytes) throw new TypeError('Expected a codec-owned immutable document');
  return bytes.slice();
}

/** Portable meaning. Forced markers, source locations, session IDs and Shot intent are excluded. */
export function semanticView(document: FountainDocument) {
  const indices = new Map(
    document.lines.map((line, index) => [line.id, index]),
  );
  return document.lines.map(
    ({
      kind,
      text,
      titleKey,
      sectionLevel,
      sceneNumber,
      characterName,
      characterExtension,
      dualWith,
      dualMarker,
      speechOf,
      titleOf,
      hiddenOf,
      inline,
    }) => ({
      kind,
      text,
      titleKey,
      sectionLevel,
      sceneNumber,
      characterName,
      characterExtension,
      dualWith,
      dualMarker,
      speechOf: speechOf === undefined ? undefined : indices.get(speechOf),
      titleOf: titleOf === undefined ? undefined : indices.get(titleOf),
      hiddenOf:
        hiddenOf === undefined
          ? undefined
          : hiddenOf
              .split(',')
              .map((id) =>
                document.hiddenRegions.findIndex((region) => region.id === id),
              ),
      inline: inline ? richView(inline.runs) : undefined,
    }),
  );
}

function sourceFor(edit: LineEdit, previous: FountainLine | undefined): string {
  if (/[\r\n]/.test(edit.text)) {
    // Each draft owns one physical line; multi-line changes use replaceLines explicitly.
    throw new FountainEditError(
      'invalid-edit',
      'Line text cannot contain newline characters',
    );
  }
  // TextEncoder otherwise replaces lone surrogates silently with U+FFFD.
  if (
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(
      edit.text,
    )
  )
    throw new FountainEditError(
      'invalid-edit',
      'Line text contains an unpaired UTF-16 surrogate',
    );
  if (edit.dualWith !== undefined && edit.kind !== 'character')
    throw new FountainEditError(
      'invalid-edit',
      'Dual target requires a character cue',
    );
  if (edit.sceneNumber !== undefined && edit.kind !== 'sceneHeading')
    throw new FountainEditError(
      'invalid-edit',
      'Scene number requires a heading',
    );
  if (edit.sectionLevel !== undefined && edit.kind !== 'section')
    throw new FountainEditError(
      'invalid-edit',
      'Section level requires a section',
    );
  if (
    edit.actionSubtype !== undefined &&
    ((edit.actionSubtype !== 'shot' && edit.actionSubtype !== null) ||
      edit.kind !== 'action')
  )
    throw new FountainEditError('invalid-edit', 'Shot is an action subtype');
  switch (edit.kind) {
    case 'blank':
      if (edit.text.trim() !== '')
        throw new FountainEditError(
          'invalid-edit',
          'Blank content must contain whitespace only',
        );
      return edit.text;
    case 'action':
      return `!${edit.text}`;
    case 'sceneHeading': {
      const number =
        edit.sceneNumber === undefined
          ? previous?.kind === 'sceneHeading'
            ? previous.sceneNumber
            : undefined
          : edit.sceneNumber;
      if (number != null && !/^[\p{L}\p{N}.-]+$/u.test(number))
        throw new FountainEditError('invalid-edit', 'Invalid scene number');
      return `.${edit.text}${number == null ? '' : ` #${number}#`}`;
    }
    case 'character':
      return `@${edit.text}${edit.dualWith === undefined ? (previous?.kind === 'character' && previous.dualMarker ? ' ^' : '') : edit.dualWith === null ? '' : ' ^'}`;
    case 'dialogue':
      return edit.text;
    case 'parenthetical':
      if (edit.text !== '' && !/^\([^)]*(?:\))?$/.test(edit.text))
        throw new FountainEditError(
          'invalid-edit',
          'Parenthetical must be wrapped or an incomplete opening parenthesis',
        );
      return edit.text;
    case 'transition':
      return `>${edit.text}`;
    case 'lyrics':
      return `~${edit.text}`;
    case 'centered':
      return `>${edit.text}<`;
    case 'section': {
      const level =
        edit.sectionLevel ??
        (previous?.kind === 'section' ? previous.sectionLevel : undefined) ??
        1;
      if (!Number.isSafeInteger(level) || level < 1 || level > 256)
        throw new FountainEditError(
          'invalid-edit',
          'Section level must be between 1 and 256',
        );
      return `${'#'.repeat(level)} ${edit.text}`;
    }
    case 'synopsis':
      return `= ${edit.text}`;
    case 'pageBreak':
      if (!/^={3,}$/.test(edit.text))
        throw new FountainEditError(
          'invalid-edit',
          'Page break must be three or more equals signs',
        );
      return edit.text;
    default:
      throw new FountainEditError('invalid-edit', 'Unsupported element type');
  }
}

/** Atomic grammar-context edit. Only the declared physical lines may change interpretation. */
export function replaceLines(
  document: FountainDocument,
  from: number,
  count: number,
  edits: readonly LineEdit[],
  retainedIds?: readonly string[],
): FountainDocument {
  const bytes = snapshots.get(document);
  if (!bytes) throw new TypeError('Expected a codec-owned immutable document');
  if (document.readOnlyReason)
    throw new FountainEditError('read-only', document.readOnlyReason);
  if (
    !Number.isSafeInteger(from) ||
    !Number.isSafeInteger(count) ||
    from < 0 ||
    count < 0 ||
    from + count > document.lines.length
  )
    throw new FountainEditError('range', 'Invalid source line range');
  const owned = document.lines.slice(from, from + count);
  if (owned.some((line) => !line.editable))
    throw new FountainEditError(
      'protected-region',
      'Structured editing of raw/title/hidden/malformed regions requires explicit safe conversion',
    );
  if (count === 0 && edits.length === 0) return document;
  if (
    retainedIds &&
    (retainedIds.length !== edits.length ||
      retainedIds.some(
        (id) =>
          !/^b(?:0|[1-9]\d*)$/.test(id) ||
          !Number.isSafeInteger(Number(id.slice(1))) ||
          Number(id.slice(1)) >= Number.MAX_SAFE_INTEGER - 1,
      ) ||
      new Set(retainedIds).size !== retainedIds.length ||
      document.lines.some(
        (line, index) =>
          (index < from || index >= from + count) &&
          retainedIds.includes(line.id),
      ))
  )
    throw new FountainEditError('invalid-edit', 'Invalid retained line IDs');
  const priorById = retainedIds
    ? new Map(document.lines.map((line) => [line.id, line]))
    : undefined;
  const sources = edits.map((edit, index) => {
    const prior = retainedIds
      ? priorById!.get(retainedIds[index]!)
      : owned[index];
    const generated = sourceFor(edit, prior);
    if (
      prior &&
      prior.kind === edit.kind &&
      prior.text === edit.text &&
      (edit.sceneNumber === undefined ||
        (edit.sceneNumber ?? undefined) === prior.sceneNumber) &&
      (edit.sectionLevel === undefined ||
        edit.sectionLevel === prior.sectionLevel) &&
      edit.dualWith === undefined
    )
      return prior.sourceText;
    return generated;
  });
  return transactSource(
    document,
    from,
    count,
    sources,
    (after) => {
      const lines = after.lines;
      for (const [offset, edit] of edits.entries()) {
        const line = lines[from + offset]!;
        const recoverableDraft =
          line.intendedKind === edit.kind &&
          compatibleDraft(line, line.intendedKind);
        if (
          (!recoverableDraft && line.kind !== edit.kind) ||
          line.text !== edit.text ||
          !line.editable
        )
          throw new FountainEditError(
            'round-trip',
            'Requested element cannot round-trip unambiguously; source remains unchanged',
          );
        const prior = owned[offset];
        const expectedNumber =
          edit.kind === 'sceneHeading'
            ? edit.sceneNumber === undefined
              ? prior?.kind === 'sceneHeading'
                ? prior.sceneNumber
                : undefined
              : (edit.sceneNumber ?? undefined)
            : undefined;
        const expectedLevel =
          edit.kind === 'section'
            ? (edit.sectionLevel ??
              (prior?.kind === 'section' ? prior.sectionLevel : undefined) ??
              1)
            : undefined;
        if (
          line.sceneNumber !== expectedNumber ||
          line.sectionLevel !== expectedLevel
        )
          throw new FountainEditError(
            'round-trip',
            'Requested element fields cannot round-trip unambiguously',
          );
        if (edit.dualWith !== undefined)
          validateDualContext(
            document,
            after,
            from,
            count,
            edits.length,
            offset,
          );
        if (
          edit.dualWith !== undefined &&
          (edit.dualWith === null
            ? line.dualMarker
            : lines[line.dualWith ?? -1]?.id !== edit.dualWith)
        )
          throw new FountainEditError(
            'round-trip',
            'Requested dual group does not match source grouping',
          );
        // Group relationship transformations need explicit ownership and intent.
        if (
          (edit.dualWith === undefined &&
            prior?.dualMarker !== line.dualMarker) ||
          (edit.dualWith === undefined &&
            prior?.dualWith !== undefined &&
            document.lines[prior.dualWith]?.id !==
              lines[line.dualWith ?? -1]?.id)
        )
          throw new FountainEditError(
            'round-trip',
            'Dual relationship transformation requires explicit owned group intent',
          );
      }
    },
    edits,
    retainedIds,
  );
}

function transactSource(
  document: FountainDocument,
  from: number,
  count: number,
  sources: readonly string[],
  validate: (after: FountainDocument) => void,
  intents?: readonly LineEdit[],
  retainedIds?: readonly string[],
): FountainDocument {
  const bytes = snapshots.get(document)!;
  const owned = document.lines.slice(from, from + count);
  const defaultNewline =
    owned.find((line) => line.newline !== '')?.newline ||
    document.lines[from - 1]?.newline ||
    document.lines[from]?.newline ||
    document.lines.find((line) => line.newline !== '')?.newline ||
    '\n';
  const start = document.lines[from]?.sourceStart ?? bytes.length;
  const end = owned.at(-1)?.sourceEnd ?? start;
  // Preserve existing endings per line and EOF convention. New contexts inherit a local ending.
  const endings = sources.map((_, index) => {
    if (
      index === sources.length - 1 &&
      count > 0 &&
      from + count === document.lines.length
    )
      return sources[index] === '' && sources.length > count
        ? defaultNewline
        : owned.at(-1)!.newline;
    return owned[index]?.newline || defaultNewline;
  });
  if (
    count === 0 &&
    from === document.lines.length &&
    document.lines.at(-1)?.newline === ''
  )
    throw new FountainEditError(
      'invalid-edit',
      'EOF insertion requires owning the preceding line without a newline',
    );
  const replacement = encoder.encode(
    sources.map((text, index) => text + endings[index]).join(''),
  );
  const output = new Uint8Array(
    bytes.length - (end - start) + replacement.length,
  );
  output.set(bytes.subarray(0, start));
  output.set(replacement, start);
  output.set(bytes.subarray(end), start + replacement.length);
  const reparsed = parseFountain(output);
  if (reparsed.lines.length !== document.lines.length - count + sources.length)
    throw new FountainEditError(
      'round-trip',
      'Edit cannot retain every intended source line (empty EOF needs a line ending)',
    );
  const idUsed = new Set(document.lines.map((line) => line.id));
  let nextId = nextIds.get(document)!;
  if (retainedIds)
    for (const id of retainedIds)
      nextId = Math.max(nextId, Number(id.slice(1)) + 1);
  const allocate = () => {
    while (idUsed.has(`b${nextId}`)) nextId++;
    const id = `b${nextId++}`;
    idUsed.add(id);
    return id;
  };
  const lines = reparsed.lines.map((line, index): FountainLine => {
    const inside = index >= from && index < from + sources.length;
    const previous =
      index < from
        ? document.lines[index]
        : inside
          ? owned[index - from]
          : document.lines[index - sources.length + count];
    const edit = inside ? intents?.[index - from] : undefined;
    const intendedKind = edit
      ? draftIntent(edit)
      : inside && previous?.sourceText !== line.sourceText
        ? undefined
        : previous?.intendedKind;
    return {
      ...line,
      id: inside
        ? (retainedIds?.[index - from] ?? previous?.id ?? allocate())
        : previous!.id,
      intendedKind,
      editable:
        intendedKind && compatibleDraft(line, intendedKind)
          ? true
          : line.editable,
      actionSubtype:
        line.kind === 'action'
          ? edit?.actionSubtype === null
            ? undefined
            : (edit?.actionSubtype ??
              (previous?.kind === 'action'
                ? previous.actionSubtype
                : undefined))
          : undefined,
      blankRole:
        line.kind === 'blank' && intendedKind ? 'draft' : line.blankRole,
    };
  });
  // Remap parser-local speech IDs to the retained session IDs.
  const parsedIndices = new Map(
    reparsed.lines.map((line, index) => [line.id, index]),
  );
  for (const [index, line] of lines.entries()) {
    const parsed = reparsed.lines[index]!;
    if (parsed.speechOf !== undefined) {
      const cueIndex = parsedIndices.get(parsed.speechOf)!;
      lines[index] = { ...line, speechOf: lines[cueIndex]!.id };
    }
  }
  const afterDocument = snapshot(
    output,
    lines,
    reparsed.diagnostics,
    reparsed.bom,
  );
  validate(afterDocument);
  const beforeMeaning = semanticView(document);
  const afterMeaning = semanticView(afterDocument);
  for (const [index, prior] of document.lines.entries()) {
    if (index >= from && index < from + count) continue;
    const nextIndex = index < from ? index : index - count + sources.length;
    const next = afterDocument.lines[nextIndex]!;
    const before = {
      ...beforeMeaning[index],
      dualWith: document.lines[prior.dualWith ?? -1]?.id,
      speechOf: prior.speechOf,
      titleOf: prior.titleOf,
      hiddenOf: prior.hiddenOf,
    };
    const after = {
      ...afterMeaning[nextIndex],
      dualWith: afterDocument.lines[next.dualWith ?? -1]?.id,
      speechOf: next.speechOf,
      titleOf: next.titleOf,
      hiddenOf: next.hiddenOf,
    };
    if (
      JSON.stringify(before) !== JSON.stringify(after) ||
      prior.editable !== next.editable ||
      prior.intendedKind !== next.intendedKind ||
      prior.actionSubtype !== next.actionSubtype
    )
      throw new FountainEditError(
        'neighbor-drift',
        'Edit would change neighboring Fountain interpretation; include affected lines explicitly',
      );
  }

  const diagnostics = [...reparsed.diagnostics];
  for (const [index, line] of lines.entries()) {
    if (line.intendedKind)
      diagnostics.push({
        code: 'draft-intent',
        line: index,
        message:
          'Incomplete block intent is recovery-only; external Fountain interpretation may differ',
      });
  }
  // Exact no-op edits retain original syntax, including unforced spelling and indentation.
  const sameMeaning =
    lines.length === document.lines.length &&
    lines.every((line, index) => {
      const prior = document.lines[index]!;
      return (
        JSON.stringify(afterMeaning[index]) ===
          JSON.stringify(beforeMeaning[index]) &&
        line.intendedKind === prior.intendedKind &&
        line.actionSubtype === prior.actionSubtype &&
        line.id === prior.id
      );
    });
  if (sameMeaning) return document;
  return snapshot(output, lines, diagnostics, reparsed.bom, undefined, nextId);
}

export function replaceLine(
  document: FountainDocument,
  index: number,
  edit: LineEdit,
): FountainDocument {
  return replaceLines(document, index, 1, [edit]);
}

function sourceContext(
  document: FountainDocument,
  from: number,
  count: number,
  conversion: boolean,
  mixedHidden: boolean,
) {
  if (!snapshots.has(document))
    throw new TypeError('Expected a codec-owned immutable document');
  if (document.readOnlyReason)
    throw new FountainEditError('read-only', document.readOnlyReason);
  if (
    !Number.isSafeInteger(from) ||
    !Number.isSafeInteger(count) ||
    from < 0 ||
    count < 0 ||
    from + count > document.lines.length
  )
    throw new FountainEditError('range', 'Invalid source line range');
  const end = from + count;
  const intersects = (start: number, length: number) =>
    start < end && start + length > from;
  const includes = (start: number, length: number) =>
    from <= start && end >= start + length;
  for (const field of document.titleFields) {
    if (
      intersects(field.from, field.count) &&
      !includes(field.from, field.count)
    )
      throw new FountainEditError(
        'protected-region',
        'Title edits must own the complete field and continuations',
      );
  }
  for (const region of document.hiddenRegions) {
    if (
      intersects(region.from, region.count) &&
      (!includes(region.from, region.count) ||
        (!conversion && (!region.closed || region.ambiguous)))
    )
      throw new FountainEditError(
        'protected-region',
        'Hidden edits must own a complete unambiguous region; preserve a copy before conversion',
      );
  }
  if (
    !conversion &&
    document.lines
      .slice(from, end)
      .some(
        (line) =>
          (line.kind === 'raw' && !mixedHidden) ||
          (!line.editable && !line.titleOf && !line.hiddenOf),
      )
  )
    throw new FountainEditError(
      'protected-region',
      'Raw or imported malformed content requires a conversion proposal',
    );
}

function validateDualContext(
  before: FountainDocument,
  after: FountainDocument,
  from: number,
  count: number,
  added: number,
  offset: number,
) {
  const prior = before.lines[from + offset];
  const line = after.lines[from + offset]!;
  const beforeTarget = before.lines[prior?.dualWith ?? -1]?.id;
  const afterTarget = after.lines[line.dualWith ?? -1]?.id;
  if (beforeTarget === afterTarget && prior?.dualMarker === line.dualMarker)
    return;
  for (const [document, cueId, target, size] of [
    [before, prior?.id, beforeTarget, count],
    [after, line.id, afterTarget, added],
  ] as const) {
    if (!target) continue;
    const right = document.dialogueGroups.find((group) => group.id === cueId)!;
    const left = document.dialogueGroups.find((group) => group.id === target)!;
    if (
      !left ||
      !right ||
      !left.complete ||
      !right.complete ||
      from > left.from ||
      from + size < right.from + right.count ||
      document.dialogueGroups.some(
        (group) =>
          (group.id === left.id && group.dualWith) ||
          (group.dualWith === left.id && group.id !== right.id) ||
          group.dualWith === right.id,
      )
    )
      throw new FountainEditError(
        'unrepresentable',
        'Dual changes must own both complete groups without overlapping a third group',
      );
  }
}

function concreteTransaction(
  document: FountainDocument,
  from: number,
  count: number,
  edits: readonly SourceLineEdit[],
  conversion = false,
  mixedHidden = false,
  retainedIds?: readonly string[],
): FountainDocument {
  sourceContext(document, from, count, conversion, mixedHidden);
  if (
    retainedIds &&
    (retainedIds.length !== edits.length ||
      new Set(retainedIds).size !== retainedIds.length ||
      retainedIds.some(
        (id) =>
          !/^b(?:0|[1-9]\d*)$/.test(id) ||
          !Number.isSafeInteger(Number(id.slice(1))) ||
          Number(id.slice(1)) >= Number.MAX_SAFE_INTEGER - 1,
      ) ||
      document.lines.some(
        (line, index) =>
          (index < from || index >= from + count) &&
          retainedIds.includes(line.id),
      ))
  )
    throw new FountainEditError('invalid-edit', 'Invalid retained line IDs');
  for (const edit of edits) {
    if (
      typeof edit.source !== 'string' ||
      /[\r\n]/.test(edit.source) ||
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(
        edit.source,
      )
    )
      throw new FountainEditError(
        'invalid-edit',
        'Source drafts must contain one valid Unicode physical line',
      );
  }
  return transactSource(
    document,
    from,
    count,
    edits.map((edit) => edit.source),
    (after) => {
      for (const [offset, edit] of edits.entries()) {
        const line = after.lines[from + offset]!;
        if (
          line.kind !== edit.kind ||
          line.text !== edit.text ||
          line.titleKey !== edit.titleKey ||
          line.sceneNumber !== edit.sceneNumber ||
          line.sectionLevel !== edit.sectionLevel
        )
          throw new FountainEditError(
            'round-trip',
            'Concrete source does not match requested element content/fields',
          );
        const old = document.lines[from + offset];
        const expectedDual =
          edit.dualWith === undefined
            ? document.lines[old?.dualWith ?? -1]?.id
            : (edit.dualWith ?? undefined);
        const actualDual = after.lines[line.dualWith ?? -1]?.id;
        validateDualContext(document, after, from, count, edits.length, offset);
        if (
          actualDual !== expectedDual ||
          (edit.dualWith === null && line.dualMarker) ||
          (edit.dualWith === undefined && line.dualMarker !== old?.dualMarker)
        )
          throw new FountainEditError(
            'round-trip',
            'Concrete source changes a dual relationship without explicit intent',
          );
        if (line.kind === 'raw' && !line.hiddenOf)
          throw new FountainEditError(
            'unrepresentable',
            'Conversion still contains unsupported raw syntax; original bytes remain available',
          );
      }
      for (const region of after.hiddenRegions) {
        if (
          region.from < from + edits.length &&
          region.from + region.count > from &&
          (!region.closed ||
            region.ambiguous ||
            region.from < from ||
            region.from + region.count > from + edits.length)
        )
          throw new FountainEditError(
            'unrepresentable',
            'Changed hidden region is incomplete, ambiguous or crosses owned context',
          );
      }
      for (const field of after.titleFields) {
        if (
          field.from < from + edits.length &&
          field.from + field.count > from &&
          (field.from < from || field.from + field.count > from + edits.length)
        )
          throw new FountainEditError(
            'neighbor-drift',
            'Title continuations would attach outside the owned field',
          );
      }
    },
    undefined,
    retainedIds,
  );
}

/** Complete known-region edits. Unknown/malformed conversion must use the proposal lifecycle. */
export function replaceKnownSourceContext(
  document: FountainDocument,
  from: number,
  count: number,
  edits: readonly SourceLineEdit[],
  retainedIds?: readonly string[],
): FountainDocument {
  return concreteTransaction(
    document,
    from,
    count,
    edits,
    false,
    false,
    retainedIds,
  );
}

const proposals = new WeakMap<
  ConversionProposal,
  { before: FountainDocument; after: FountainDocument }
>();
export function proposeSourceConversion(
  document: FountainDocument,
  from: number,
  count: number,
  edits: readonly SourceLineEdit[],
): ConversionProposal {
  const after = concreteTransaction(document, from, count, edits, true);
  const proposal: ConversionProposal = Object.freeze({
    sourceStart:
      document.lines[from]?.sourceStart ?? snapshots.get(document)!.length,
    sourceEnd:
      document.lines[from + count - 1]?.sourceEnd ??
      document.lines[from]?.sourceStart ??
      snapshots.get(document)!.length,
    get originalBytes() {
      return serializeFountain(document);
    },
    get candidateBytes() {
      return serializeFountain(after);
    },
  });
  proposals.set(proposal, { before: document, after });
  return proposal;
}

/** An editor's explicit acceptance event. A stale proposal cannot replace newer authoring state. */
export function acceptSourceConversion(
  current: FountainDocument,
  proposal: ConversionProposal,
): FountainDocument {
  const pair = proposals.get(proposal);
  if (!pair)
    throw new FountainEditError(
      'invalid-edit',
      'Expected a codec-owned conversion proposal',
    );
  if (current !== pair.before)
    throw new FountainEditError(
      'stale-conversion',
      'Source changed since conversion was proposed; original and candidate copies remain available',
    );
  return pair.after;
}

function existingSource(
  line: FountainLine,
  document: FountainDocument,
): SourceLineEdit {
  return {
    source: line.sourceText,
    kind: line.kind,
    text: line.text,
    titleKey: line.titleKey,
    sceneNumber: line.sceneNumber,
    sectionLevel: line.sectionLevel,
    dualWith: document.lines[line.dualWith ?? -1]?.id ?? null,
  };
}

export function replaceTitleField(
  document: FountainDocument,
  id: string,
  key: string,
  values: readonly string[],
): FountainDocument {
  const field = document.titleFields.find((candidate) => candidate.id === id);
  if (!field)
    throw new FountainEditError('range', 'No title field with that ID');
  if (
    !key ||
    /^\s|^[!@>.~#=]|[:\r\n]/.test(key) ||
    values.length === 0 ||
    values.some((value) => /[\r\n]/.test(value))
  )
    throw new FountainEditError(
      'unrepresentable',
      'Title key/values cannot be represented as a complete field',
    );
  const first = document.lines[field.from]!;
  const prefix =
    key === field.key
      ? first.sourceText.slice(0, first.sourceText.length - first.text.length)
      : `${key}: `;
  const edits = values.map((text, index): SourceLineEdit => {
    const prior = document.lines[field.from + index];
    const indent =
      prior?.kind === 'titleContinuation'
        ? prior.sourceText.slice(0, prior.sourceText.length - prior.text.length)
        : '    ';
    return index === 0
      ? { source: prefix + text, kind: 'title', text, titleKey: key }
      : { source: indent + text, kind: 'titleContinuation', text };
  });
  return replaceKnownSourceContext(document, field.from, field.count, edits);
}

/** Content rows include leading/trailing empty entries when wrappers occupy their own lines. */
export function replaceHiddenContent(
  document: FountainDocument,
  id: string,
  contentLines: readonly string[],
): FountainDocument {
  const region = document.hiddenRegions.find(
    (candidate) => candidate.id === id,
  );
  if (!region)
    throw new FountainEditError('range', 'No hidden region with that ID');
  if (!region.closed || region.ambiguous)
    throw new FountainEditError(
      'unrepresentable',
      'Incomplete/ambiguous hidden syntax requires an explicit conversion proposal and exact copy',
    );
  const open = region.kind === 'note' ? '[[' : '/*';
  const close = region.kind === 'note' ? ']]' : '*/';
  if (
    !contentLines.length ||
    contentLines.some(
      (line) =>
        /[\r\n]/.test(line) || line.includes(open) || line.includes(close),
    )
  )
    throw new FountainEditError(
      'unrepresentable',
      'Hidden content would introduce or cross a delimiter',
    );
  const first = document.lines[region.from]!;
  const last = document.lines[region.from + region.count - 1]!;
  const bytes = snapshots.get(document)!;
  const prefix = decoder.decode(
    bytes.subarray(first.sourceStart, region.sourceStart),
  );
  const suffix = decoder.decode(
    bytes.subarray(region.sourceEnd, last.contentEnd),
  );
  const source = prefix + open + contentLines.join('\n') + close + suffix;
  const physical = source.split('\n');
  const edits = physical.map((text, index): SourceLineEdit => ({
    source: text,
    text,
    kind:
      (index === 0 && prefix.trim() !== '') ||
      (index === physical.length - 1 && suffix.trim() !== '')
        ? 'raw'
        : region.kind,
  }));
  return concreteTransaction(
    document,
    region.from,
    region.count,
    edits,
    false,
    true,
  );
}

export function replaceInline(
  document: FountainDocument,
  index: number,
  runs: readonly StyledText[],
): FountainDocument {
  const line = document.lines[index];
  if (!line?.inline)
    throw new FountainEditError(
      'unrepresentable',
      'This source region has no editable inline interpretation; preserve an exact copy',
    );
  let text: string;
  try {
    text = sourceForInline(runs);
  } catch (error) {
    throw new FountainEditError(
      'unrepresentable',
      error instanceof Error ? error.message : 'Unrepresentable inline content',
    );
  }
  if (
    JSON.stringify(richView(line.inline.runs)) ===
    JSON.stringify(richView(runs))
  )
    return document;
  if (line.titleOf) {
    const field = document.titleFields.find(
      (candidate) => candidate.id === line.titleOf,
    )!;
    return replaceTitleField(
      document,
      field.id,
      field.key,
      field.values.map((value) =>
        value.lineId === line.id ? text : value.text,
      ),
    );
  }
  const after = replaceLine(document, index, {
    kind: line.kind as LineEdit['kind'],
    text,
  });
  if (
    JSON.stringify(richView(after.lines[index]!.inline!.runs)) !==
    JSON.stringify(richView(runs))
  )
    throw new FountainEditError(
      'round-trip',
      'Inline semantics changed while serializing grammar context',
    );
  return after;
}

export function setDualDialogue(
  document: FountainDocument,
  rightId: string,
  leftId: string | null,
): FountainDocument {
  const right = document.dialogueGroups.find((group) => group.id === rightId);
  const left = document.dialogueGroups.find(
    (group) => group.id === (leftId ?? right?.dualWith),
  );
  if (
    !right ||
    !left ||
    left.cueLine >= right.cueLine ||
    !left.complete ||
    !right.complete
  )
    throw new FountainEditError(
      'unrepresentable',
      'Dual dialogue needs two complete preceding/following speech groups',
    );
  if (
    document.dialogueGroups.some(
      (group) =>
        (group.id === left.id && group.dualWith) ||
        (group.dualWith === left.id && group.id !== right.id) ||
        group.dualWith === right.id,
    )
  )
    throw new FountainEditError(
      'unrepresentable',
      'Dual relationship would overlap another group',
    );
  if (
    left.from + left.count < right.from &&
    document.lines
      .slice(left.from + left.count, right.from)
      .some((line) => line.kind !== 'blank')
  )
    throw new FountainEditError(
      'unrepresentable',
      'Dual groups must be adjacent except for retained separators',
    );
  const from = left.from;
  const count = right.from + right.count - from;
  const edits = document.lines
    .slice(from, from + count)
    .map((line) => existingSource(line, document));
  const cue = document.lines[right.cueLine]!;
  edits[right.cueLine - from] = {
    ...existingSource(cue, document),
    source: `@${cue.text}${leftId === null ? '' : ' ^'}`,
    dualWith: leftId,
  };
  return replaceKnownSourceContext(document, from, count, edits);
}

/** Primary intentional breaks use physical Fountain lines; no invisible/new portable marker. */
export function replaceLineWithBreaks(
  document: FountainDocument,
  index: number,
  texts: readonly string[],
): FountainDocument {
  const prior = document.lines[index];
  if (
    !prior ||
    !['action', 'dialogue'].includes(prior.kind) ||
    texts.length === 0 ||
    texts.some((text) => !parseInline(text).complete)
  )
    throw new FountainEditError(
      'unrepresentable',
      'Break is not representable in this element/emphasis context; preserve an exact source copy',
    );
  const edits = texts.map((text): LineEdit => ({
    kind: prior.kind as 'action' | 'dialogue',
    text: prior.kind === 'dialogue' && text === '' ? '  ' : text,
    actionSubtype: prior.actionSubtype,
  }));
  return replaceLines(document, index, 1, edits);
}
