import { afterEach, describe, expect, it } from 'vitest';
import { undo, redo, undoDepth } from 'prosemirror-history';
import { TextSelection } from 'prosemirror-state';
import {
  createEditorState,
  applyEditorTransaction,
} from '../../src/editor/state';
import { mountScreenplayEditor } from '../../src/editor/view';
import { captureEditor } from '../../src/editor/sourceBridge';
import {
  correctSpelling,
  highlightSpelling,
} from '../../src/editor/spellcheck';
import {
  spellingScan,
  SpellcheckController,
  type SpellcheckReply,
  type SpellcheckPort,
} from '../../src/application/spellcheck';
import type { EditorView } from 'prosemirror-view';
let view: EditorView | null = null;
afterEach(() => {
  view?.destroy();
  view = null;
  document.body.replaceChildren();
});
const source =
  '\ufeff!Zoë reads ***helllo*** beside 👩🏽‍🚀 é and שלום.  \r\n\r\n@ZORVEXIA (V.O.)\r\nZorvexia meets Quorvexia.\r\n\r\n[[helllo]]\r\n/* helllo */\r\n';
const bytes = (state: ReturnType<typeof createEditorState>) =>
  new TextDecoder('utf-8', { ignoreBOM: true }).decode(
    captureEditor(state).source,
  );
function open(text = source) {
  const host = document.createElement('div');
  document.body.append(host);
  view = mountScreenplayEditor(
    host,
    createEditorState(new TextEncoder().encode(text)),
  );
  view.setProps({ handleScrollToSelection: () => true });
  return view;
}
const status: SpellcheckReply = {
  enabled: true,
  language: 'en_US',
  languages: ['en_US'],
  available: true,
  needsAttention: false,
  resource: 'mock dictionary',
  addedCount: 0,
  ignoredCount: 0,
  correct: [],
  suggestions: [],
};
const port: SpellcheckPort = {
  request: async (request) => ({
    ...status,
    correct: (request.words ?? []).map((word) => word !== 'helllo'),
    suggestions: request.action === 'suggest' ? ['hello'] : [],
  }),
};

