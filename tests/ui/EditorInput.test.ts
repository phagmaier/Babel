import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { createEditorState } from '../../src/editor/state';
import { mountScreenplayEditor } from '../../src/editor/view';
import { captureEditor } from '../../src/editor/sourceBridge';
import { localShortcutRegistry } from '../../src/application/shortcuts';
import { FountainImportBoundary } from '../../src/application/fountainImport';
import { EditorCaptureBoundary } from '../../src/application/editorCapture';
import { createFountainImportPanel } from '../../src/app/FountainImportPanel';
import { clipboardMime } from '../../src/editor/clipboard';
const original = '\n@MAYA\nHello world.\n';
import type {
  WorkflowProtectionPort,
  WorkflowProtectionReceipt,
} from '../../src/application/workflowProtection';
import {
  WritingSession,
  type SessionPorts,
} from '../../src/application/writingSession';
import { workflowView } from '../workflowView';
const sessions: WritingSession[] = [];
const identity = {
  handle: 'synthetic',
  documentId: 'document',
  sessionId: 'session',
};
const encoder = new TextEncoder();
let view: EditorView;
afterEach(() => {
  for (const session of sessions.splice(0)) session.dispose();
  vi.restoreAllMocks();
  view?.destroy();
  document.body.replaceChildren();
});
function mount() {
  const parent = document.createElement('div');
  document.body.append(parent);
  const refused = vi.fn();
  view = mountScreenplayEditor(
    parent,
    createEditorState(encoder.encode(original)),
    { shortcuts: localShortcutRegistry('other'), refused },
  );
  const p =
    1 + view.state.doc.child(0).nodeSize + view.state.doc.child(1).nodeSize + 6;
  view.dispatch(
    view.state.tr.setSelection(TextSelection.create(view.state.doc, p, p + 5)),
  );
  return refused;
}
const read = () => new TextDecoder().decode(captureEditor(view.state).source);
function clipboard(kind: string, entries: Record<string, string>) {
  const event = new Event(kind, { bubbles: true, cancelable: true });
  const data = {
    getData: (type: string) => entries[type] ?? '',
    setData: (type: string, value: string) => {
      entries[type] = value;
    },
  };
  Object.defineProperty(event, 'clipboardData', { value: data });
  view.dom.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  return entries;
}
function key(k: string, shift = false) {
  view.dom.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: k,
      ctrlKey: true,
      shiftKey: shift,
      bubbles: true,
      cancelable: true,
    }),
  );
}
function capture() {
  return new EditorCaptureBoundary(() => view.state, {
    defer: async () => {},
    hash: async (bytes) => createHash('sha256').update(bytes).digest('hex'),
  });
}
const protect: WorkflowProtectionPort['protect'] = async ({
  operation,
  checkpoint: req,
}) => ({
  operation,
  byteLength: req.source.length,
  checkpoint: {
    identity: req.identity,
    version: req.version,
    sourceSha256: req.sourceSha256,
    generation: 1,
    protection: 'recoveryCheckpoint',
  },
  revision: {
    documentId: req.identity.documentId,
    version: req.version,
    sourceSha256: req.sourceSha256,
    profileSha256: 'a'.repeat(64),
    commitId: 'b'.repeat(40),
    changed: true,
    safetyRef: `refs/safety/${'b'.repeat(40)}`,
  },
});
function boundary(port: WorkflowProtectionPort = { protect }) {
  const unavailable = async () => {
    throw new Error('unused fixture operation');
  };
  const ports: SessionPorts = {
    workflows: port,
    documents: {
      release: unavailable,
      releaseAtRisk: unavailable,
      checkpoint: async (request) =>
        (await protect({ operation: 'fountainImport', checkpoint: request }))
          .checkpoint,
      save: unavailable,
    },
    entry: {
      createUnsaved: unavailable,
      openViaPicker: unavailable,
      selectDestination: unavailable,
    },
    saveAs: { selectDestination: unavailable, saveAs: unavailable },
    snapshots: {
      list: unavailable,
      read: unavailable,
      create: unavailable,
      prune: unavailable,
      restore: unavailable,
      copy: unavailable,
    },
  };
  const session = new WritingSession(
    ports,
    workflowView(() => view, capture()),
  );
  sessions.push(session);
  const ready = session.openSelected(async () => ({
    identity,
    kind: 'unsaved',
    persistentIdentity: false,
    ownership: { status: 'exclusive', reasons: [] },
    encoding: 'utf8',
    source: [...encoder.encode(original)],
    fingerprint: null,
  }));
  return new FountainImportBoundary(
    () => view,
    async (apply, signal) => {
      await ready;
      return session.runProtectedWorkflow('fountainImport', apply, signal);
    },
  );
}

