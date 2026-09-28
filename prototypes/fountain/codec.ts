/** M1-01 disposable contract proof. This is not the production Fountain codec. */
export type Kind =
  | 'blank'
  | 'title'
  | 'titleContinuation'
  | 'sceneHeading'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'lyrics'
  | 'centered'
  | 'section'
  | 'synopsis'
  | 'note'
  | 'boneyard'
  | 'pageBreak'
  | 'raw';

export interface Line {
  readonly kind: Kind;
  readonly text: string;
  readonly sourceStart: number;
  readonly sourceEnd: number;
  readonly newline: string;
  readonly marker?: string;
  readonly titleKey?: string;
  readonly sectionLevel?: number;
  readonly sceneNumber?: string;
  readonly dualWith?: number;
}

export interface Document {
  readonly bytes: Uint8Array;
  readonly lines: readonly Line[];
  readonly bom: boolean;
  readonly readOnlyReason?: string;
  readonly diagnostics: readonly string[];
}

const decoder = new TextDecoder('utf-8', { fatal: true });
const encoder = new TextEncoder();

function readLines(bytes: Uint8Array, start: number): Line[] {
  const lines: Line[] = [];
  for (let at = start; at < bytes.length;) {
    let end = at;
    while (end < bytes.length && bytes[end] !== 10 && bytes[end] !== 13) end++;
    let next = end;
    if (bytes[next] === 13) next++;
    if (bytes[next] === 10) next++;
    lines.push({
      kind: 'raw',
      text: decoder.decode(bytes.subarray(at, end)),
      sourceStart: at,
      sourceEnd: next,
      newline: decoder.decode(bytes.subarray(end, next)),
    });
    at = next;
  }
  return lines;
}

