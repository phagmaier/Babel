import type {
  CodecDiagnostic,
  DialogueGroup,
  FountainLine,
  HiddenRegion,
  SourceBreak,
  TitleField,
} from './fountainModel.ts';
import { parseInline } from './fountainInline.ts';
import { isEscaped } from './fountainSyntax.ts';

const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const visible = new Set([
  'title',
  'titleContinuation',
  'sceneHeading',
  'action',
  'character',
  'dialogue',
  'parenthetical',
  'transition',
  'lyrics',
  'centered',
  'section',
  'synopsis',
]);
const titleKeys = new Set([
  'title',
  'credit',
  'author',
  'authors',
  'source',
  'draft date',
  'contact',
]);

/** Derived concrete/semantic structures. This module never owns writable authoring state. */
export function structureFountain(
  bytes: Uint8Array,
  original: readonly FountainLine[],
  bom: boolean,
) {
  const diagnostics: CodecDiagnostic[] = [];
  const lines = original.map(
    (line) =>
      ({
        ...line,
        titleOf: undefined,
        hiddenOf: undefined,
        inline: visible.has(line.kind) ? parseInline(line.text) : undefined,
      }) as FountainLine,
  );
  const titleFields: TitleField[] = [];
  for (
    let at = 0;
    at < lines.length &&
    ['title', 'titleContinuation'].includes(lines[at]!.kind);
  ) {
    const first = lines[at]!;
    let end = at + 1;
    while (lines[end]?.kind === 'titleContinuation') end++;
    const values = lines.slice(at, end).map((line, index) => {
      lines[at + index] = { ...line, titleOf: first.id };
      return Object.freeze({
        lineId: line.id,
        text: line.text,
        inline: line.inline!,
      });
    });
    titleFields.push(
      Object.freeze({
        id: first.id,
        key: first.titleKey!,
        unknown: !titleKeys.has(first.titleKey!.toLowerCase()),
        from: at,
        count: end - at,
        sourceStart: first.sourceStart,
        sourceEnd: lines[end - 1]!.sourceEnd,
        values: Object.freeze(values),
      }),
    );
    at = end;
  }

  const hiddenRegions: HiddenRegion[] = [];
  if (lines.length && (bytes.includes(91) || bytes.includes(47))) {
    const text = decoder.decode(bytes.subarray(bom ? 3 : 0));
    // Only hidden syntax needs offsets. Avoid a Map entry and TextEncoder
    // allocation for every scalar on every ordinary screenplay capture.
    const byteOffsets = new Uint32Array(text.length + 1);
    let position = bom ? 3 : 0;
    for (let at = 0; at < text.length;) {
      byteOffsets[at] = position;
      const scalar = text.codePointAt(at)!;
      at += scalar > 0xffff ? 2 : 1;
      position +=
        scalar <= 0x7f ? 1 : scalar <= 0x7ff ? 2 : scalar <= 0xffff ? 3 : 4;
    }
    byteOffsets[text.length] = position;
    let firstLine = 0;
    for (let at = 0; at < text.length;) {
      const open = text.slice(at, at + 2);
      if (!['[[', '/*'].includes(open) || isEscaped(text, at)) {
        at++;
        continue;
      }
      const start = byteOffsets[at]!;
      while (
        lines[firstLine]!.sourceEnd <= start &&
        firstLine + 1 < lines.length
      )
        firstLine++;
      if (['title', 'titleContinuation'].includes(lines[firstLine]!.kind)) {
        at += 2;
        continue;
      }
      const close = open === '[[' ? ']]' : '*/';
      let closing = -1;
      let ambiguous = false;
      for (let search = at + 2; search < text.length; search++) {
        if (
          text.slice(search, search + 2) === close &&
          !isEscaped(text, search)
        ) {
          closing = search;
          break;
        }
        if (text.slice(search, search + 2) === open && !isEscaped(text, search))
          ambiguous = true;
      }
      const end = closing < 0 ? text.length : closing + 2;
      const endByte = byteOffsets[end]!;
      let lastLine = firstLine;
      while (
        lines[lastLine]!.sourceEnd < endByte &&
        lastLine + 1 < lines.length
      )
        lastLine++;
      const content = text.slice(at + 2, closing < 0 ? text.length : closing);
      if (
        open === '[[' &&
        content
          .split(/\r\n|\r|\n/)
          .slice(1, -1)
          .some((row) => row.trim() === '' && row !== '  ')
      )
        ambiguous = true;
      const id = `h:${lines[firstLine]!.id}:${start - lines[firstLine]!.sourceStart}`;
      hiddenRegions.push(
        Object.freeze({
          id,
          kind: open === '[[' ? 'note' : 'boneyard',
          from: firstLine,
          count: lastLine - firstLine + 1,
          sourceStart: start,
          sourceEnd: endByte,
          contentStart: byteOffsets[at + 2]!,
          contentEnd: byteOffsets[closing < 0 ? text.length : closing]!,
          content,
          closed: closing >= 0,
          ambiguous,
        }),
      );
      if (ambiguous)
        diagnostics.push({
          code: 'ambiguous-region',
          line: firstLine,
          message:
            'Nested or separated hidden syntax retained; conversion requires complete explicit context',
        });
      at = end;
    }
  }
  for (const region of hiddenRegions) {
    for (let at = region.from; at < region.from + region.count; at++) {
      const line = lines[at]!;
      lines[at] = {
        ...line,
        hiddenOf: line.hiddenOf ? `${line.hiddenOf},${region.id}` : region.id,
      };
    }
  }

  const dialogueGroups: DialogueGroup[] = [];
  const paired = new Set<string>();
  for (const [index, line] of lines.entries()) {
    if (line.kind !== 'character') continue;
    let end = index + 1;
    while (lines[end]?.speechOf === line.id) end++;
    const dualWith = lines[line.dualWith ?? -1]?.id;
    const body = lines.slice(index + 1, end);
    const complete =
      line.text.trim() !== '' &&
      body.some((row) => row.kind === 'dialogue' && row.text.trim() !== '') &&
      body.every((row) => row.editable && row.intendedKind === undefined);
    if (
      dualWith &&
      (paired.has(dualWith) ||
        dialogueGroups.find((group) => group.id === dualWith)?.dualWith)
    )
      diagnostics.push({
        code: 'ambiguous-dual',
        line: index,
        message:
          'Overlapping dual groups retained without choosing or dropping a speaker',
      });
    if (dualWith) {
      paired.add(dualWith);
      paired.add(line.id);
    }
    dialogueGroups.push(
      Object.freeze({
        id: line.id,
        cueLine: index,
        from: index,
        count: end - index,
        lineIds: Object.freeze(lines.slice(index, end).map((row) => row.id)),
        dualWith,
        complete,
      }),
    );
  }
  const sourceBreaks: SourceBreak[] = [];
  for (let index = 0; index + 1 < lines.length; index++) {
    const line = lines[index]!;
    const next = lines[index + 1]!;
    if (
      (line.kind === 'action' && next.kind === 'action') ||
      (line.kind === 'dialogue' &&
        next.kind === 'dialogue' &&
        line.speechOf === next.speechOf)
    )
      sourceBreaks.push(
        Object.freeze({
          fromId: line.id,
          toId: next.id,
          kind: line.kind as 'action' | 'dialogue',
          newline: line.newline,
          sourceStart: line.contentEnd,
          sourceEnd: line.sourceEnd,
        }),
      );
  }
  for (const [index, line] of lines.entries()) {
    if (line.inline && !line.inline.complete)
      diagnostics.push({
        code: 'inline-incomplete',
        line: index,
        message:
          'Unpaired or crossing emphasis remains literal source; external interpretation may differ',
      });
  }
  return {
    lines,
    titleFields: Object.freeze(titleFields),
    hiddenRegions: Object.freeze(hiddenRegions),
    dialogueGroups: Object.freeze(dialogueGroups),
    sourceBreaks: Object.freeze(sourceBreaks),
    diagnostics,
  };
}
