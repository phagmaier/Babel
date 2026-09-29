import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PersistenceController } from '../../src/application/persistenceController';
import type {
  DocumentPort,
  SaveReceipt,
} from '../../src/application/documents';
import { opened as fakeOpened } from './persistence-fixtures';
import { DOMSerializer } from 'prosemirror-model';
import { describe, expect, it } from 'vitest';
import { closeHistory, redo, undo } from 'prosemirror-history';
import { TextSelection } from 'prosemirror-state';
import {
  apply,
  createState,
  currentVersion,
  snapshot,
  schema,
} from '../../prototypes/editor-composition/model';

function fixture(name: string) {
  return new Uint8Array(
    readFileSync(`prototypes/editor-composition/fixtures/${name}.fountain`),
  );
}
function position(
  state: ReturnType<typeof createState>,
  line: number,
  offset: number,
) {
  let start = 1;
  for (let index = 0; index < line; index++)
    start += state.doc.child(index).nodeSize;
  return start + offset;
}

describe('M1-06 bounded typed editor/source composition (no native I/O)', () => {
  for (const name of ['lf', 'crlf', 'no-final-newline']) {
    it(`${name}: no-op bytes, typed nodes, source ranges and stable IDs`, () => {
      const bytes = fixture(name);
      const state = createState(bytes);
      expect(snapshot(state).source).toEqual(bytes);
      expect(state.doc.child(0).type.name).toBe('sceneHeading');
      expect(state.doc.child(2).type.name).toBe('action');
      expect(state.doc.child(4).type.name).toBe('character');
      expect(state.doc.child(5).type.name).toBe('dialogue');
      expect(state.doc.child(7).type.name).toBe('raw');
      const ranges = snapshot(state).ranges;
      expect(ranges[0]!.from).toBe(name === 'crlf' ? 3 : 0);
      expect(ranges.at(-1)!.to).toBe(bytes.length);
    });
    it(`${name}: typed Unicode edit, independent oracle, selection plus undo/redo`, () => {
      let state = createState(fixture(name));
      const tail = position(state, 2, state.doc.child(2).textContent.length);
      state = apply(
        state,
        state.tr.setSelection(TextSelection.create(state.doc, tail)),
      ).state;
      const before = snapshot(state);
      const inserted = apply(state, closeHistory(state.tr).insertText(' é🚀'));
      expect(inserted.accepted).toBe(true);
      state = inserted.state;
      const after = snapshot(state);
      expect(after.source).toEqual(fixture(`${name}-edited`));
      expect(after.selection.head.utf16Offset).toBe(28);
      expect(after.selection.head.byteOffset).toBe(
        after.ranges[2]!.to - (name === 'crlf' ? 2 : 1),
      );
      expect(after.semantics[2]).toEqual({
        kind: 'action',
        text: 'A lamp glows beside Zoë. é🚀',
      });
      expect(after.semantics.filter((_, i) => i !== 2)).toEqual(
        before.semantics.filter((_, i) => i !== 2),
      );
      expect(
        undo(state, (tr) => {
          state = apply(state, tr).state;
        }),
      ).toBe(true);
      expect(snapshot(state).source).toEqual(fixture(name));
      expect(snapshot(state).selection).toEqual(before.selection);
      expect(snapshot(state).version).toBeGreaterThan(after.version);
      const undoneVersion = snapshot(state).version;
      expect(
        redo(state, (tr) => {
          state = apply(state, tr).state;
        }),
      ).toBe(true);
      expect(snapshot(state).source).toEqual(fixture(`${name}-edited`));
      expect(snapshot(state).selection).toEqual(after.selection);
      expect(snapshot(state).version).toBeGreaterThan(undoneVersion);
      expect(state.doc.child(2).attrs.id).toBe('line-2');
    });
  }
  it('selection replacement has expected bytes, restores the selected range on undo', () => {
    let state = createState(fixture('lf'));
    const from = position(state, 2, 2),
      to = position(state, 2, 6);
    state = apply(
      state,
      state.tr.setSelection(TextSelection.create(state.doc, from, to)),
    ).state;
    const selected = snapshot(state);
    state = apply(state, closeHistory(state.tr).insertText('beacon')).state;
    expect(new TextDecoder().decode(snapshot(state).source)).toBe(
      'INT. TEST LAB - DAY #1#\n\n!A beacon glows beside Zoë.\n\n@Mira\nWait for the signal.\n\n{{opaque: keep  two spaces}}\n\n',
    );
    undo(state, (tr) => {
      state = apply(state, tr).state;
    });
    expect(snapshot(state).source).toEqual(fixture('lf'));
    expect(snapshot(state).selection).toEqual(selected.selection);
  });
  it('heading, cue and dialogue retain typed semantics and their neighbors', () => {
    for (const [line, text, kind] of [
      [0, 'INT. NEW LAB - DAY', 'sceneHeading'],
      [4, 'Ari', 'character'],
      [5, 'Signal received.', 'dialogue'],
    ] as const) {
      const state = createState(fixture('crlf'));
      const from = position(state, line, 0),
        to = from + state.doc.child(line).textContent.length;
      const result = apply(state, state.tr.insertText(text, from, to));
      expect(result.accepted).toBe(true);
      expect(snapshot(result.state).semantics[line]).toEqual({ kind, text });
      expect(snapshot(result.state).source.slice(0, 3)).toEqual(
        new Uint8Array([239, 187, 191]),
      );
    }
  });
  it('refuses protected edits, raw HTML, line splits, grammar drift and invalid Unicode without changing state', () => {
    const state = createState(fixture('lf'));
    for (const [line, text] of [
      [7, 'changed'],
      [2, 'line\nbreak'],
      [2, '\ud800'],
      [5, ''],
      [2, '{{raw}}'],
    ] as const) {
      const from = position(state, line, 0),
        to = from + state.doc.child(line).textContent.length;
      const result = apply(state, state.tr.insertText(text, from, to));
      expect(result.accepted).toBe(false);
      expect(result.state).toBe(state);
      expect(snapshot(result.state).source).toEqual(fixture('lf'));
    }
    const result = apply(state, state.tr.split(position(state, 2, 4)));
    expect(result.accepted).toBe(false);
    expect(result.state).toBe(state);
  });
  it('refuses unsupported encoding and oversized proof inputs; caller bytes cannot mutate state', () => {
    expect(() => createState(new Uint8Array([255]))).toThrow('Invalid UTF-8');
    expect(() =>
      createState(new TextEncoder().encode('x'.repeat(4097))),
    ).toThrow('4 KiB');
    const bytes = fixture('lf');
    const state = createState(bytes);
    bytes.fill(0);
    const captured = snapshot(state);
    captured.source.fill(0);
    expect(snapshot(state).source).toEqual(fixture('lf'));
  });
  it('renders authored HTML-looking content as literal text without active elements', () => {
    const state = createState(fixture('lf'));
    const from = position(state, 2, 0),
      to = from + state.doc.child(2).textContent.length;
    const result = apply(
      state,
      state.tr.insertText(
        '<img src="https://example.invalid/private" onerror="alert(1)">',
        from,
        to,
      ),
    );
    expect(result.accepted).toBe(true);
    const rendered = DOMSerializer.fromSchema(schema).serializeFragment(
      result.state.doc.content,
    );
    const host = document.createElement('div');
    host.append(rendered);
    expect(host.querySelector('img')).toBeNull();
    expect(host.textContent).toContain(
      '<img src="https://example.invalid/private" onerror="alert(1)">',
    );
  });
  it('keeps editor v2 dirty when a v1 receipt arrives before the next asynchronous capture (mock port)', async () => {
    let state = createState(fixture('lf'));
    const opened = fakeOpened();
    const first = snapshot(state);
    const hash = createHash('sha256').update(first.source).digest('hex');
    opened.source = Array.from(first.source);
    opened.fingerprint = {
      ...opened.fingerprint!,
      byteLength: first.source.length,
      sha256: hash,
    };
    let finish!: (receipt: SaveReceipt) => void;
    const held = new Promise<SaveReceipt>((resolve) => {
      finish = resolve;
    });
    const port: DocumentPort = {
      readInitial: async () => opened,
      release: async () => undefined,
      releaseAtRisk: async () => undefined,
      checkpoint: async () => {
        throw new Error('Unexpected checkpoint in mock barrier');
      },
      save: async () => held,
    };
    const controller = new PersistenceController(opened, port);
    const value = {
      version: first.version,
      source: opened.source,
      sourceSha256: hash,
      draftMetadata: {},
    };
    controller.changed(value);
    const saving = controller.save(value);
    state = apply(
      state,
      state.tr.insertText('x', position(state, 2, 23)),
    ).state;
    expect(currentVersion(state)).toBe(2);
    expect(controller.state.liveVersion).toBe(1); // New hash/capture is deliberately still pending.
    finish({
      identity: opened.identity,
      version: 1,
      sourceSha256: hash,
      fingerprint: opened.fingerprint,
      protection: 'sourceFile',
      recovery: {
        identity: opened.identity,
        version: 1,
        sourceSha256: hash,
        generation: 1,
        protection: 'recoveryCheckpoint',
      },
    });
    await saving;
    expect(currentVersion(state)).toBeGreaterThan(
      controller.state.fileSavedVersion,
    );
    expect(controller.state.fileSavedVersion).toBe(1);
    const next = snapshot(state);
    controller.changed({
      version: next.version,
      source: Array.from(next.source),
      sourceSha256: createHash('sha256').update(next.source).digest('hex'),
      draftMetadata: {},
    });
    expect(controller.state.liveVersion).toBe(2);
    expect(controller.state.fileSavedVersion).toBe(1);
  });
});
