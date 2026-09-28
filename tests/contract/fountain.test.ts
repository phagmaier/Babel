import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  parseFountain,
  replaceLine,
  semanticView,
  unchangedBytes,
  type Document,
  type Kind,
} from '../../prototypes/fountain/codec';

const fixture = (name: string) =>
  new Uint8Array(readFileSync(resolve('fixtures/fountain', name)));
const text = (bytes: Uint8Array) => new TextDecoder('utf-8').decode(bytes);
const find = (document: Document, kind: Kind, value: string) => {
  const index = document.lines.findIndex(
    (line) => line.kind === kind && line.text === value,
  );
  expect(index).toBeGreaterThanOrEqual(0);
  return index;
};

describe('M1-01 source-aware Fountain proof', () => {
  it.each([
    'elements.fountain',
    'ambiguity.fountain',
    'windows-bom.fountain',
    'invalid-utf8.fountain',
  ])('%s returns exact bytes on a no-op', (name) => {
    const input = fixture(name);
    const parsed = parseFountain(input);
    expect(unchangedBytes(parsed)).toEqual(input);
    expect(parsed.bytes).not.toBe(input);
  });

  it('recognizes authored elements, title metadata, dual speech and omitted content', () => {
    const parsed = parseFountain(fixture('elements.fountain'));
    const view = semanticView(parsed);
    expect(view.slice(0, 6)).toEqual([
      {
        kind: 'title',
        text: 'Lantern Harbor',
        titleKey: 'Title',
        sectionLevel: undefined,
        sceneNumber: undefined,
        dualWith: undefined,
      },
      {
        kind: 'title',
        text: 'N. Example',
        titleKey: 'Author',
        sectionLevel: undefined,
        sceneNumber: undefined,
        dualWith: undefined,
      },
      {
        kind: 'title',
        text: 'keep this value',
        titleKey: 'Unmapped field',
        sectionLevel: undefined,
        sceneNumber: undefined,
        dualWith: undefined,
      },
      {
        kind: 'title',
        text: '',
        titleKey: 'Contact',
        sectionLevel: undefined,
        sceneNumber: undefined,
        dualWith: undefined,
      },
      {
        kind: 'titleContinuation',
        text: 'Box 7',
        titleKey: undefined,
        sectionLevel: undefined,
        sceneNumber: undefined,
        dualWith: undefined,
      },
      {
        kind: 'titleContinuation',
        text: 'Dockside',
        titleKey: undefined,
        sectionLevel: undefined,
        sceneNumber: undefined,
        dualWith: undefined,
      },
    ]);
    expect(
      parsed.lines.some(
        (line) =>
          line.kind === 'section' &&
          line.sectionLevel === 2 &&
          line.text === 'Arrival',
      ),
    ).toBe(true);
    expect(
      parsed.lines.some(
        (line) => line.kind === 'sceneHeading' && line.sceneNumber === '1A',
      ),
    ).toBe(true);
    expect(
      parsed.lines.some(
        (line) => line.kind === 'character' && line.text === 'MiXeD (V.O.)',
      ),
    ).toBe(true);
    expect(
      parsed.lines.some(
        (line) =>
          line.kind === 'parenthetical' && line.text === '(under breath)',
      ),
    ).toBe(true);
    expect(
      parsed.lines.some(
        (line) =>
          line.kind === 'dialogue' && line.text === 'There is still time.',
      ),
    ).toBe(true);
    expect(
      parsed.lines.some(
        (line) => line.kind === 'dialogue' && line.text === '  ',
      ),
    ).toBe(true);
    expect(
      parsed.lines.some(
        (line) => line.kind === 'parenthetical' && line.text === '(a beat)',
      ),
    ).toBe(true);
    const mara = find(parsed, 'character', 'MARA');
    const ivo = find(parsed, 'character', 'IVO');
    expect(parsed.lines[ivo]?.dualWith).toBe(mara);
    for (const kind of [
      'lyrics',
      'centered',
      'transition',
      'pageBreak',
      'note',
      'boneyard',
      'synopsis',
    ] as Kind[]) {
      expect(parsed.lines.some((line) => line.kind === kind)).toBe(true);
    }
    expect(
      parsed.lines.some(
        (line) => line.kind === 'action' && line.text.includes('\\*star\\*'),
      ),
    ).toBe(true);
  });

  it('edits one action line without touching title, dual dialogue, note, boneyard or bytes around it', () => {
    const original = parseFountain(fixture('elements.fountain'));
    const index = find(original, 'action', 'The lens turns.');
    const edited = replaceLine(
      original,
      index,
      'action',
      'The lens catches dawn.',
    );
    expect(edited.lines[index]).toMatchObject({
      kind: 'action',
      text: 'The lens catches dawn.',
    });
    expect(semanticView(edited).filter((_, i) => i !== index)).toEqual(
      semanticView(original).filter((_, i) => i !== index),
    );
    expect(
      edited.bytes.subarray(0, original.lines[index]!.sourceStart),
    ).toEqual(original.bytes.subarray(0, original.lines[index]!.sourceStart));
    expect(text(edited.bytes)).toContain('!The lens catches dawn.\n');
    expect(text(edited.bytes)).toContain(
      '/*\nEXT. OLD ROAD - NIGHT\nThis omitted route stays in the source.\n*/',
    );
  });

  it('uses forcing markers for explicit action, heading and character choices', () => {
    const original = parseFountain(fixture('ambiguity.fountain'));
    const action = find(original, 'action', 'MAYA');
    const changedAction = replaceLine(
      original,
      action,
      'action',
      'UPPERCASE WARNING',
    );
    expect(changedAction.lines[action]).toMatchObject({
      kind: 'action',
      text: 'UPPERCASE WARNING',
      marker: '!',
    });
    expect(text(changedAction.bytes)).toContain(
      '!UPPERCASE WARNING\nwalks past the train.',
    );
    const heading = find(original, 'sceneHeading', 'EXT. PLATFORM - DAY');
    const changedHeading = replaceLine(
      original,
      heading,
      'sceneHeading',
      'Rain on the tracks',
    );
    expect(changedHeading.lines[heading]).toMatchObject({
      kind: 'sceneHeading',
      text: 'Rain on the tracks',
      marker: '.',
    });
    const cue = find(original, 'character', 'McLane');
    const changedCue = replaceLine(original, cue, 'character', 'McCLANE');
    expect(changedCue.lines[cue]).toMatchObject({
      kind: 'character',
      text: 'McCLANE',
      marker: '@',
    });

    const numbered = parseFountain(fixture('elements.fountain'));
    const numberedHeading = find(
      numbered,
      'sceneHeading',
      'INT. FERRY TERMINAL - DUSK',
    );
    const revised = replaceLine(
      numbered,
      numberedHeading,
      'sceneHeading',
      'EXT. FERRY TERMINAL - DAWN',
    );
    expect(revised.lines[numberedHeading]).toMatchObject({
      kind: 'sceneHeading',
      text: 'EXT. FERRY TERMINAL - DAWN',
      sceneNumber: '1A',
    });
    expect(text(revised.bytes)).toContain('.EXT. FERRY TERMINAL - DAWN #1A#');
  });

  it('preserves BOM, CRLF, Unicode, intentional blanks and missing final newline on an edit', () => {
    const original = parseFountain(fixture('windows-bom.fountain'));
    expect(original.bom).toBe(true);
    const index = find(original, 'action', 'A lantern glows.');
    const edited = replaceLine(
      original,
      index,
      'action',
      'A lantern glows for Zoë.',
    );
    expect(edited.bytes.subarray(0, 3)).toEqual(
      new Uint8Array([0xef, 0xbb, 0xbf]),
    );
    expect(text(edited.bytes)).toContain(
      '!A lantern glows for Zoë.\r\n\r\n\r\n@Zoë',
    );
    expect(text(edited.bytes).endsWith('The end.')).toBe(true);
    expect(edited.lines.filter((line) => line.kind === 'blank')).toHaveLength(
      original.lines.filter((line) => line.kind === 'blank').length,
    );
  });

  it('keeps unsupported and incomplete content visible with explicit restrictions', () => {
    const parsed = parseFountain(fixture('ambiguity.fountain'));
    expect(parsed.diagnostics).toContain(
      'Line 19: unsupported region retained verbatim',
    );
    expect(
      parsed.diagnostics.some((message) =>
        message.includes('incomplete character cue'),
      ),
    ).toBe(true);
    const raw = find(parsed, 'raw', '{{future-extension: preserve verbatim}}');
    expect(() => replaceLine(parsed, raw, 'action', 'changed')).toThrow(
      'outside the M1-01 proof',
    );
    const invalid = parseFountain(fixture('invalid-utf8.fountain'));
    expect(invalid.readOnlyReason).toMatch(/Invalid UTF-8/);
    expect(() => replaceLine(invalid, 0, 'action', 'changed')).toThrow(
      'read-only',
    );
  });

  it("refuses an edit that changes a neighboring cue's interpretation", () => {
    const parsed = parseFountain(fixture('ambiguity.fountain'));
    const action = find(parsed, 'action', 'walks past the train.');
    expect(() => replaceLine(parsed, action, 'dialogue', 'Hello.')).toThrow(
      'round-trip unambiguously',
    );
    expect(unchangedBytes(parsed)).toEqual(fixture('ambiguity.fountain'));

    const dual = parseFountain(fixture('elements.fountain'));
    const mara = find(dual, 'character', 'MARA');
    expect(() =>
      replaceLine(dual, mara, 'action', 'Mara passes the key.'),
    ).toThrow('neighboring Fountain interpretation');
  });

  it('keeps source prefixes and line endings for a bounded set of Unicode action edits', () => {
    const source = parseFountain(fixture('windows-bom.fountain'));
    const line = find(source, 'action', 'A lantern glows.');
    const prefix = source.bytes.subarray(0, source.lines[line]!.sourceStart);
    for (const value of [
      'Café',
      "Zoë's light",
      '漢字 and rain',
      '😀 **bold**',
      '!literal bang',
      'INT. as prose',
    ]) {
      const edited = replaceLine(source, line, 'action', value);
      expect(edited.lines[line]).toMatchObject({ kind: 'action', text: value });
      expect(edited.bytes.subarray(0, prefix.length)).toEqual(prefix);
      expect(edited.lines[line]?.newline).toBe('\r\n');
      expect(edited.lines.at(-1)?.newline).toBe('');
    }
  });
});
