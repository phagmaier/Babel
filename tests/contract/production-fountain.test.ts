import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  FountainEditError,
  parseFountain,
  replaceLine,
  replaceLines,
  semanticView,
  serializeFountain,
} from '../../src/domain/fountainCodec';
import type {
  FountainDocument,
  FountainRecovery,
  LineEdit,
} from '../../src/domain/fountainModel';
import {
  digest,
  fixtureBytes,
  loadCorpus,
} from '../../prototypes/fountain-conformance/corpus';

const corpus = loadCorpus();
const bytes = (text: string) => new Uint8Array(new TextEncoder().encode(text));
const source = (document: FountainDocument) =>
  new TextDecoder('utf-8', { ignoreBOM: true }).decode(
    serializeFountain(document),
  );
const parse = (text: string) => parseFountain(bytes(text));
// A literal oracle projection, not the proof parser or its semantic comparison.
const atoms = (document: FountainDocument) =>
  document.lines
    .filter((line) => line.kind !== 'blank')
    .map(({ kind, text, titleKey, sectionLevel, sceneNumber, dualWith }) => ({
      kind,
      text,
      titleKey,
      sectionLevel,
      sceneNumber,
      dualWith,
    }));
const expectFailure = (
  operation: () => unknown,
  code: FountainEditError['code'],
) => {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(FountainEditError);
    expect((error as FountainEditError).code).toBe(code);
    return;
  }
  throw new Error(`Expected codec refusal: ${code}`);
};

describe('M3-02 production codec against unchanged independent M3-01 oracles', () => {
  it('detects a corrupted byte oracle and requires explicit exclusions', () => {
    const entry = corpus.cases[0]!;
    expect(() => fixtureBytes({ ...entry, sha256: '0'.repeat(64) })).toThrow(
      'Literal/hash mismatch',
    );
    expect(() =>
      fixtureBytes({ ...entry, sourceLiteral: entry.sourceLiteral.trim() }),
    ).toThrow('Literal/hash mismatch');
    expect(() =>
      fixtureBytes({ ...entry, file: '../outside.fountain' }),
    ).toThrow('Unexpected corpus filename');
    for (const excluded of corpus.cases.filter(
      (candidate) => !candidate.shared,
    )) {
      expect(excluded.gaps.length).toBeGreaterThan(0);
    }
    const topics = new Set(corpus.cases.flatMap((entry) => entry.topics));
    for (const required of [
      'forced-heading',
      'mixed-case-cue',
      'scene-number',
      'uppercase-action',
      'transition-like-prose',
      'title-continuation',
      'unknown-title-field',
      'multiple-dialogue-paragraphs',
      'dual-dialogue',
      'nested-sections',
      'multiline-note',
      'multiline-boneyard',
      'italic',
      'bold',
      'underline',
      'escaped-literal-markers',
      'page-break',
      'unicode',
      'bom',
      'mixed-newlines',
      'no-final-newline',
      'unknown-region',
      'incomplete-cue',
    ]) {
      expect(topics.has(required), required).toBe(true);
    }
  });

  it.each(['elements.fountain', 'ambiguity.fountain', 'windows-bom.fountain'])(
    'AUDIT-SLP-B %s preserves exact no-op bytes and isolated snapshots',
    (name) => {
      const input = new Uint8Array(readFileSync(`fixtures/fountain/${name}`));
      const original = input.slice();
      const document = parseFountain(input);
      const captured = serializeFountain(document);
      expect(captured).toEqual(input);
      expect(captured).not.toBe(input);
      captured.fill(0);
      expect(serializeFountain(document)).toEqual(input);
      input.fill(0);
      expect(serializeFountain(document)).toEqual(original);
    },
  );

  it.each(corpus.cases)(
    '$id preserves bytes, semantic order and every physical span',
    (entry) => {
      const input = fixtureBytes(entry);
      const document = parseFountain(input);
      expect(serializeFountain(document)).toEqual(input);
      expect(digest(serializeFountain(document))).toBe(entry.sha256);
      expect(atoms(document)).toEqual(entry.proofAtoms);
      const physical = [
        ...entry.sourceLiteral
          .replace(/^\ufeff/, '')
          .matchAll(/([^\r\n]*)(\r\n|\r|\n|$)/g),
      ].filter((match) => match[0] !== '');
      expect(document.lines).toHaveLength(physical.length);
      let offset = document.bom ? 3 : 0;
      for (const [index, match] of physical.entries()) {
        const line = document.lines[index]!;
        expect(line.sourceStart).toBe(offset);
        expect(line.contentEnd).toBe(offset + bytes(match[1]!).length);
        offset += bytes(match[0]).length;
        expect(line.sourceEnd).toBe(offset);
        expect(line.sourceText).toBe(match[1]);
        expect(line.newline).toBe(match[2]);
      }
      expect(offset).toBe(input.length);
    },
  );

  it.each(corpus.cases.filter((entry) => entry.edit))(
    '$id edit matches complete literal output and reparse meaning',
    (entry) => {
      const edit = entry.edit!;
      const before = parseFountain(fixtureBytes(entry));
      const after = replaceLine(before, edit.line, {
        kind: edit.kind as LineEdit['kind'],
        text: edit.text,
      });
      expect(serializeFountain(after)).toEqual(fixtureBytes(edit));
      expect(atoms(after)).toEqual(edit.proofAtoms);
      expect(atoms(parseFountain(serializeFountain(after)))).toEqual(
        edit.proofAtoms,
      );
      expect(after.lines.map((line) => line.id)).toEqual(
        before.lines.map((line) => line.id),
      );
      expect(serializeFountain(before)).toEqual(fixtureBytes(entry));
    },
  );

  it('retains invalid UTF-8 verbatim, read-only, without replacement characters', () => {
    const oracle = corpus.invalidUtf8;
    const input = new Uint8Array(
      readFileSync(`fixtures/fountain/${oracle.file}`),
    );
    expect(Buffer.from(input).toString('hex')).toBe(oracle.hex);
    const document = parseFountain(input);
    expect(document.lines).toEqual([]);
    expect(document.readOnlyReason).toContain('Invalid UTF-8');
    expect(serializeFountain(document)).toEqual(input);
    expectFailure(
      () => replaceLines(document, 0, 0, [{ kind: 'action', text: 'new' }]),
      'read-only',
    );
  });
});