describe('production view clipboard and registry (synthetic DOM, no native input)', () => {
  it('copies and cuts rich content and restores selection with one undo', () => {
    mount();
    key('b');
    const data = clipboard('copy', {});
    expect(data['text/plain']).toBe('world');
    expect(data[clipboardMime]).toContain('bold');
    clipboard('cut', {});
    expect(read()).toBe('\n@MAYA\nHello .\n');
    key('z');
    expect(read()).toBe('\n@MAYA\nHello **world**.\n');
    key('z');
    expect(read()).toBe(original);
  });
  it('pastes literal multiline Dialogue and undoes/redoes exactly', () => {
    mount();
    clipboard('paste', { 'text/plain': 'INT. LAB - NIGHT\nשלום é 👩🏽‍🚀' });
    expect(read()).toBe('\n@MAYA\nHello INT. LAB - NIGHT\nשלום é 👩🏽‍🚀.\n');
    key('z');
    expect(read()).toBe(original);
    key('z', true);
    expect(read()).toContain('שלום é 👩🏽‍🚀');
  });
  it('removes hostile HTML nodes and attributes before privileged editor insertion', () => {
    mount();
    clipboard('paste', {
      'text/html':
        '<p onmouseover="globalThis.owned=1">safe<img src="https://invalid.example/a" onerror="owned=2"></p><script>owned=3</script>',
    });
    expect(read()).toBe('\n@MAYA\nHello safe.\n');
    expect(view.dom.querySelector('img,script,[onmouseover],[src]')).toBeNull();
    expect((globalThis as { owned?: number }).owned).toBeUndefined();
  });
  it('refuses composition paste and unsafe literal grammar atomically', () => {
    const refused = mount();
    clipboard('paste', { 'text/plain': '\n@OTHER' });
    expect(read()).toBe(original);
    expect(refused).toHaveBeenCalled();
    view.dom.dispatchEvent(
      new CompositionEvent('compositionstart', { bubbles: true }),
    );
    clipboard('paste', { 'text/plain': 'new' });
    expect(read()).toBe(original);
    expect(refused).toHaveBeenLastCalledWith(
      'Paste waits until composition finishes',
    );
    view.dom.dispatchEvent(
      new CompositionEvent('compositionend', { bubbles: true }),
    );
  });
  it('refuses whitespace-only emphasis without losing selection', () => {
    const refused = mount();
    const p = view.state.selection.from - 1;
    view.dispatch(
      view.state.tr.setSelection(
        TextSelection.create(view.state.doc, p, p + 1),
      ),
    );
    key('b');
    expect(read()).toBe(original);
    expect(refused).toHaveBeenCalled();
  });
});

describe('explicit protected Fountain import (mocked port)', () => {
  it('acknowledges exact pre-import capture and imports one undo with exact prior source/selection', async () => {
    mount();
    const before = view.state.selection;
    const port = { protect: vi.fn(protect) };
    const result = await boundary(port).import(
      encoder.encode('\ufeffTitle: Import\r\n\r\n!New\r\n'),
    );
    expect(result.status).toBe('imported');
    expect(port.protect).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'fountainImport',
        checkpoint: expect.objectContaining({
          source: [...encoder.encode(original)],
        }),
      }),
    );
    expect(read()).toBe('Title: Import\r\n\r\n!New\r\n');
    key('z');
    expect(read()).toBe(original);
    expect(view.state.selection.eq(before)).toBe(true);
    key('z', true);
    expect(read()).toContain('!New\r\n');
  });
  it.each(['checkpoint', 'revision', 'history', 'operation', 'length'])(
    'refuses wrong %s protection and keeps both manuscripts',
    async (field) => {
      mount();
      const port = {
        protect: async (req) => {
          if (field === 'history') throw new Error('history unavailable');
          const r = await protect(req);
          if (field === 'checkpoint') r.checkpoint.version++;
          else if (field === 'operation') r.operation = 'sceneMove';
          else if (field === 'length') r.byteLength++;
          else r.revision.safetyRef = null;
          return r;
        },
      } satisfies WorkflowProtectionPort;
      const result = await boundary(port).import(encoder.encode('!New\n'));
      expect(result.status).toBe('refused');
      expect(read()).toBe(original);
    },
  );
  it('preserves the live coordinator failure message and both manuscripts', async () => {
    mount();
    const result = await boundary({
      protect: async () => {
        throw new Error('private path: untrusted transport details');
      },
    }).import(encoder.encode('!New\n'));
    expect(result).toEqual({
      status: 'refused',
      reason: 'private path: untrusted transport details',
    });
    expect(read()).toBe(original);
  });
  it.each(['text', 'selection', 'composition'])(
    'refuses %s changes after protection and concurrent imports',
    async (change) => {
      mount();
      let finish!: (r: WorkflowProtectionReceipt) => void;
      let request!: Parameters<WorkflowProtectionPort['protect']>[0];
      const b = boundary({
        protect: async (r) => {
          request = r;
          return new Promise((resolve) => {
            finish = resolve;
          });
        },
      });
      const pending = b.import(encoder.encode('!New\n'));
      await vi.waitFor(() => expect(finish).toBeDefined());
      expect((await b.import(encoder.encode('!Else\n'))).status).toBe(
        'refused',
      );
      if (change === 'text') view.dispatch(view.state.tr.insertText('changed'));
      else if (change === 'selection')
        view.dispatch(
          view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)),
        );
      else vi.spyOn(view, 'composing', 'get').mockReturnValue(true);
      finish(await protect(request));
      expect((await pending).status).toBe('refused');
      expect(read()).toBe(
        change === 'text' ? '\n@MAYA\nHello changed.\n' : original,
      );
    },
  );
  it('keeps staged panel content after failures and success; explicit action states whole replacement', async () => {
    mount();
    const panel = createFountainImportPanel(document.body, boundary());
    panel.input.value = '!New\n';
    panel.button.click();
    await vi.waitFor(() => expect(panel.button.disabled).toBe(false));
    expect(panel.status.textContent).toContain('Previous draft protected');
    expect(panel.input.value).toBe('!New\n');
    key('z');
    expect(read()).toBe(original);
    panel.destroy();
  });
});