const heading = /^(?:INT|EXT|EST|INT\.\/EXT|INT\/EXT|I\/E)(?:\.|\s)/i;
const sceneNumber = /\s+#([\p{L}\p{N}.-]+)#$/u;
const cue = /^(?=.*\p{L})[\p{Lu}\p{N} ._'’-]+(?:\s+\([^)]*\))?(?:\s*\^)?$/u;

function classify(lines: Line[]): Line[] {
  const result: Line[] = [];
  let inTitle = true;
  let inSpeech = false;
  let speakerIndex: number | undefined;
  let lastSpeakerIndex: number | undefined;
  let protectedUntil: ']]' | '*/' | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const raw = line.text;
    const trimmed = raw.trim();
    const prevBlank = i === 0 || lines[i - 1]!.text.trim() === '';
    const next = lines[i + 1]?.text ?? '';
    const nextBlank = next.trim() === '';
    const emit = (kind: Kind, text = raw, extra: Partial<Line> = {}) => {
      result.push({ ...line, kind, text, ...extra });
    };

    if (protectedUntil) {
      emit(protectedUntil === ']]' ? 'note' : 'boneyard');
      if (raw.includes(protectedUntil)) protectedUntil = undefined;
      continue;
    }
    if (inSpeech && raw === '  ') {
      emit('dialogue');
      continue;
    }
    if (trimmed === '') {
      emit('blank');
      inSpeech = false;
      if (inTitle) inTitle = false;
      continue;
    }
    if (inTitle) {
      const field = /^([^:\r\n]+):(?:\s?(.*))$/.exec(raw);
      if (field && !/^\s/.test(field[1]!)) {
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
    if (raw.startsWith('/*')) {
      emit('boneyard');
      if (!raw.includes('*/')) protectedUntil = '*/';
      inSpeech = false;
      continue;
    }
    if (raw.startsWith('[[')) {
      emit('note');
      if (!raw.includes(']]')) protectedUntil = ']]';
      inSpeech = false;
      continue;
    }
    if (raw.includes('{{')) {
      emit('raw');
      inSpeech = false;
      continue;
    }
    if (inSpeech) {
      if (/^\([^)]*\)$/.test(trimmed)) emit('parenthetical', trimmed);
      else emit('dialogue');
      continue;
    }
    if (/^#{1,}\s/.test(raw)) {
      const marker = /^#+/.exec(raw)![0];
      emit('section', raw.slice(marker.length).trimStart(), {
        sectionLevel: marker.length,
      });
      continue;
    }
    if (/^=\s/.test(raw)) {
      emit('synopsis', raw.slice(1).trimStart(), { marker: '=' });
      continue;
    }
    if (/^={3,}$/.test(raw)) {
      emit('pageBreak', raw, { marker: raw });
      continue;
    }
    if (raw.startsWith('~')) {
      emit('lyrics', raw.slice(1), { marker: '~' });
      continue;
    }
    if (/^>.*<$/.test(raw)) {
      emit('centered', raw.slice(1, -1), { marker: '><' });
      continue;
    }
    if (raw.startsWith('!')) {
      emit('action', raw.slice(1), { marker: '!' });
      continue;
    }
    if (/^\.[\p{L}\p{N}]/u.test(raw)) {
      const forcedText = raw.slice(1);
      const match = sceneNumber.exec(forcedText);
      emit(
        'sceneHeading',
        match ? forcedText.slice(0, match.index) : forcedText,
        {
          marker: '.',
          sceneNumber: match?.[1],
        },
      );
      continue;
    }
    if (raw.startsWith('>')) {
      emit('transition', raw.slice(1), { marker: '>' });
      continue;
    }
    const isCharacter =
      raw.startsWith('@') || (prevBlank && !nextBlank && cue.test(raw));
    if (isCharacter) {
      const forced = raw.startsWith('@');
      const speechText = (forced ? raw.slice(1) : raw).replace(/\s*\^$/, '');
      const dual = /\^$/.test(raw);
      let previous = result.length - 1;
      while (previous >= 0 && result[previous]?.kind === 'blank') previous--;
      const adjacentSpeech = ['dialogue', 'parenthetical'].includes(
        result[previous]?.kind ?? '',
      );
      emit('character', speechText, {
        marker: forced ? '@' : undefined,
        dualWith: dual && adjacentSpeech ? lastSpeakerIndex : undefined,
      });
      if (!nextBlank) {
        inSpeech = true;
        speakerIndex = i;
      } else {
        speakerIndex = undefined;
      }
      lastSpeakerIndex = i;
      continue;
    }
    if (prevBlank && nextBlank && heading.test(raw)) {
      const match = sceneNumber.exec(raw);
      emit('sceneHeading', match ? raw.slice(0, match.index) : raw, {
        sceneNumber: match?.[1],
      });
      continue;
    }
    if (
      prevBlank &&
      nextBlank &&
      /^(?=.*\p{L})[\p{Lu}\p{N} ._'’-]+TO:$/u.test(raw)
    ) {
      emit('transition');
      continue;
    }
    emit('action');
    if (speakerIndex !== undefined) speakerIndex = undefined;
  }
  return result;
}

export function parseFountain(input: Uint8Array): Document {
  const bytes = input.slice();
  const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const start = bom ? 3 : 0;
  try {
    const lines = classify(readLines(bytes, start));
    const diagnostics: string[] = [];
    for (const [index, line] of lines.entries()) {
      if (line.kind === 'raw')
        diagnostics.push(
          `Line ${index + 1}: unsupported region retained verbatim`,
        );
      if (
        line.kind === 'character' &&
        lines[index + 1]?.kind !== 'dialogue' &&
        lines[index + 1]?.kind !== 'parenthetical'
      ) {
        diagnostics.push(
          `Line ${index + 1}: incomplete character cue; external interpretation may differ`,
        );
      }
      if (
        line.kind === 'character' &&
        /\^$/.test(
          decoder
            .decode(bytes.subarray(line.sourceStart, line.sourceEnd))
            .trimEnd(),
        ) &&
        line.dualWith === undefined
      ) {
        diagnostics.push(
          `Line ${index + 1}: dual dialogue has no preceding speaker`,
        );
      }
    }
    return { bytes, lines, bom, diagnostics };
  } catch {
    return {
      bytes,
      lines: [],
      bom,
      readOnlyReason: 'Invalid UTF-8: preserve source bytes and open read-only',
      diagnostics: [],
    };
  }
}

export function unchangedBytes(document: Document): Uint8Array {
  return document.bytes.slice();
}

function sourceFor(kind: Kind, text: string, previous: Line): string {
  switch (kind) {
    case 'action':
      return `!${text}`;
    case 'sceneHeading':
      return `.${text}${previous.sceneNumber ? ` #${previous.sceneNumber}#` : ''}`;
    case 'character':
      return `@${text}${previous.dualWith !== undefined ? ' ^' : ''}`;
    case 'transition':
      return `>${text}`;
    case 'lyrics':
      return `~${text}`;
    case 'centered':
      return `>${text}<`;
    case 'section':
      return `${'#'.repeat(previous.sectionLevel ?? 1)} ${text}`;
    case 'synopsis':
      return `= ${text}`;
    case 'dialogue':
      return text;
    case 'parenthetical':
      if (!/^\([^)]*\)$/.test(text))
        throw new Error('Parenthetical must remain wrapped in parentheses');
      return text;
    default:
      throw new Error(`Editing ${kind} is outside the M1-01 proof`);
  }
}

/** Rewrites one proven line, retaining every other source byte and rejecting contextual drift. */
export function replaceLine(
  document: Document,
  index: number,
  kind: Kind,
  text: string,
): Document {
  if (document.readOnlyReason) throw new Error(document.readOnlyReason);
  const prior = document.lines[index];
  if (!prior) throw new RangeError('No line at index');
  if (
    ['raw', 'note', 'boneyard', 'title', 'titleContinuation', 'blank'].includes(
      prior.kind,
    )
  ) {
    throw new Error(`Editing ${prior.kind} is outside the M1-01 proof`);
  }
  if (prior.kind === kind && prior.text === text) return document;
  const replacement = encoder.encode(sourceFor(kind, text, prior));
  const tailStart = prior.sourceEnd - encoder.encode(prior.newline).length;
  const output = new Uint8Array(
    document.bytes.length -
      (tailStart - prior.sourceStart) +
      replacement.length,
  );
  output.set(document.bytes.subarray(0, prior.sourceStart));
  output.set(replacement, prior.sourceStart);
  output.set(
    document.bytes.subarray(tailStart),
    prior.sourceStart + replacement.length,
  );
  const reparsed = parseFountain(output);
  const updated = reparsed.lines[index];
  if (!updated || updated.kind !== kind || updated.text !== text)
    throw new Error('Edit cannot round-trip unambiguously');
  for (let i = 0; i < document.lines.length; i++) {
    if (i === index) continue;
    const before = document.lines[i]!;
    const after = reparsed.lines[i];
    if (
      !after ||
      before.kind !== after.kind ||
      before.text !== after.text ||
      before.dualWith !== after.dualWith
    ) {
      throw new Error('Edit would change neighboring Fountain interpretation');
    }
  }
  return reparsed;
}

/** Semantic comparison for proof tests: source locations and forcing markers are excluded. */
export function semanticView(document: Document) {
  return document.lines.map(
    ({ kind, text, titleKey, sectionLevel, sceneNumber, dualWith }) => ({
      kind,
      text,
      titleKey,
      sectionLevel,
      sceneNumber,
      dualWith,
    }),
  );
}
