import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  parseFountain,
  replaceLine,
  unchangedBytes,
} from '../../prototypes/fountain/codec';
import {
  digest,
  fixtureBytes,
  loadCorpus,
  proofAtoms,
} from '../../prototypes/fountain-conformance/corpus';

const corpus = loadCorpus();

describe('M3-01 independently authored corpus against the M1 proof subset', () => {
  it.each(corpus.cases)(
    '$id preserves exact no-op bytes and all declared line semantics',
    (entry) => {
      const source = fixtureBytes(entry);
      const parsed = parseFountain(source);
      expect(parsed.readOnlyReason).toBeUndefined();
      expect(unchangedBytes(parsed)).toEqual(source);
      expect(proofAtoms(parsed)).toEqual(entry.proofAtoms);
      // A returned snapshot is not a mutable peer to the source authority.
      const copy = unchangedBytes(parsed);
      copy.fill(0);
      expect(unchangedBytes(parsed)).toEqual(source);
    },
  );

  it.each(corpus.cases)(
    '$id accounts for every source byte/line ending, including blank content',
    (entry) => {
      const source = fixtureBytes(entry);
      const parsed = parseFountain(source);
      const literal = entry.sourceLiteral.replace(/^\ufeff/, '');
      // Independent physical-line inventory from the authored literal, not the codec.
      const lines = [...literal.matchAll(/([^\r\n]*)(\r\n|\r|\n|$)/g)].filter(
        (match) => match[0] !== '',
      );
      expect(parsed.lines).toHaveLength(lines.length);
      let offset = entry.sourceLiteral.startsWith('\ufeff') ? 3 : 0;
      for (const [index, match] of lines.entries()) {
        const line = parsed.lines[index]!;
        const bytes = Buffer.from(match[0], 'utf8');
        expect(line.sourceStart).toBe(offset);
        expect(line.sourceEnd).toBe(offset + bytes.length);
        expect(line.newline).toBe(match[2]);
        expect(
          Buffer.from(source.subarray(line.sourceStart, line.sourceEnd)),
        ).toEqual(bytes);
        offset += bytes.length;
      }
      expect(offset).toBe(source.length);
    },
  );

  it.each(corpus.cases.filter((entry) => entry.edit))(
    '$id edit matches independent full bytes, semantics and untouched context',
    (entry) => {
      const edit = entry.edit!;
      const source = fixtureBytes(entry);
      const before = parseFountain(source);
      const prior = before.lines[edit.line]!;
      const after = replaceLine(before, edit.line, edit.kind, edit.text);
      expect(after.bytes).toEqual(fixtureBytes(edit));
      expect(proofAtoms(after)).toEqual(edit.proofAtoms);
      expect(proofAtoms(parseFountain(after.bytes))).toEqual(edit.proofAtoms);
      expect(after.bytes.subarray(0, prior.sourceStart)).toEqual(
        source.subarray(0, prior.sourceStart),
      );
      expect(after.bytes.subarray(after.lines[edit.line]!.sourceEnd)).toEqual(
        source.subarray(prior.sourceEnd),
      );
      expect(unchangedBytes(before)).toEqual(source);
    },
  );

  it('preserves the existing invalid UTF-8 literal bytes and refuses structured editing', () => {
    const oracle = corpus.invalidUtf8;
    const source = new Uint8Array(
      readFileSync(`fixtures/fountain/${oracle.file}`),
    );
    expect(Buffer.from(source).toString('hex')).toBe(oracle.hex);
    expect(digest(source)).toBe(oracle.sha256);
    const document = parseFountain(source);
    expect(document.readOnlyReason).toMatch(/Invalid UTF-8/);
    expect(unchangedBytes(document)).toEqual(source);
    expect(() => replaceLine(document, 0, 'action', 'changed')).toThrow(
      'read-only',
    );
  });

  it('keeps unproved title/note/raw conversions refused with the original source intact', () => {
    for (const [id, kind] of [
      ['title', 'title'],
      ['hidden-outline', 'note'],
      ['unfinished', 'raw'],
    ] as const) {
      const entry = corpus.cases.find((candidate) => candidate.id === id)!;
      const original = fixtureBytes(entry);
      const document = parseFountain(original);
      const line = document.lines.findIndex(
        (candidate) => candidate.kind === kind,
      );
      expect(line).toBeGreaterThanOrEqual(0);
      expect(() =>
        replaceLine(document, line, 'action', 'convert this'),
      ).toThrow('outside the M1-01 proof');
      expect(unchangedBytes(document)).toEqual(original);
    }
  });

  it('diagnoses incomplete cues and unknown body text without deleting an unclosed note tail', () => {
    const entry = corpus.cases.find(
      (candidate) => candidate.id === 'unfinished',
    )!;
    const document = parseFountain(fixtureBytes(entry));
    expect(
      document.diagnostics.some((message) =>
        message.includes('incomplete character cue'),
      ),
    ).toBe(true);
    expect(
      document.diagnostics.some((message) =>
        message.includes('unsupported region retained verbatim'),
      ),
    ).toBe(true);
    expect(document.lines.at(-1)).toMatchObject({
      kind: 'note',
      text: 'retain its tail',
      newline: '',
    });
    expect(unchangedBytes(document)).toEqual(fixtureBytes(entry));
  });

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

  it('returns all bytes without throwing for deterministic malformed marker/encoding mutations', () => {
    let state = 0x4d3301;
    for (let sample = 0; sample < 128; sample++) {
      const entry = corpus.cases[sample % corpus.cases.length]!;
      const input = fixtureBytes(entry).slice();
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      input[state % input.length] = state >>> 24;
      const parsed = parseFountain(input);
      expect(unchangedBytes(parsed)).toEqual(input);
    }
  });
});
