import type {
  CodecDiagnostic,
  FountainDocument,
  FountainKind,
  FountainLine,
  FountainRecovery,
  LineEdit,
  Newline,
  SourceLineEdit,
} from './fountainModel.ts';
import { parseInline, richView } from './fountainInline.ts';
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
    | 'unrepresentable';
  /** For `neighbor-drift`: the unowned line (pre-edit index) whose interpretation would change. */
  readonly line: number | undefined;
  /** When one submitted edit cannot be written: its offset among the edits. */
  readonly edit: number | undefined;
  constructor(
    code: FountainEditError['code'],
    message: string,
    line?: number,
    edit?: number,
  ) {
    super(message);
    this.code = code;
    this.line = line;
    this.edit = edit;
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

/** A `Key: value` title row; force markers and indented keys are not keys. */
function titleFieldMatch(raw: string): RegExpExecArray | null {
  const field = /^([^:\r\n]+):[ \t]?(.*)$/.exec(raw);
  return field && !/^\s/.test(field[1]!) && !/^[!@>.~#=]/.test(raw)
    ? field
    : null;
}
/** AUDIT-D04-R1: a leading `Key:` block is a title page only if some field has
 * a value, on its key line or as an indented continuation. A block of empty
 * fields (`FADE IN:`) is body text, as the pinned renderer reads it. */
function leadingTitleHasValue(lines: readonly FountainLine[]): boolean {
  let fields = 0;
  for (const { sourceText: raw } of lines) {
    if (raw.trim() === '') return false;
    const field = titleFieldMatch(raw);
    if (field) {
      if (field[2]!.trim() !== '') return true;
      fields++;
    } else return fields > 0 && /^(?: {3,}|\t)/.test(raw);
  }
  return false;
}

/**
 * AUDIT-PARK-H-F4-03: only a parenthesis that never closes is protected. A
 * line that merely begins with a closed parenthetical is ordinary text.
 */
const unclosed = /^\([^)]*$/;
const wrapped = /^\([^)]*\)$/;

function classify(
  lines: readonly FountainLine[],
  diagnostics: CodecDiagnostic[],
): FountainLine[] {
  const result: FountainLine[] = [];
  let inTitle = leadingTitleHasValue(lines);
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
      const field = titleFieldMatch(raw);
      if (field) {
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
      const parenthetical = wrapped.test(trimmed);
      const malformed = unclosed.test(trimmed);
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
      const malformed = unclosed.test(trimmed);
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
  if (
    ![
      'sceneHeading',
      'character',
      'dialogue',
      'parenthetical',
      // AUDIT-PARK-H-F4-04: transition joins the intents a typed row can
      // keep in recovery (see typedAsAction). No other kind can.
      'transition',
    ].includes(intent)
  )
    return false;
  // AUDIT-PARK-H-F4-04: typed text Fountain reads as action is written
  // exactly; the typed element is recovery-only intent (see typedAsAction).
  // This shape is disjoint from the empty-row intents below (action lines
  // are never blank), so it goes first.
  if (typedAsAction(line, intent)) return true;
  if (intent === 'sceneHeading')
    return line.kind === 'blank' && line.text === '';
  if (intent === 'character')
    return line.kind === 'character' && line.text === '';
  if (line.kind === 'blank' && line.text === '') return true;
  if (emptiedInSpeech(line, intent)) return true;
  if (typedInSpeech(line, intent)) return true;
  const incomplete = unclosed.test(line.text);
  if (intent === 'dialogue') return line.kind === 'dialogue' && incomplete;
  return (
    intent === 'parenthetical' &&
    incomplete &&
    (line.kind === 'dialogue' || line.kind === 'action')
  );
}

/**
 * AUDIT-PARK-H-F4-03: speech text that opens with a parenthesis is written
 * exactly as typed. Where Fountain reads the line as the other speech
 * element, or drops spaces after a wrapped pair, the typed element is
 * recovery-only intent and the row holds the line's exact text.
 */
function typedInSpeech(
  line: FountainLine,
  intent: FountainLine['intendedKind'],
): boolean {
  const source = line.sourceText;
  // AUDIT-PARK-H-F4-04: a Dialogue starting with `!` is Fountain's action
  // line. `!` is the only forcing marker whose element is Action, so it is
  // the only Dialogue shape this fallback holds; the row text stays the
  // exact source. Other markers force a restructuring element and refuse.
  if (intent === 'dialogue')
    return (
      line.kind === 'parenthetical' ||
      (line.kind === 'action' && /^\s*!/.test(source))
    );
  if (intent !== 'parenthetical' || !source.startsWith('(')) return false;
  return line.kind === 'parenthetical'
    ? !wrapped.test(source)
    : (line.kind === 'dialogue' || line.kind === 'action') &&
        !line.marker &&
        !unclosed.test(source);
}

/**
 * AUDIT-PARK-H-F4-04: typed text Fountain reads as an Action line is written
 * exactly, with the typed element as recovery-only intent. Only plain
 * action bytes qualify: a consumed `!` marker would hide typed text on a
 * marker-free reopen, and a leading parenthesis belongs to the F4-03 and
 * group F shapes. Everything else Fountain would read here (cue, heading,
 * section and the rest) restructures or hides the row, so those refuse.
 */
function typedAsAction(
  line: FountainLine,
  intent: FountainLine['intendedKind'],
): boolean {
  if (
    intent !== 'sceneHeading' &&
    intent !== 'character' &&
    intent !== 'transition'
  )
    return false;
  return (
    line.kind === 'action' && !line.marker && !/^\s*[!(]/.test(line.sourceText)
  );
}

/** The row text a draft intent gives its line. */
function draftText(
  line: FountainLine,
  intent: FountainLine['intendedKind'],
): string {
  if (emptiedInSpeech(line, intent)) return '';
  return typedInSpeech(line, intent) || typedAsAction(line, intent)
    ? line.sourceText
    : line.text;
}

/**
 * AUDIT-PARK-H-F4-04: a typed row Fountain reads as another element may be
 * written exactly, with its element as recovery-only intent — but only where
 * the exact bytes are one editable Action line. Dialogue goes through the
 * ordinary attempt (its generated spelling already is the exact text); other
 * kinds need an explicit exact-text retry because their generated spellings
 * add forcing markers. Marker-consumed (`!`), parenthesis-led, empty and
 * field-carrying edits are never eligible; the retry itself rechecks the
 * reading, so anything Fountain still reads otherwise keeps its refusal.
 */
function exactFallback(edit: LineEdit | undefined): boolean {
  if (
    edit === undefined ||
    (edit.kind !== 'sceneHeading' &&
      edit.kind !== 'character' &&
      edit.kind !== 'transition') ||
    edit.text === '' ||
    edit.sceneNumber !== undefined ||
    edit.sectionLevel !== undefined ||
    edit.dualWith !== undefined ||
    /^\s*[!(]/.test(edit.text)
  )
    return false;
  return true;
}

/**
 * AUDIT-PARK-H-F4-02: an emptied Dialogue or Parenthetical row kept inside its
 * speech is Fountain's two-space dialogue line. With that intent the two
 * spaces are its spelling and the row holds no text; read alone, the line is
 * the ordinary two-space Dialogue.
 */
function emptiedInSpeech(
  line: FountainLine,
  intent: FountainLine['intendedKind'],
): boolean {
  return (
    (intent === 'dialogue' || intent === 'parenthetical') &&
    line.kind === 'dialogue' &&
    line.sourceText === '  '
  );
}

function draftIntent(edit: LineEdit): FountainLine['intendedKind'] {
  if (edit.kind === 'sceneHeading' && edit.text === '') return 'sceneHeading';
  if (edit.kind === 'character' && edit.text === '') return 'character';
  if (
    (edit.kind === 'dialogue' || edit.kind === 'parenthetical') &&
    (edit.text === '' || unclosed.test(edit.text))
  )
    return edit.kind;
  // AUDIT-PARK-H-F4-03: Dialogue Fountain reads as a parenthetical, and a
  // Parenthetical that goes on after its closing parenthesis.
  if (edit.kind === 'dialogue' && wrapped.test(edit.text.trim()))
    return edit.kind;
  if (
    edit.kind === 'parenthetical' &&
    edit.text.startsWith('(') &&
    !wrapped.test(edit.text)
  )
    return edit.kind;
  // AUDIT-PARK-H-F4-04: a Dialogue starting with `!` reads as Fountain's
  // action line (generated and exact spellings are the same text, so the
  // ordinary attempt carries it). Compatibility rechecks the reading.
  if (edit.kind === 'dialogue' && /^\s*!/.test(edit.text)) return edit.kind;
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
      text: draftText(line, entry.intendedKind),
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
      if (edit.text === '' && number == null) return '';
      return `.${edit.text}${number == null ? '' : ` #${number}#`}`;
    }
    case 'character':
      return `@${edit.text}${edit.dualWith === undefined ? (previous?.kind === 'character' && previous.dualMarker ? ' ^' : '') : edit.dualWith === null ? '' : ' ^'}`;
    case 'dialogue':
      return edit.text;
    case 'parenthetical':
      if (edit.text !== '' && !edit.text.startsWith('('))
        throw new FountainEditError(
          'invalid-edit',
          'Parenthetical must begin with an opening parenthesis',
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
  // An unchanged row keeps its authored spelling. When the edit changed its
  // grammar context, the forcing marker goes into that spelling before the
  // generated form is tried; only rows this edit owns are ever re-spelled.
  const priors = edits.map((_, index) =>
    retainedIds ? priorById!.get(retainedIds[index]!) : owned[index],
  );
  const spellings = edits.map((edit, index) => {
    const prior = priors[index];
    let generated: string;
    try {
      generated = sourceFor(edit, prior);
    } catch (error) {
      // Same refusal, naming which submitted edit has no source spelling.
      throw error instanceof FountainEditError
        ? new FountainEditError(error.code, error.message, error.line, index)
        : error;
    }
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
      return [
        ...new Set([prior.sourceText, forcedSpelling(prior), generated]),
      ].filter((spelling) => spelling !== undefined);
    // A row already emptied inside its speech keeps its two spaces.
    if (
      prior &&
      edit.text === '' &&
      prior.intendedKind === edit.kind &&
      emptiedInSpeech(prior, prior.intendedKind)
    )
      return [prior.sourceText, generated];
    return [generated];
  });
  const attempt = (
    candidates: readonly (readonly string[])[],
    fallback?: ReadonlySet<number>,
  ) => {
    const choice = candidates.map(() => 0);
    for (;;) {
      let mismatch: number | undefined;
      try {
        return replaceSpelled(
          document,
          from,
          count,
          edits,
          retainedIds,
          priors,
          candidates.map((spelling, index) => spelling[choice[index]!]!),
          (offset) => {
            mismatch = offset;
          },
          fallback,
        );
      } catch (error) {
        if (
          mismatch === undefined ||
          !(error instanceof FountainEditError) ||
          error.code !== 'round-trip' ||
          choice[mismatch]! + 1 >= candidates[mismatch]!.length
        )
          throw error;
        choice[mismatch]!++;
      }
    }
  };
  try {
    return attempt(spellings);
  } catch (refusal) {
    // AUDIT-PARK-H-F4-02: an emptied Dialogue or Parenthetical row is a blank
    // line, which ends its speech. Only when that leaves these edits with no
    // spelling, and nonempty rows of the speech follow the row among them, it
    // takes the two-space dialogue line instead. An edit that was written
    // before is never respelled.
    const speech = (edit: LineEdit | undefined) =>
      edit?.kind === 'dialogue' || edit?.kind === 'parenthetical';
    const continued = edits.map((edit, index) => {
      if (!speech(edit) || edit.text !== '') return false;
      let next = index + 1;
      while (speech(edits[next]) && edits[next]!.text === '') next++;
      return speech(edits[next]);
    });
    const emptiedRefusal =
      refusal instanceof FountainEditError &&
      refusal.code === 'round-trip' &&
      continued.includes(true);
    // AUDIT-PARK-H-F4-04: a typed row Fountain reads as another element is
    // written exactly where those bytes are one editable Action line, with
    // the typed element as recovery-only intent (see exactFallback). Only
    // the refused row is respelled, and only with the exact text: an edit
    // that was written before is never respelled, and generated spellings
    // never carry this intent. A mixed emptied-and-fallback capture stays
    // refused; each fallback keeps its own refusal below.
    const fallback =
      refusal instanceof FountainEditError &&
      refusal.code === 'round-trip' &&
      refusal.edit !== undefined &&
      exactFallback(edits[refusal.edit])
        ? new Set([refusal.edit])
        : undefined;
    if (fallback && !emptiedRefusal) {
      try {
        return attempt(
          spellings.map((candidates, index) =>
            fallback.has(index) ? [edits[index]!.text] : candidates,
          ),
          fallback,
        );
      } catch (error) {
        // What still stops the exact bytes stands; otherwise the refusal
        // names the row that was refused first.
        throw error instanceof FountainEditError &&
          error.edit !== undefined &&
          fallback.has(error.edit)
          ? refusal
          : error;
      }
    }
    if (
      !(refusal instanceof FountainEditError) ||
      refusal.code !== 'round-trip' ||
      !continued.includes(true)
    )
      throw refusal;
    try {
      return attempt(
        spellings.map((candidates, index) =>
          continued[index] ? ['  '] : candidates,
        ),
      );
    } catch (error) {
      // Two spaces that are not read as this speech change nothing: the
      // refusal stands as it was. Otherwise what still stops the edit is
      // whatever remains once the speech is kept together.
      throw error instanceof FountainEditError &&
        error.edit !== undefined &&
        continued[error.edit]
        ? refusal
        : error;
    }
  }
}

const forcingMarkers: Partial<Record<FountainLine['kind'], string>> = {
  action: '!',
  sceneHeading: '.',
  character: '@',
  transition: '>',
};
/** The authored row with only a forcing marker added; indentation and suffix bytes stay. */
function forcedSpelling(prior: FountainLine): string | undefined {
  const marker = forcingMarkers[prior.kind];
  if (!marker || prior.marker) return undefined;
  // Action text owns its indentation; other kinds are read after it.
  const indent =
    prior.kind === 'action'
      ? 0
      : prior.sourceText.length - prior.sourceText.trimStart().length;
  return (
    prior.sourceText.slice(0, indent) + marker + prior.sourceText.slice(indent)
  );
}

function replaceSpelled(
  document: FountainDocument,
  from: number,
  count: number,
  edits: readonly LineEdit[],
  retainedIds: readonly string[] | undefined,
  priors: readonly (FountainLine | undefined)[],
  sources: readonly string[],
  mismatched: (offset: number) => void,
  fallback?: ReadonlySet<number>,
): FountainDocument {
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
        ) {
          mismatched(offset);
          throw new FountainEditError(
            'round-trip',
            'Requested element cannot round-trip unambiguously; source remains unchanged',
            undefined,
            offset,
          );
        }
        // AUDIT-PARK-H-F4-04: a `!` Dialogue saved as Action ends its
        // speech. Where rows of that speech follow, the typed row itself is
        // refused here — before neighbor-drift expansion could name a row
        // the author did not touch. Plain Action fallbacks are transparent
        // to speech tracking and never need this.
        if (
          edit.kind === 'dialogue' &&
          line.kind === 'action' &&
          line.intendedKind === 'dialogue' &&
          count === sources.length &&
          after.lines.length === document.lines.length &&
          breaksFollowingSpeech(document, after, from + offset)
        )
          throw new FountainEditError(
            'round-trip',
            'Requested element cannot round-trip unambiguously; source remains unchanged',
            undefined,
            offset,
          );
        const prior = priors[offset];
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
            undefined,
            offset,
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
            undefined,
            offset,
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
            undefined,
            offset,
          );
      }
    },
    edits,
    retainedIds,
    fallback,
  );
}