describe('production primary element and context edit contract', () => {
  it.each([
    ['action', 'UPPERCASE WARNING', '!UPPERCASE WARNING'],
    ['sceneHeading', 'Rain on the tracks', '.Rain on the tracks'],
    ['transition', 'Dissolve slowly.', '>Dissolve slowly.'],
    ['lyrics', 'Quiet water', '~Quiet water'],
    ['centered', 'STILL WATER', '>STILL WATER<'],
    ['section', 'Arrival', '# Arrival'],
    ['synopsis', 'A signal arrives.', '= A signal arrives.'],
    ['pageBreak', '====', '===='],
    ['character', 'Zoë (on radio)', '@Zoë (on radio)'],
  ] as const)(
    'explicit %s survives source/reparse with its standard marker',
    (kind, text, literal) => {
      const before = parse('\nA signal.\n\n');
      const after = replaceLine(before, 1, { kind, text });
      expect(source(after)).toBe(`\n${literal}\n\n`);
      expect(after.lines[1]).toMatchObject({ kind, text });
      expect(semanticView(parseFountain(serializeFountain(after)))).toEqual(
        semanticView(after),
      );
    },
  );

  it('captures and preserves scene numbers, extensions, outline levels and force origin', () => {
    const document = parse(
      '.INT. DEPOT - NIGHT #A-2#\n\n@Zoë (on radio)\n(waiting)\nSignal.\n\n### Arrival\n',
    );
    expect(document.lines[0]).toMatchObject({
      marker: '.',
      sceneNumber: 'A-2',
    });
    expect(document.lines[2]).toMatchObject({
      marker: '@',
      characterName: 'Zoë',
      characterExtension: '(on radio)',
    });
    expect(document.lines[3]).toMatchObject({
      kind: 'parenthetical',
      speechOf: document.lines[2]!.id,
    });
    expect(document.lines[4]).toMatchObject({
      kind: 'dialogue',
      speechOf: document.lines[2]!.id,
    });
    const changed = replaceLine(document, 0, {
      kind: 'sceneHeading',
      text: 'EXT. DEPOT - DAWN',
    });
    expect(source(changed)).toContain('.EXT. DEPOT - DAWN #A-2#\n');
    const cleared = replaceLine(changed, 0, {
      kind: 'sceneHeading',
      text: 'EXT. DEPOT - DAWN',
      sceneNumber: null,
    });
    expect(cleared.lines[0]!.sceneNumber).toBeUndefined();
    expect(source(cleared)).toContain('.EXT. DEPOT - DAWN\n');
    const outline = replaceLine(document, 6, {
      kind: 'section',
      text: 'Departure',
    });
    expect(source(outline)).toContain('### Departure\n');
    expect(
      replaceLine(outline, 6, {
        kind: 'section',
        text: 'Departure',
        sectionLevel: 2,
      }).lines[6]!.sectionLevel,
    ).toBe(2);
  });

  it('treats Shot as portable action and restores its label only from matching recovery data', () => {
    const before = parse('\n!CLOSE ON THE LENS\n\n');
    const shot = replaceLine(before, 1, {
      kind: 'action',
      text: 'CLOSE ON THE LENS',
      actionSubtype: 'shot',
    });
    expect(serializeFountain(shot)).toEqual(serializeFountain(before));
    expect(shot.lines[1]).toMatchObject({
      kind: 'action',
      actionSubtype: 'shot',
    });
    expect(source(shot)).not.toContain(shot.lines[1]!.id);
    expect(parseFountain(shot.bytes).lines[1]!.actionSubtype).toBeUndefined();
    expect(
      parseFountain(shot.bytes, shot.recovery).lines[1]!.actionSubtype,
    ).toBe('shot');
    const changed = replaceLine(shot, 1, {
      kind: 'action',
      text: 'UPPERCASE AND ANOTHER LINE',
    });
    expect(changed.lines[1]!.actionSubtype).toBe('shot');
    expect(source(changed)).toContain('!UPPERCASE AND ANOTHER LINE');
  });

  it('refuses changing a cue alone; accepts an explicitly owned cue/speech context atomically', () => {
    const before = parse('\n@Mara\nThe signal.\n\nA wire hums.\n');
    expectFailure(
      () => replaceLine(before, 1, { kind: 'action', text: 'Mara waits.' }),
      'neighbor-drift',
    );
    const after = replaceLines(before, 1, 2, [
      { kind: 'action', text: 'Mara waits.' },
      { kind: 'action', text: 'The signal.' },
    ]);
    expect(source(after)).toBe(
      '\n!Mara waits.\n!The signal.\n\nA wire hums.\n',
    );
    expect(after.lines.map((line) => line.kind)).toEqual([
      'blank',
      'action',
      'action',
      'blank',
      'action',
    ]);
    expect(after.lines.map((line) => line.id)).toEqual(
      before.lines.map((line) => line.id),
    );
    expect(source(before)).toBe('\n@Mara\nThe signal.\n\nA wire hums.\n');
  });

  it('refuses context-spanning edits that alter an undeclared speech neighbor or consume raw text', () => {
    const before = parse('\n@Mara\nFirst.\nSecond.\n\n{{retain}}\n');
    expectFailure(
      () =>
        replaceLines(before, 1, 2, [
          { kind: 'action', text: 'Mara waits.' },
          { kind: 'action', text: 'First.' },
        ]),
      'neighbor-drift',
    );
    expectFailure(
      () =>
        replaceLines(before, 3, 3, [{ kind: 'action', text: 'all rewritten' }]),
      'protected-region',
    );
    expect(source(before)).toBe('\n@Mara\nFirst.\nSecond.\n\n{{retain}}\n');
  });

  it('inserts/deletes declared context, preserving neighboring bytes and cue IDs after offset changes', () => {
    const before = parse(
      '\ufeff\nA lens.\r\n\r\n@Zoë\nSignal.\n\n@Mara ^\nReply.',
    );
    const after = replaceLines(before, 1, 1, [
      { kind: 'action', text: 'A lens turns.' },
      { kind: 'action', text: 'Light.' },
    ]);
    expect(source(after)).toBe(
      '\ufeff\n!A lens turns.\r\n!Light.\r\n\r\n@Zoë\nSignal.\n\n@Mara ^\nReply.',
    );
    expect(after.lines[4]!.id).toBe(before.lines[3]!.id);
    expect(after.lines[5]!.speechOf).toBe(before.lines[3]!.id);
    expect(after.lines[7]!.dualWith).toBe(4);
    expect(after.lines.at(-1)!.id).toBe(before.lines.at(-1)!.id);
    expect(new Set(after.lines.map((line) => line.id)).size).toBe(
      after.lines.length,
    );
    const removed = replaceLines(after, 2, 1, []);
    expect(source(removed)).toBe(
      '\ufeff\n!A lens turns.\r\n\r\n@Zoë\nSignal.\n\n@Mara ^\nReply.',
    );
    expect(removed.lines[6]!.dualWith).toBe(3);
    // Immutable prior snapshots are suitable for transaction undo; no editor undo claim.
    expect(source(before)).toContain('A lens.\r\n');
    expect(source(after)).toContain('!Light.\r\n');
  });

  it('refuses removing a cue referenced by undeclared dual dialogue', () => {
    const before = parse('\n@Mara\nFirst.\n\n@Ivo ^\nReply.\n');
    expectFailure(
      () =>
        replaceLines(before, 1, 2, [
          { kind: 'action', text: 'Mara waits.' },
          { kind: 'action', text: 'First.' },
        ]),
      'neighbor-drift',
    );
    expect(before.lines[4]!.dualWith).toBe(1);
  });

  it('creates new source with LF, preserves existing missing-final-newline edits, and refuses merged EOF insertions', () => {
    const document = replaceLines(parse(''), 0, 0, [
      { kind: 'action', text: 'New source.' },
    ]);
    expect(source(document)).toBe('!New source.\n');
    const before = parse('\nA lens.');
    expect(
      source(replaceLine(before, 1, { kind: 'action', text: 'Turns.' })),
    ).toBe('\n!Turns.');
    expectFailure(
      () => replaceLines(before, 2, 0, [{ kind: 'action', text: 'Merged?' }]),
      'invalid-edit',
    );
    expect(
      source(
        replaceLines(before, 1, 1, [
          { kind: 'action', text: 'A lens.' },
          { kind: 'action', text: 'Turns.' },
        ]),
      ),
    ).toBe('\nA lens.\n!Turns.');
  });

  it('retains no-op indentation, BOM, mixed newline spelling, spaces and marker origin', () => {
    const before = parse('\ufeff\n  A lens.  \r\n\r\n  @Zoë (V.O.)\nSignal.\r');
    const after = replaceLine(before, 1, {
      kind: 'action',
      text: '  A lens.  ',
    });
    expect(after).toBe(before);
    expect(
      replaceLine(before, 3, { kind: 'character', text: 'Zoë (V.O.)' }),
    ).toBe(before);
    const shot = replaceLine(before, 1, {
      kind: 'action',
      text: '  A lens.  ',
      actionSubtype: 'shot',
    });
    expect(serializeFountain(shot)).toEqual(serializeFountain(before));
    const changed = replaceLine(before, 4, {
      kind: 'dialogue',
      text: 'Café 漢字 🚀.',
    });
    expect(source(changed)).toBe(
      '\ufeff\n  A lens.  \r\n\r\n  @Zoë (V.O.)\nCafé 漢字 🚀.\r',
    );
  });

  it('recognizes indented primary elements, punctuation in uppercase names and transition trailing-space ambiguity', () => {
    const document = parse(
      '\n\tINT. DEPOT - DAY\n\n\tMARA-2… (on radio)\n\t(waiting)\nSignal.\n\n\tCUT TO:\n\nCUT TO: \n\n...ellipsis\n',
    );
    expect(document.lines[1]).toMatchObject({
      kind: 'sceneHeading',
      text: 'INT. DEPOT - DAY',
    });
    expect(document.lines[3]).toMatchObject({
      kind: 'character',
      characterName: 'MARA-2…',
      characterExtension: '(on radio)',
    });
    expect(document.lines[4]).toMatchObject({
      kind: 'parenthetical',
      text: '(waiting)',
    });
    expect(document.lines[7]!.kind).toBe('transition');
    expect(document.lines[9]!.kind).toBe('action');
    expect(document.lines[11]).toMatchObject({
      kind: 'action',
      text: '...ellipsis',
    });
  });

  it('explicit markers outrank title-field inference and inferred speech at document start', () => {
    const document = replaceLines(parse(''), 0, 0, [
      { kind: 'action', text: 'CUT TO:' },
      { kind: 'character', text: 'Zoë' },
      { kind: 'dialogue', text: 'Signal.' },
      { kind: 'action', text: 'A lens turns.' },
    ]);
    expect(source(document)).toBe('!CUT TO:\n@Zoë\nSignal.\n!A lens turns.\n');
    expect(document.lines.map((line) => line.kind)).toEqual([
      'action',
      'character',
      'dialogue',
      'action',
    ]);
  });

  it('two-space speech immediately after a cue remains authored dialogue, including on a forced cue edit', () => {
    const document = parse('\n@Zoë\n  \nSignal.\n');
    expect(document.lines[2]).toMatchObject({
      kind: 'dialogue',
      text: '  ',
      speechOf: document.lines[1]!.id,
    });
    expect(document.lines[3]!.kind).toBe('dialogue');
    expect(document.diagnostics).toEqual([]);
    const after = replaceLine(document, 1, { kind: 'character', text: 'Mara' });
    expect(source(after)).toBe('\n@Mara\n  \nSignal.\n');
  });

  it('protects body embedded U+FEFF instead of silently stripping it while decoding lines', () => {
    const document = parse('\n\ufeffauthored body\n');
    expect(document.lines[1]!.text).toBe('\ufeffauthored body');
    expect(source(document)).toBe('\n\ufeffauthored body\n');
  });
});

