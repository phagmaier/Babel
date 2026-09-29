import type {
  CodecDiagnostic,
  FountainDocument,
  FountainKind,
  FountainLine,
  FountainRecovery,
  LineEdit,
  Newline,
} from './fountainModel';

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
  constructor(
    readonly code:
      | 'read-only'
      | 'range'
      | 'protected-region'
      | 'invalid-edit'
      | 'round-trip'
      | 'neighbor-drift',
    message: string,
  ) {
    super(message);
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
      if (raw.includes(hidden.close)) {
        // A closing delimiter mixed with visible text needs the later complex-region parser.
        if (
          raw.slice(raw.indexOf(hidden.close) + hidden.close.length).trim() !==
          ''
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
      const end = leadingTrimmed.indexOf(close, 2);
      emit(end >= 0 && leadingTrimmed.slice(end + 2).trim() ? 'raw' : kind);
      if (end < 0) hidden = { kind, close, start: index };
      speaker = undefined;
      continue;
    }
    if (/\{\{|\[\[|\]\]|\/\*|\*\//.test(raw)) {
      emit('raw');
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
  const frozenLines = Object.freeze(
    lines.map((line) => Object.freeze({ ...line })),
  );
  const document: FountainDocument = Object.freeze({
    get bytes() {
      return bytes.slice();
    },
    lines: frozenLines,
    bom,
    readOnlyReason,
    diagnostics: Object.freeze(
      diagnostics.map((diagnostic) => Object.freeze({ ...diagnostic })),
    ),
    recovery: recoveryFor(frozenLines, nextId, bom),
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
      return `@${edit.text}${previous?.kind === 'character' && previous.dualMarker ? ' ^' : ''}`;
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
  const defaultNewline =
    owned.find((line) => line.newline !== '')?.newline ||
    document.lines[from - 1]?.newline ||
    document.lines[from]?.newline ||
    document.lines.find((line) => line.newline !== '')?.newline ||
    '\n';
  const start = document.lines[from]?.sourceStart ?? bytes.length;
  const end = owned.at(-1)?.sourceEnd ?? start;
  const sources = edits.map((edit, index) => {
    const prior = owned[index];
    const generated = sourceFor(edit, prior);
    if (
      prior &&
      prior.kind === edit.kind &&
      prior.text === edit.text &&
      (edit.sceneNumber === undefined ||
        (edit.sceneNumber ?? undefined) === prior.sceneNumber) &&
      (edit.sectionLevel === undefined ||
        edit.sectionLevel === prior.sectionLevel)
    )
      return prior.sourceText;
    return generated;
  });
  // Preserve existing endings per line and EOF convention. New contexts inherit a local ending.
  const endings = edits.map((_, index) => {
    if (
      index === edits.length - 1 &&
      count > 0 &&
      from + count === document.lines.length
    )
      return owned.at(-1)!.newline;
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
  if (reparsed.lines.length !== document.lines.length - count + edits.length)
    throw new FountainEditError(
      'round-trip',
      'Edit cannot retain every intended source line (empty EOF needs a line ending)',
    );
  const idUsed = new Set(document.lines.map((line) => line.id));
  let nextId = nextIds.get(document)!;
  const allocate = () => {
    while (idUsed.has(`b${nextId}`)) nextId++;
    const id = `b${nextId++}`;
    idUsed.add(id);
    return id;
  };
  const lines = reparsed.lines.map((line, index): FountainLine => {
    const inside = index >= from && index < from + edits.length;
    const previous =
      index < from
        ? document.lines[index]
        : inside
          ? owned[index - from]
          : document.lines[index - edits.length + count];
    const edit = inside ? edits[index - from] : undefined;
    const intendedKind = edit ? draftIntent(edit) : previous?.intendedKind;
    return {
      ...line,
      id: previous?.id ?? allocate(),
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
    // Group relationship transformations need explicit complex-region intent in M3-03.
    if (
      prior?.dualMarker !== line.dualMarker ||
      (prior?.dualWith !== undefined &&
        document.lines[prior.dualWith]?.id !== lines[line.dualWith ?? -1]?.id)
    )
      throw new FountainEditError(
        'round-trip',
        'Dual relationship transformation requires complex-region support',
      );
  }
  const afterDocument = snapshot(
    output,
    lines,
    reparsed.diagnostics,
    reparsed.bom,
  );
  const beforeMeaning = semanticView(document);
  const afterMeaning = semanticView(afterDocument);
  for (const [index, prior] of document.lines.entries()) {
    if (index >= from && index < from + count) continue;
    const nextIndex = index < from ? index : index - count + edits.length;
    const next = lines[nextIndex]!;
    // Index-valued relationships are compared by stable cue IDs across insertion/deletion.
    const {
      dualWith: beforeDual,
      speechOf: beforeSpeech,
      ...before
    } = beforeMeaning[index]!;
    const {
      dualWith: afterDual,
      speechOf: afterSpeech,
      ...after
    } = afterMeaning[nextIndex]!;
    void beforeSpeech;
    void afterSpeech;
    if (
      JSON.stringify(before) !== JSON.stringify(after) ||
      prior.speechOf !== next.speechOf ||
      document.lines[beforeDual ?? -1]?.id !== lines[afterDual ?? -1]?.id ||
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
        line.actionSubtype === prior.actionSubtype
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