/**
 * AUDIT-PARK-H-F4-04: whether a fallback row would end a speech rows after
 * it still belong to. Only the rows until the next blank can be affected;
 * each must keep its kind and its speech. The caller already ensured the
 * two documents have the same length with positions aligned.
 */
function breaksFollowingSpeech(
  before: FountainDocument,
  after: FountainDocument,
  index: number,
): boolean {
  for (let next = index + 1; next < before.lines.length; next++) {
    const prior = before.lines[next]!;
    if (prior.kind === 'blank') break;
    const line = after.lines[next]!;
    if (
      line.kind !== prior.kind ||
      (line.speechOf === undefined) !== (prior.speechOf === undefined)
    )
      return true;
  }
  return false;
}

function transactSource(
  document: FountainDocument,
  from: number,
  count: number,
  sources: readonly string[],
  validate: (after: FountainDocument) => void,
  intents?: readonly LineEdit[],
  retainedIds?: readonly string[],
  fallback?: ReadonlySet<number>,
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
  // AUDIT-PARK-H-F4-05: an empty unterminated EOF would erase its physical
  // row on reparse. It needs one local/file ending, just like a new blank.
  const endings = sources.map((_, index) => {
    if (
      index === sources.length - 1 &&
      count > 0 &&
      from + count === document.lines.length
    )
      return sources[index] === '' &&
        (sources.length > count || owned.at(-1)!.newline === '')
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
    // AUDIT-PARK-H-F4-04: an exact-text retry carries the typed element as
    // intent; generated spellings never do (see exactFallback). The retry
    // itself rechecks the reading through compatibleDraft. The cast is safe:
    // this branch runs only for exactFallback edits, whose kinds are all
    // DraftKind values.
    const intendedKind: FountainLine['intendedKind'] = edit
      ? fallback?.has(index - from)
        ? (edit.kind as FountainLine['intendedKind'])
        : draftIntent(edit)
      : inside && previous?.sourceText !== line.sourceText
        ? undefined
        : previous?.intendedKind;
    return {
      ...line,
      id: inside
        ? (retainedIds?.[index - from] ?? previous?.id ?? allocate())
        : previous!.id,
      text: draftText(line, intendedKind),
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
        index,
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

/**
 * Whether one nonempty row keeps its element and text through its generated
 * spelling, read alone under a cue (`inSpeech`) or between blank lines. An
 * incomplete draft counts, as it does in a checked edit. A cheap pre-check
 * for explicit commands; capture remains the authority.
 */
export function spellsAlone(edit: LineEdit, inSpeech: boolean): boolean {
  let source: string;
  try {
    source = sourceFor(edit, undefined);
  } catch {
    return false;
  }
  const lines = parseFountain(
    encoder.encode(`${inSpeech ? '@A' : ''}\n${source}\n\n`),
  ).lines;
  const line = lines[1];
  if (lines.length !== 3 || !line) return false;
  const intent = draftIntent(edit);
  const draft = intent === edit.kind && compatibleDraft(line, intent);
  return (
    (draft || (line.kind === edit.kind && line.editable)) &&
    draftText(line, draft ? intent : undefined) === edit.text &&
    line.sceneNumber === (edit.sceneNumber ?? undefined)
  );
}

function sourceContext(
  document: FountainDocument,
  from: number,
  count: number,
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
        !region.closed ||
        region.ambiguous)
    )
      throw new FountainEditError(
        'protected-region',
        'Hidden edits must own a complete unambiguous region; preserve an exact copy',
      );
  }
  if (
    document.lines
      .slice(from, end)
      .some(
        (line) =>
          line.kind === 'raw' ||
          (!line.editable && !line.titleOf && !line.hiddenOf),
      )
  )
    throw new FountainEditError(
      'protected-region',
      'Raw or imported malformed content stays protected; preserve an exact copy',
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
        undefined,
        offset,
      );
  }
}

function concreteTransaction(
  document: FountainDocument,
  from: number,
  count: number,
  edits: readonly SourceLineEdit[],
  retainedIds?: readonly string[],
): FountainDocument {
  sourceContext(document, from, count);
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
            'Changed source contains unsupported raw syntax; original bytes remain available',
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

/** Complete known-region edits; raw, malformed and ambiguous source stays protected. */
export function replaceKnownSourceContext(
  document: FountainDocument,
  from: number,
  count: number,
  edits: readonly SourceLineEdit[],
  retainedIds?: readonly string[],
): FountainDocument {
  return concreteTransaction(document, from, count, edits, retainedIds);
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
  retainedIds?: readonly string[],
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
  return replaceLines(document, index, 1, edits, retainedIds);
}