describe('offline spelling contracts (injected dictionary, no native verification)', () => {
  it('skips established case-insensitive cue tokens/extensions and excluded regions without pollution', () => {
    const current = open();
    const before = current.state;
    const scan = spellingScan(current.state);
    expect(scan.words.filter((w) => w.word === 'helllo')).toHaveLength(1);
    expect(scan.words.some((w) => /zorvexia/i.test(w.word))).toBe(false);
    expect(scan.words.some((w) => w.word === 'Quorvexia')).toBe(true);
    highlightSpelling(
      current,
      scan,
      scan.words.filter((w) => w.word === 'helllo'),
    );
    expect(current.dom.querySelector('.spelling-issue')?.textContent).toBe(
      'helllo',
    );
    expect(current.state).toBe(before);
    expect(bytes(current.state)).toBe(source);
    expect(undoDepth(current.state)).toBe(0);
    expect(current.dom.getAttribute('spellcheck')).toBe('false');
  });
  it('preserves exact BOM/CRLF/whitespace/origin/marks and selection with isolated Undo/Redo', () => {
    const current = open();
    const scan = spellingScan(current.state);
    const word = scan.words.find((w) => w.word === 'helllo')!;
    const before = current.state;
    const tr = correctSpelling(before, scan, word, 'hello');
    current.dispatch(tr);
    expect(bytes(current.state)).toBe(source.replace('helllo', 'hello'));
    expect(
      current.state.doc
        .child(0)
        .child(1)
        .marks.map((m) => m.type.name),
    ).toEqual(['bold', 'italic']);
    expect(current.state.doc.child(0).attrs).toEqual(before.doc.child(0).attrs);
    expect(current.state.selection.head).toBe(word.from + 5);
    expect(undo(current.state, current.dispatch)).toBe(true);
    expect(bytes(current.state)).toBe(source);
    expect(current.state.selection.eq(before.selection)).toBe(true);
    expect(undo(current.state)).toBe(false);
    expect(redo(current.state, current.dispatch)).toBe(true);
    expect(bytes(current.state)).toBe(source.replace('helllo', 'hello'));
  });
  it('rejects stale, foreign, hostile, protected and mixed-emphasis correction ranges', () => {
    const current = open();
    const scan = spellingScan(current.state);
    const word = scan.words.find((w) => w.word === 'helllo')!;
    expect(() =>
      correctSpelling(current.state, scan, { ...word }, 'hello'),
    ).toThrow('stale');
    for (const text of ['../bad', 'two words', 'x\n', 'a\0', '\ud800'])
      expect(() => correctSpelling(current.state, scan, word, text)).toThrow();
    current.dispatch(
      current.state.tr.setSelection(TextSelection.create(current.state.doc, 2)),
    );
    expect(() => correctSpelling(current!.state, scan, word, 'hello')).toThrow(
      'stale',
    );
    expect(bytes(current.state)).toBe(source);
    const mixed = createEditorState(new TextEncoder().encode('!hel**llo**\n'));
    const mixedScan = spellingScan(mixed);
    expect(() =>
      correctSpelling(mixed, mixedScan, mixedScan.words[0]!, 'hello'),
    ).toThrow('different emphasis');
    const hidden = createEditorState(
      new TextEncoder().encode('/* helllo */\n'),
    );
    const hscan = {
      ...spellingScan(hidden),
      words: [{ word: 'helllo', row: 0, from: 4, to: 10 }],
    };
    expect(() =>
      correctSpelling(hidden, hscan, hscan.words[0]!, 'hello'),
    ).toThrow('Protected');
  });
  it('clears stale async checks and keeps one bounded request when editor changes', async () => {
    const current = open();
    let resolve!: (reply: SpellcheckReply) => void;
    const requests: string[] = [];
    const slow: SpellcheckPort = {
      request: (req) => {
        requests.push(req.action);
        return req.action === 'status'
          ? Promise.resolve(status)
          : new Promise((r) => {
              resolve = r;
            });
      },
    };
    const controller = new SpellcheckController(
      slow,
      () => current,
      () => false,
      () => {},
    );
    await controller.load();
    const checking = controller.check();
    await controller.check();
    expect(requests).toEqual(['status', 'check']);
    current.dispatch(current.state.tr.insertText('x', 2));
    controller.invalidate();
    resolve({
      ...status,
      correct: spellingScan(
        createEditorState(new TextEncoder().encode(source)),
      ).words.map(() => false),
    });
    await checking;
    expect(controller.state.scan).toBeNull();
    expect(controller.state.issues).toEqual([]);
    expect(controller.state.busy).toBe(false);
    controller.dispose();
  });
  it('guards composition/protection/stale suggestions and never edits on dictionary failures', async () => {
    const current = open();
    let blocked = false;
    const controller = new SpellcheckController(
      port,
      () => current,
      () => blocked,
      () => {},
    );
    await controller.load();
    await controller.check();
    await controller.choose(controller.state.issues[0]!);
    const before = current.state;
    blocked = true;
    expect(controller.correct('hello')).toBe(false);
    blocked = false;
    Object.defineProperty(current, 'composing', {
      configurable: true,
      get: () => true,
    });
    expect(controller.correct('hello')).toBe(false);
    Object.defineProperty(current, 'composing', {
      configurable: true,
      get: () => false,
    });
    expect(current.state).toBe(before);
    controller.invalidate();
    expect(controller.correct('hello')).toBe(false);
    controller.dispose();
    const failing = new SpellcheckController(
      {
        request: async () => {
          throw new Error('disk failure');
        },
      },
      () => current,
      () => false,
      () => {},
    );
    await failing.load();
    expect(failing.state.message).toContain('Writing and saving');
    expect(bytes(current.state)).toBe(source);
    failing.dispose();
  });
  it('keeps Ignore/Add and Off out of source/selection/Undo and respects failed Add', async () => {
    const current = open();
    const before = current.state;
    const controller = new SpellcheckController(
      {
        request: async (request) => {
          if (request.action === 'add') throw new Error('read-only storage');
          return {
            ...(await port.request(request)),
            enabled: request.enabled ?? true,
          };
        },
      },
      () => current,
      () => false,
      () => {},
    );
    await controller.load();
    await controller.check();
    await controller.choose(controller.state.issues[0]!);
    await controller.vocabulary('add');
    expect(controller.state.message).toContain('could not be confirmed');
    expect(controller.state.issues).toHaveLength(1);
    await controller.vocabulary('ignore');
    expect(controller.state.issues).toEqual([]);
    expect(controller.state.message).toContain('Restart clears');
    await controller.configure('en_US', false);
    expect(controller.state.status?.enabled).toBe(false);
    expect(current.state).toBe(before);
    expect(bytes(current.state)).toBe(source);
    expect(undoDepth(current.state)).toBe(0);
    controller.dispose();
  });
  it('loads read-only dictionary status during a protected workflow and permits checking after release', async () => {
    const current = open();
    let blocked = true;
    const controller = new SpellcheckController(
      port,
      () => current,
      () => blocked,
      () => {},
    );
    await controller.load();
    expect(controller.state.status?.available).toBe(true);
    await controller.check();
    expect(controller.state.scan).toBeNull();
    blocked = false;
    await controller.check();
    expect(controller.state.issues).toHaveLength(1);
    controller.dispose();
  });
  it('clears earlier language results when resources/preferences are reloaded', async () => {
    const current = open();
    let missing = false;
    const controller = new SpellcheckController(
      {
        request: async (request) =>
          missing
            ? { ...status, language: 'zz_ZZ', available: false }
            : port.request(request),
      },
      () => current,
      () => false,
      () => {},
    );
    await controller.load();
    await controller.check();
    await controller.choose(controller.state.issues[0]!);
    missing = true;
    await controller.load();
    expect(controller.state.scan).toBeNull();
    expect(controller.state.active).toBeNull();
    expect(controller.correct('hello')).toBe(false);
    expect(bytes(current.state)).toBe(source);
    controller.dispose();
  });
  it('preserves save representability when a correction cannot round-trip', () => {
    const state = createEditorState(
      new TextEncoder().encode('@NAME\nhelllo\n'),
    );
    const scan = spellingScan(state);
    const word = scan.words[0]!;
    const trial = applyEditorTransaction(
      state,
      correctSpelling(state, scan, word, 'hello'),
    );
    expect(trial.accepted).toBe(true);
    expect(bytes(trial.state)).toBe('@NAME\nhello\n');
  });
});