describe('draft recovery, malformed input and snapshot isolation', () => {
  it('preserves authored blank content and two-space dialogue separately from empty intent', () => {
    const before = parse('\n@Zoë\nFirst.\n  \nLast.\n\n\n');
    expect(before.lines[3]).toMatchObject({ kind: 'dialogue', text: '  ' });
    expect(before.lines[6]).toMatchObject({
      kind: 'blank',
      blankRole: 'source',
      sourceText: '',
    });
    const empty = replaceLine(before, 6, { kind: 'dialogue', text: '' });
    expect(empty.lines[6]).toMatchObject({
      kind: 'blank',
      blankRole: 'draft',
      intendedKind: 'dialogue',
    });
    expect(serializeFountain(empty)).toEqual(serializeFountain(before));
    expect(
      empty.diagnostics.some(
        (diagnostic) => diagnostic.code === 'draft-intent',
      ),
    ).toBe(true);
    const reopened = parseFountain(
      empty.bytes,
      JSON.parse(JSON.stringify(empty.recovery)) as FountainRecovery,
    );
    expect(reopened.lines).toEqual(empty.lines);
    expect(parseFountain(empty.bytes).lines[6]!.intendedKind).toBeUndefined();
  });

  it('keeps empty cue authored as @, and incomplete cue text with diagnostic and matching recovery', () => {
    const before = parse('\nA lens.\n\n');
    const empty = replaceLine(before, 1, { kind: 'character', text: '' });
    expect(source(empty)).toBe('\n@\n\n');
    expect(empty.lines[1]).toMatchObject({
      kind: 'character',
      intendedKind: 'character',
      text: '',
    });
    expect(empty.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'incomplete-cue',
      'draft-intent',
    ]);
    expect(parseFountain(empty.bytes, empty.recovery).lines).toEqual(
      empty.lines,
    );
    const drafting = replaceLine(empty, 1, { kind: 'character', text: 'Zoë' });
    expect(source(drafting)).toBe('\n@Zoë\n\n');
    expect(drafting.lines[1]!.intendedKind).toBeUndefined();
    expect(drafting.diagnostics[0]!.code).toBe('incomplete-cue');
  });

  it('refuses empty speech that would retype later dialogue, with all original text intact', () => {
    const before = parse('\n@Zoë\nFirst.\nLast.\n');
    expectFailure(
      () => replaceLine(before, 2, { kind: 'dialogue', text: '' }),
      'neighbor-drift',
    );
    expect(source(before)).toBe('\n@Zoë\nFirst.\nLast.\n');
    const owned = replaceLines(before, 2, 2, [
      { kind: 'dialogue', text: '' },
      { kind: 'action', text: 'Last.' },
    ]);
    expect(source(owned)).toBe('\n@Zoë\n\n!Last.\n');
    expect(owned.lines[2]!.intendedKind).toBe('dialogue');
  });

  it('keeps incomplete parenthetical typing and exact speech bytes with recoverable intent, then completes it', () => {
    const before = parse('\n@Zoë\n(waiting)\nSignal.\n');
    const partial = replaceLine(before, 2, {
      kind: 'parenthetical',
      text: '(',
    });
    expect(source(partial)).toBe('\n@Zoë\n(\nSignal.\n');
    expect(partial.lines[2]).toMatchObject({
      kind: 'dialogue',
      text: '(',
      intendedKind: 'parenthetical',
      editable: true,
    });
    const reopen = parseFountain(partial.bytes, partial.recovery);
    expect(reopen.lines).toEqual(partial.lines);
    expect(parseFountain(partial.bytes).lines[2]!.editable).toBe(false);
    const continuing = replaceLine(reopen, 2, {
      kind: 'parenthetical',
      text: '(wait',
    });
    expect(source(continuing)).toBe('\n@Zoë\n(wait\nSignal.\n');
    const complete = replaceLine(continuing, 2, {
      kind: 'parenthetical',
      text: '(waiting)',
    });
    expect(complete.lines[2]).toMatchObject({
      kind: 'parenthetical',
      text: '(waiting)',
      editable: true,
    });
    expect(complete.lines[2]!.intendedKind).toBeUndefined();
    expect(source(complete)).toBe(source(before));
    const dialogue = replaceLine(before, 3, {
      kind: 'dialogue',
      text: '(drafting',
    });
    expect(dialogue.lines[3]).toMatchObject({
      kind: 'dialogue',
      text: '(drafting',
      intendedKind: 'dialogue',
      editable: true,
    });
    expect(
      source(
        replaceLine(dialogue, 3, {
          kind: 'dialogue',
          text: '(drafting onward',
        }),
      ),
    ).toContain('(drafting onward\n');
  });

  it('refuses deleting an empty intended EOF line without an ending, leaving an exact copy route', () => {
    const before = parse('\n@Zoë\nSignal.');
    expectFailure(
      () => replaceLine(before, 2, { kind: 'dialogue', text: '' }),
      'round-trip',
    );
    expect(source(before)).toBe('\n@Zoë\nSignal.');
  });

  it('diagnoses/ignores stale or invalid recovery metadata without changing bytes or interpretations', () => {
    const before = parse('\n!Lens.\n');
    const shot = replaceLine(before, 1, {
      kind: 'action',
      text: 'Lens.',
      actionSubtype: 'shot',
    });
    const changedSource = bytes('\n!Different.\n');
    const stale = parseFountain(changedSource, shot.recovery);
    expect(serializeFountain(stale)).toEqual(changedSource);
    expect(stale.lines[1]!.actionSubtype).toBeUndefined();
    expect(stale.diagnostics.at(-1)!.code).toBe('recovery-mismatch');
    for (const recovery of [
      { schema: 2, lines: [] },
      {
        schema: 1,
        lines: [
          { ...before.recovery.lines[0], id: 'same' },
          { ...before.recovery.lines[1], id: 'same' },
        ],
      },
      {
        schema: 1,
        lines: before.recovery.lines.map((line) => ({
          ...line,
          intendedKind: 'dialogue',
        })),
      },
    ]) {
      const result = parseFountain(
        before.bytes,
        recovery as unknown as FountainRecovery,
      );
      expect(result.diagnostics.at(-1)!.code).toBe('recovery-mismatch');
      expect(serializeFountain(result)).toEqual(before.bytes);
    }
  });

  it('rejects same-length newline changes and malformed metadata entries without crashing', () => {
    const document = parse('\n!Lens.\n');
    const metadata = document.recovery;
    const changedNewline = parseFountain(bytes('\r!Lens.\r'), metadata);
    expect(changedNewline.diagnostics.at(-1)!.code).toBe('recovery-mismatch');
    for (const malformed of [
      { schema: 1, bom: false, nextId: 2, lines: [null, null] },
      { ...metadata, nextId: 0 },
      {
        ...metadata,
        lines: [
          { ...metadata.lines[0], intendedKind: 'raw' },
          metadata.lines[1],
        ],
      },
      {
        ...metadata,
        lines: metadata.lines.map((line) => ({
          ...line,
          id: 'b9999999999999999999999',
        })),
      },
      'opaque',
      12,
    ]) {
      const result = parseFountain(
        document.bytes,
        malformed as unknown as FountainRecovery,
      );
      expect(result.diagnostics.at(-1)!.code).toBe('recovery-mismatch');
      expect(serializeFountain(result)).toEqual(document.bytes);
    }
  });

  it('never reallocates a deleted session ID; recovery retains the allocation high-water mark', () => {
    const before = parse('\n!A lens.\n!Light.\n');
    const deletedId = before.lines[2]!.id;
    const deleted = replaceLines(before, 2, 1, []);
    const reopened = parseFountain(deleted.bytes, deleted.recovery);
    const inserted = replaceLines(reopened, 2, 0, [
      { kind: 'action', text: 'New light.' },
    ]);
    expect(inserted.lines[2]!.id).not.toBe(deletedId);
    expect(inserted.recovery.nextId).toBeGreaterThan(before.recovery.nextId);
    const shot = replaceLine(inserted, 2, {
      kind: 'action',
      text: 'New light.',
      actionSubtype: 'shot',
    });
    const ordinary = replaceLine(shot, 2, {
      kind: 'action',
      text: 'New light.',
      actionSubtype: null,
    });
    expect(ordinary.lines[2]!.actionSubtype).toBeUndefined();
    expect(serializeFountain(ordinary)).toEqual(serializeFountain(shot));
  });

  it('freezes documents, fields, diagnostics, lines and recovery; all input/output byte arrays are owned copies', () => {
    const input = bytes('\n!Lens.\n\n@Draft\n');
    const literal = input.slice();
    const document = parseFountain(input);
    input.fill(0);
    document.bytes.fill(0);
    serializeFountain(document).fill(0);
    expect(serializeFountain(document)).toEqual(literal);
    for (const value of [
      document,
      document.lines,
      document.lines[1],
      document.diagnostics,
      document.diagnostics[0],
      document.recovery,
      document.recovery.lines,
      document.recovery.lines[0],
    ])
      expect(Object.isFrozen(value)).toBe(true);
    expect(() =>
      Object.assign(document.lines[1]!, { text: 'peer mutation' }),
    ).toThrow(TypeError);
    expect(source(document)).toBe('\n!Lens.\n\n@Draft\n');
    expect(() => serializeFountain({ ...document })).toThrow('codec-owned');
  });

  it('refuses raw/title/hidden/malformed conversions, including blank lines inside hidden regions', () => {
    const examples = [
      ['Title: Draft\n\nBody.\n', 0],
      ['\n{{opaque}}\n', 1],
      ['\n[[note\n  \nmore]]\n', 2],
      ['\n/*omit\n\nmore*/\n', 2],
      ['\n@Zoë\n(unfinished\n', 2],
      ['\n(unfinished\n', 1],
      ['\nAction [[mixed]] text.\n', 1],
      ['\n/*omit*/ Visible.\n', 1],
    ] as const;
    for (const [literal, line] of examples) {
      const before = parse(literal);
      expectFailure(
        () => replaceLine(before, line, { kind: 'action', text: 'convert' }),
        'protected-region',
      );
      expect(source(before)).toBe(literal);
    }
    expect(parse('\n[[unclosed\ntail').diagnostics.at(-1)!.code).toBe(
      'unclosed-region',
    );
    expect(parse('\n/*unclosed\n\ntail').diagnostics.at(-1)!.code).toBe(
      'unclosed-region',
    );
  });

  it.each([
    { kind: 'action', text: 'two\nlines' },
    { kind: 'action', text: 'two\rlines' },
    { kind: 'action', text: '\ud800' },
    { kind: 'action', text: '\udc00' },
    { kind: 'parenthetical', text: 'unwrapped' },
    { kind: 'pageBreak', text: '== body' },
    { kind: 'blank', text: 'content' },
    { kind: 'sceneHeading', text: 'INT. DEPOT', sceneNumber: 'bad #' },
    { kind: 'section', text: 'Act', sectionLevel: -1 },
    { kind: 'section', text: 'Act', sectionLevel: 257 },
    { kind: 'action', text: 'Shot?', actionSubtype: 'wrong' },
    { kind: 'lyrics', text: 'note', sceneNumber: '1' },
    { kind: 'action', text: 'outline', sectionLevel: 2 },
  ])('rejects invalid draft $kind/$text without dropping source', (edit) => {
    const before = parse('\nA lens.\n\n');
    expectFailure(
      () => replaceLine(before, 1, edit as LineEdit),
      'invalid-edit',
    );
    expect(source(before)).toBe('\nA lens.\n\n');
  });

  it.each([
    { kind: 'sceneHeading', text: ' leading space' },
    { kind: 'dialogue', text: '@Someone' },
    { kind: 'action', text: '[[hidden]]' },
    { kind: 'character', text: 'Someone ^' },
    { kind: 'transition', text: 'centered<' },
  ] as const)(
    'refuses ambiguous marker/context $kind/$text with exact source retained',
    (edit) => {
      const before = parse('\n@Zoë\nSignal.\n');
      expectFailure(() => replaceLine(before, 2, edit), 'round-trip');
      expect(source(before)).toBe('\n@Zoë\nSignal.\n');
    },
  );

  it('rejects invalid ranges and fabricated snapshots', () => {
    const document = parse('');
    for (const [from, count] of [
      [-1, 0],
      [0, -1],
      [1, 0],
      [NaN, 0],
      [0, 1],
      [0.5, 0],
    ])
      expectFailure(() => replaceLines(document, from!, count!, []), 'range');
    expect(() => replaceLines({ ...document }, 0, 0, [])).toThrow(
      'codec-owned',
    );
  });

  it('accounts for every byte across 512 deterministic malformed/encoding mutations without crashing or mutating input', () => {
    let state = 0x4d3302;
    for (let sample = 0; sample < 512; sample++) {
      const original = fixtureBytes(
        corpus.cases[sample % corpus.cases.length]!,
      );
      const mutated = original.slice();
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      mutated[state % mutated.length] = state >>> 24;
      const before = mutated.slice();
      const document = parseFountain(mutated);
      expect(serializeFountain(document)).toEqual(before);
      expect(mutated).toEqual(before);
      if (!document.readOnlyReason) {
        const spans = document.lines.map((line) =>
          serializeFountain(document).subarray(
            line.sourceStart,
            line.sourceEnd,
          ),
        );
        expect(
          Buffer.concat([
            document.bom ? Buffer.from([0xef, 0xbb, 0xbf]) : Buffer.alloc(0),
            ...spans.map((span) => Buffer.from(span)),
          ]),
        ).toEqual(Buffer.from(before));
      }
    }
  });

  it('all successful primary action mutations preserve exact prefix/suffix and full reparse meaning; refusals retain bytes', () => {
    const document = parse('\ufeff\n!A lens.\r\n\r\n@Zoë\nSignal.');
    const literal = serializeFountain(document);
    const alphabet = [
      'Café',
      '🚀',
      '漢字',
      '\t',
      '  ',
      '@',
      '!',
      '#',
      '>',
      '=',
      '.',
      '[[',
      '/*',
      '\\*',
      '**',
    ];
    let accepted = 0;
    let refused = 0;
    for (let sample = 0; sample < 128; sample++) {
      const value =
        alphabet[sample % alphabet.length]! +
        ' Lens ' +
        alphabet[(sample * 7) % alphabet.length]!;
      try {
        const after = replaceLine(document, 1, { kind: 'action', text: value });
        expect(after.lines[1]).toMatchObject({ kind: 'action', text: value });
        expect(semanticView(parseFountain(after.bytes))).toEqual(
          semanticView(after),
        );
        expect(after.bytes.subarray(0, after.lines[1]!.sourceStart)).toEqual(
          literal.subarray(0, document.lines[1]!.sourceStart),
        );
        expect(after.bytes.subarray(after.lines[1]!.sourceEnd)).toEqual(
          literal.subarray(document.lines[1]!.sourceEnd),
        );
        accepted++;
      } catch (error) {
        expect(error).toBeInstanceOf(FountainEditError);
        expect((error as FountainEditError).code).toBe('round-trip');
        refused++;
      }
      expect(serializeFountain(document)).toEqual(literal);
    }
    expect(accepted).toBeGreaterThan(0);
    expect(refused).toBeGreaterThan(0);
  });
});
