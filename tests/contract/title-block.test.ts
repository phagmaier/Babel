import { describe, expect, it } from 'vitest';
import {
  FountainEditError,
  parseFountain,
  serializeFountain,
} from '../../src/domain/fountainCodec';
import type { FountainDocument } from '../../src/domain/fountainModel';
import { changeTitlePage, type TitleAction } from '../../src/domain/titlePage';

// AUDIT-D04-R1 (owner-approved rule): a leading `Key:` block is a title page
// only if at least one field has a value, on its key line or as an indented
// continuation. A block of empty fields is body text, as the pinned renderer
// reads it. Independent renderer evidence: fixtures/assessment/oracle.json.
const bytes = (s: string) => new TextEncoder().encode(s);
// Plain arrays: JSDOM and Node Uint8Array realms differ.
const same = (document: FountainDocument, source: string) =>
  expect([...serializeFountain(document)]).toEqual([...bytes(source)]);
const parse = (s: string) => parseFountain(bytes(s));
const kinds = (document: FountainDocument) =>
  document.lines.map((line) => `${line.kind}:${line.text}`);
const keys = (document: FountainDocument) =>
  document.titleFields.map((field) => field.key);

describe('AUDIT-D04-R1 empty leading Key: block', () => {
  it.each([
    ['FADE IN:\n\n.INT. LAB - DAY\n', ['action:FADE IN:']],
    ['Title:   \n\n.INT. LAB - DAY\n', ['action:Title:   ']],
    ['Title:\t\n\n.INT. LAB - DAY\n', ['action:Title:\t']],
    ['﻿FADE IN:\r\n\r\n.INT. LAB - DAY\r\n', ['action:FADE IN:']],
    [
      'FADE IN:\nCUT TO:\n\n.INT. LAB - DAY\n',
      ['character:FADE IN:', 'dialogue:CUT TO:'],
    ],
    [
      'FADE IN:\nA lamp glows.\n\n.INT. LAB - DAY\n',
      ['character:FADE IN:', 'dialogue:A lamp glows.'],
    ],
  ])('%j is body text and a byte no-op', (source, expected) => {
    const document = parse(source);
    expect(document.titleFields).toEqual([]);
    expect(kinds(document).slice(0, expected.length)).toEqual(expected);
    same(document, source);
  });

  it.each([
    ['Title: Night Shift\n\n.INT. LAB - DAY\n', ['Title']],
    ['Title:\n    Night Shift\n\n.INT. LAB - DAY\n', ['Title']],
    ['Title:\n\tNight Shift\n\n.INT. LAB - DAY\n', ['Title']],
    [
      'Draft date:\nTitle: Night Shift\n\n.INT. LAB - DAY\n',
      ['Draft date', 'Title'],
    ],
    [
      'Contact:\nAuthor: Sam\nCredit:\n\n.INT. LAB - DAY\n',
      ['Contact', 'Author', 'Credit'],
    ],
  ])('%j keeps every field once one has a value', (source, expected) => {
    const document = parse(source);
    expect(keys(document)).toEqual(expected);
    same(document, source);
  });
});

describe('AUDIT-D04-R1 the title-page form cannot produce an all-empty block', () => {
  const page = 'Title: Night Shift\nDraft date:\n\n.INT. LAB - DAY\n';
  const refuses = (document: FountainDocument, action: TitleAction) => {
    expect(() => changeTitlePage(document, action)).toThrow(FountainEditError);
  };
  it('refuses to add an empty first field to an empty or body-only script', () => {
    for (const source of ['', '.INT. LAB - DAY\n'])
      for (const values of [[''], ['   '], ['', '']])
        refuses(parse(source), { kind: 'add', key: 'Title', values });
  });
  it('refuses to empty the only valued field or remove it beside empty fields', () => {
    const document = parse(page);
    const [title, draft] = document.titleFields;
    refuses(document, {
      kind: 'edit',
      id: title!.id,
      key: 'Title',
      values: [''],
    });
    refuses(document, { kind: 'remove', id: title!.id });
    expect(draft!.values.map((value) => value.text)).toEqual(['']);
    same(document, page);
  });
  it('allows empty fields while one value remains, and a value by continuation', () => {
    const document = parse(page);
    const [title, draft] = document.titleFields;
    const added = changeTitlePage(document, {
      kind: 'add',
      key: 'Contact',
      values: [''],
    });
    expect(keys(added)).toEqual(['Title', 'Draft date', 'Contact']);
    const continued = changeTitlePage(document, {
      kind: 'edit',
      id: title!.id,
      key: 'Title',
      values: ['', 'Night Shift'],
    });
    expect(keys(continued)).toEqual(['Title', 'Draft date']);
    const moved = changeTitlePage(document, {
      kind: 'move',
      id: draft!.id,
      direction: 'up',
    });
    expect(keys(moved)).toEqual(['Draft date', 'Title']);
  });
  it('keeps the native title drill add: an empty Contact on a valued CRLF page', () => {
    // tests/native/writing-lifecycle/title_page.py adds this field (BLOCKED here).
    const source =
      '\ufeffTitle:\t**Film**\r\n\t  Subtitle\r\nAuthor: Ann\nX-Private: retain  \r\nAuthor: Bob\r\n\r\n.INT. ROOM\r\n!Body *untouched*.  ';
    const added = changeTitlePage(parse(source), {
      kind: 'add',
      key: 'Contact',
      values: [''],
    });
    same(
      added,
      source.replace('Author: Bob\r\n\r\n', 'Author: Bob\r\nContact: \r\n\r\n'),
    );
  });
  it('every accepted action leaves no block or a block with a value', () => {
    const sources = [
      '',
      page,
      'Title: A\n\n!Body.\n',
      'Title:\n    A\nAuthor:\n\n!Body.\n',
      'Author: Sam\nTitle: A\nCredit:\n\n!Body.\n',
    ];
    const valueSets = [[''], ['  '], ['x'], ['', 'x'], ['', '']];
    let accepted = 0;
    for (const source of sources) {
      const document = parse(source);
      const actions: TitleAction[] = valueSets.map((values) => ({
        kind: 'add',
        key: 'Notes',
        values,
      }));
      for (const field of document.titleFields) {
        actions.push({ kind: 'remove', id: field.id });
        actions.push({ kind: 'move', id: field.id, direction: 'up' });
        actions.push({ kind: 'move', id: field.id, direction: 'down' });
        for (const values of valueSets)
          actions.push({ kind: 'edit', id: field.id, key: field.key, values });
      }
      for (const action of actions) {
        let next: FountainDocument;
        try {
          next = changeTitlePage(document, action);
        } catch (error) {
          expect(error).toBeInstanceOf(FountainEditError);
          continue;
        }
        accepted++;
        // The leading block is either absent or carries at least one value.
        const leading = next.lines.findIndex((line) => line.kind === 'blank');
        const block = next.lines.slice(0, leading < 0 ? undefined : leading);
        if (next.titleFields.length)
          expect(
            next.titleFields.some((field) =>
              field.values.some((value) => value.text.trim() !== ''),
            ),
          ).toBe(true);
        else expect(block.some((line) => line.kind === 'title')).toBe(false);
        // Reopening the saved bytes reads the same fields.
        const fields = (document: FountainDocument) =>
          document.titleFields.map((field) => [
            field.key,
            field.values.map((value) => value.text),
          ]);
        expect(fields(parseFountain(serializeFountain(next)))).toEqual(
          fields(next),
        );
      }
    }
    expect(accepted).toBeGreaterThan(20);
  });
});
