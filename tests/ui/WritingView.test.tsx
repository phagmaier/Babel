import { TextSelection } from 'prosemirror-state';
/** M3-12 writing surface: open/edit/save/close flows with injected ports. */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { WritingView, type WritingPorts } from '../../src/app/WritingView';
import * as editorMount from '../../src/editor/view';
import { captureEditor } from '../../src/editor/sourceBridge';
import { editorVersion } from '../../src/editor/state';
import { SaveCadence } from '../../src/application/saveCadence';
import { ProtectedClose } from '../../src/application/protectedClose';
import { undoDepth } from 'prosemirror-history';
import type { OpenDocument } from '../../src/application/documents';
import { deferred, publicationResult } from '../publicationFixture';
import {
  A,
  B,
  fingerprint,
  identity,
  opened,
  receiptFor,
  receipt,
} from '../contract/persistence-fixtures';

vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: vi.fn() }));

const originalRangeLayout = ['getClientRects', 'getBoundingClientRect'].map(
  (name) =>
    [name, Object.getOwnPropertyDescriptor(Range.prototype, name)] as const,
);
beforeEach(() => {
  // JSDOM supplies no Range layout. These stubs admit focus/scroll routing only;
  // real caret visibility and sticky geometry remain default-WebKit native gates.
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value: () => [],
  });
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(),
  });
  vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  window.localStorage.removeItem('babel.positions.v1');
  vi.restoreAllMocks();
  for (const [name, descriptor] of originalRangeLayout) {
    if (descriptor) Object.defineProperty(Range.prototype, name, descriptor);
    else Reflect.deleteProperty(Range.prototype, name);
  }
});

function unsaved(): OpenDocument {
  return {
    ...opened(),
    kind: 'unsaved',
    persistentIdentity: false,
    fingerprint: null,
    source: [],
  };
}

it('waits for recovery discovery before allowing opened-file typing', async () => {
  const { ports } = fixturePorts({ picked: opened() });
  const entry = await ports.recovery.inspect(identity);
  const discovery =
    deferred<Awaited<ReturnType<typeof ports.recovery.inspect>>>();
  let inspections = 0;
  ports.recovery.inspect = async () =>
    ++inspections === 1 ? entry : discovery.promise;
  render(
    <WritingView
      ports={ports}
      open={{ kind: 'picked' }}
      onSessionClosed={vi.fn()}
    />,
  );
  const editor = await screen.findByRole('textbox', {
    name: 'Screenplay text',
  });
  await waitFor(() => expect(inspections).toBe(2));
  await waitFor(() =>
    expect(editor.getAttribute('contenteditable')).toBe('false'),
  );
  discovery.resolve({
    documentId: identity.documentId,
    candidates: [],
    notices: [],
    error: null,
  });
  await waitFor(() =>
    expect(editor.getAttribute('contenteditable')).toBe('true'),
  );
});

it('keeps divergent recovery read-only until Keep completes', async () => {
  const { ports } = fixturePorts({ picked: opened(), candidates: true });
  const views: ReturnType<typeof editorMount.mountScreenplayEditor>[] = [];
  const mount = editorMount.mountScreenplayEditor;
  vi.spyOn(editorMount, 'mountScreenplayEditor').mockImplementation(
    (...args) => {
      const view = mount(...args);
      views.push(view);
      return view;
    },
  );
  const keeping = deferred<Awaited<ReturnType<typeof ports.choices.keep>>>();
  ports.choices.keep = () => keeping.promise;
  render(
    <WritingView
      ports={ports}
      open={{ kind: 'picked' }}
      onSessionClosed={vi.fn()}
    />,
  );
  const keep = await screen.findByRole('button', { name: 'Keep saved file' });
  const editor = screen.getByRole('textbox', { name: 'Screenplay text' });
  expect(editor.getAttribute('contenteditable')).toBe('false');
  const selection = views[0]!.state.selection.toJSON();
  keep.focus();
  fireEvent.click(keep);
  expect(editor.getAttribute('contenteditable')).toBe('false');
  keeping.resolve(
    await ports.choices.compare({
      identity,
      selection: (await ports.recovery.inspect(identity)).candidates[0]!
        .selection,
    }),
  );
  await waitFor(() =>
    expect(editor.getAttribute('contenteditable')).toBe('true'),
  );
  expect(views[0]!.hasFocus()).toBe(true);
  expect(views[0]!.state.selection.toJSON()).toEqual(selection);
});

it('retains read-only review after Keep fails and after Inspect later', async () => {
  const { ports } = fixturePorts({ picked: opened(), candidates: true });
  ports.choices.keep = async () => {
    throw { code: 'io' };
  };
  render(
    <WritingView
      ports={ports}
      open={{ kind: 'picked' }}
      onSessionClosed={vi.fn()}
    />,
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Keep saved file' }),
  );
  await screen.findByText(/Keep did not complete/);
  const editor = screen.getByRole('textbox', { name: 'Screenplay text' });
  expect(editor.getAttribute('contenteditable')).toBe('false');
  fireEvent.click(screen.getByRole('button', { name: 'Inspect later' }));
  expect(document.activeElement).toBe(editor);
  expect(editor.getAttribute('contenteditable')).toBe('false');
  expect(
    screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled'),
  ).toBe(true);
});

it('exporting a copy leaves unresolved recovery read-only', async () => {
  const { ports } = fixturePorts({ picked: opened(), candidates: true });
  ports.entry.selectDestination = async () => ({
    token: 'copy',
    fileName: 'emergency.fountain',
    storageRelation: 'unknownPhysicalDisk',
  });
  const copy = vi.spyOn(ports.snapshots, 'copy');
  render(
    <WritingView
      ports={ports}
      open={{ kind: 'picked' }}
      onSessionClosed={vi.fn()}
    />,
  );
  await screen.findByRole('button', { name: 'Keep saved file' });
  fireEvent.click(
    within(screen.getByLabelText('Screenplay actions')).getByRole('button', {
      name: 'Export Fountain copy',
    }),
  );
  await waitFor(() => expect(copy).toHaveBeenCalledOnce());
  await waitFor(() =>
    expect(
      screen
        .getByRole('button', { name: 'Export Fountain copy' })
        .hasAttribute('disabled'),
    ).toBe(false),
  );
  expect(
    screen
      .getByRole('textbox', { name: 'Screenplay text' })
      .getAttribute('contenteditable'),
  ).toBe('false');
  expect(
    screen.getByText(/Choose which draft to use before editing\./),
  ).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled'),
  ).toBe(true);
});

it('keeps title-page authorship disabled during unresolved recovery review', async () => {
  const { ports } = fixturePorts({ picked: opened(), candidates: true });
  render(
    <WritingView
      ports={ports}
      open={{ kind: 'picked' }}
      onSessionClosed={vi.fn()}
    />,
  );
  await screen.findByRole('button', { name: 'Keep saved file' });
  fireEvent.click(
    within(screen.getByLabelText('Screenplay actions')).getByRole('button', {
      name: 'Title page',
    }),
  );
  expect(
    screen.queryByRole('button', { name: 'Import Fountain as screenplay' }),
  ).toBeNull();
  const add = await screen.findByRole('button', { name: 'Add field' });
  await waitFor(() => expect(add.hasAttribute('disabled')).toBe(true));
  expect(
    screen
      .getByRole('textbox', { name: 'Screenplay text' })
      .getAttribute('contenteditable'),
  ).toBe('false');
});

it('keeps discovery failures read-only without hiding Home', async () => {
  const { ports } = fixturePorts({ picked: opened() });
  const inspect = ports.recovery.inspect;
  let calls = 0;
  ports.recovery.inspect = async (id) => {
    if (++calls > 1) throw { code: 'io' };
    return inspect(id);
  };
  render(
    <WritingView
      ports={ports}
      open={{ kind: 'picked' }}
      onSessionClosed={vi.fn()}
    />,
  );
  await screen.findByText(/Recovery review is unavailable/);
  expect(
    screen
      .getByRole('textbox', { name: 'Screenplay text' })
      .getAttribute('contenteditable'),
  ).toBe('false');
  expect(
    screen.getByRole('button', { name: 'Home' }).hasAttribute('disabled'),
  ).toBe(false);
});

it.each([false, true])(
  'returns deferred preview focus unless the writer chooses newer focus (%s)',
  async (newerFocus) => {
    const { ports } = fixturePorts({ picked: opened() });
    const pending = deferred<void>();
    ports.documents.save = vi.fn(async (request) => {
      await pending.promise;
      return receiptFor(request.version, request.sourceSha256 === B);
    });
    ports.publication = {
      render: async (request) => publicationResult(request),
      read: async () => new Uint8Array(),
      cancel: async () => {},
    };
    render(
      <WritingView
        ports={ports}
        open={{ kind: 'picked' }}
        onSessionClosed={vi.fn()}
      />,
    );
    const actions = await screen.findByLabelText('Screenplay actions');
    const preview = within(actions).getByRole('button', {
      name: 'PDF preview',
    });
    await waitFor(() => expect(preview.hasAttribute('disabled')).toBe(false));
    fireEvent.click(preview);
    const close = await screen.findByRole('button', {
      name: 'Close PDF preview',
    });
    fireEvent.click(within(actions).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(ports.documents.save).toHaveBeenCalled());
    expect(preview.hasAttribute('disabled')).toBe(true);
    close.focus();
    fireEvent.click(close);
    expect(
      screen.queryByRole('button', { name: 'Close PDF preview' }),
    ).toBeNull();
    const editor = document.querySelector<HTMLElement>('.ProseMirror')!;
    if (newerFocus) editor.focus();
    pending.resolve();
    await waitFor(() => expect(preview.hasAttribute('disabled')).toBe(false));
    await waitFor(() =>
      expect(document.activeElement).toBe(newerFocus ? editor : preview),
    );
  },
);

function fixturePorts(options: {
  picked?: OpenDocument | null;
  recoveredVersion?: number;
  candidates?: boolean;
}): {
  ports: WritingPorts;
  calls: { checkpoint: number; saved: number[]; released: number };
} {
  const calls = { checkpoint: 0, saved: [] as number[], released: 0 };
  const picked = options.picked ?? null;
  const ports: WritingPorts = {
    entry: {
      createUnsaved: async () => unsaved(),
      openViaPicker: async () => picked,
      selectDestination: async () => null,
    },
    documents: {
      release: async () => {
        calls.released += 1;
      },
      releaseAtRisk: async () => undefined,
      checkpoint: async (request) => {
        calls.checkpoint += 1;
        return {
          identity: { ...request.identity },
          version: request.version,
          sourceSha256: request.sourceSha256,
          generation: request.version,
          protection: 'recoveryCheckpoint' as const,
        };
      },
      save: async (request) => {
        calls.saved.push(request.version);
        return receiptFor(request.version, request.sourceSha256 === B);
      },
    },
    saveAs: {
      selectDestination: async () => null,
      saveAs: async () => {
        throw new Error('unreachable');
      },
    },
    snapshots: {
      list: async () => ({
        entries: [],
        sourceBytes: 0,
        needsAttention: false,
        unresolvedArtifacts: 0,
        orphanBlobs: 0,
        atLimit: false,
      }),
      read: async () => {
        throw new Error('unreachable');
      },
      create: async ({ checkpoint, kind, name }) => ({
        selection: {
          snapshotId: '44444444-4444-4444-8444-444444444444',
          recordSha256: checkpoint.sourceSha256,
        },
        record: {
          schemaVersion: 1,
          snapshotId: '44444444-4444-4444-8444-444444444444',
          documentId: checkpoint.identity.documentId,
          sessionId: checkpoint.identity.sessionId,
          version: checkpoint.version,
          sourceSha256: checkpoint.sourceSha256,
          byteLength: checkpoint.source.length,
          createdSeconds: 1,
          kind,
          name,
        },
      }),
      prune: async () => ({
        entries: [],
        sourceBytes: 0,
        needsAttention: false,
        unresolvedArtifacts: 0,
        orphanBlobs: 0,
        atLimit: false,
      }),
      restore: async () => {
        throw new Error('unreachable');
      },
      copy: async ({ checkpoint }) => ({
        identity: { ...checkpoint.identity },
        version: checkpoint.version,
        sourceSha256: checkpoint.sourceSha256,
        byteLength: checkpoint.source.length,
        fileName: 'emergency.fountain',
        storageRelation: 'unknownPhysicalDisk' as const,
      }),
    },
    choices: {
      compare: async ({ selection }) => ({
        identity: { ...identity },
        selection,
        recovery: {
          selection,
          sessionId: 'other-session',
          version: 1,
          generation: 1,
          sourceSha256: B,
          byteLength: 1,
          encoding: 'utf8' as const,
        },
        source: {
          status: 'current' as const,
          fingerprint: fingerprint(),
          sourceSha256: A,
          byteLength: 1,
          encoding: 'utf8' as const,
        },
        identical: false,
        externalDivergence: false,
        transaction: 'noTransaction' as const,
      }),
      recover: async (request) => receiptFor(request.newVersion, true),
      keep: async () => {
        throw new Error('unreachable');
      },
      copy: async () => {
        throw new Error('unreachable');
      },
      resolve: async () => {
        throw new Error('unreachable');
      },
    },
    recovery: {
      inspect: async () => ({
        documentId: identity.documentId,
        candidates: options.candidates
          ? [
              {
                selection: {
                  documentId: identity.documentId,
                  origin: 'current' as const,
                  recordSha256: A,
                },
                sessionId: 'other-session',
                version: 1,
                generation: 1,
                sourceSha256: B,
                byteLength: 1,
                encoding: 'utf8' as const,
              },
            ]
          : [],
        notices: [],
        error: null,
      }),
      previewSelected: async ({ selection }) =>
        ports.recovery.preview(selection),
      resume: async () => {
        throw new Error('unreachable');
      },
      list: async () => ({
        entries: options.candidates
          ? [
              {
                documentId: identity.documentId,
                candidates: [
                  {
                    selection: {
                      documentId: identity.documentId,
                      origin: 'current' as const,
                      recordSha256: A,
                    },
                    sessionId: 'other-session',
                    version: 1,
                    generation: 1,
                    sourceSha256: B,
                    byteLength: 1,
                    encoding: 'utf8' as const,
                  },
                ],
                notices: [],
                error: null,
              },
            ]
          : [],
        truncated: false,
        unrecognizedArtifacts: 0,
      }),
      preview: async (selection) => ({
        candidate: {
          selection,
          sessionId: 'other-session',
          version: 1,
          generation: 1,
          sourceSha256: B,
          byteLength: 1,
          encoding: 'utf8' as const,
        },
        metadata: {
          documentId: identity.documentId,
          sessionId: 'other-session',
          version: 1,
          generation: 1,
          sourceSha256: B,
          baseFingerprint: fingerprint(),
          draftMetadata: {},
        },
        source: [98],
      }),
    },
    workflows: {
      protect: async () => {
        throw new Error('unreachable');
      },
    },
  };
  void options.recoveredVersion;
  return { ports, calls };
}

describe('M3-12 writing surface', () => {
  it.each([false, true])(
    'drains recovery comparisons without concurrent native reservations (first fails: %s)',
    async (failFirst) => {
      const { ports } = fixturePorts({ picked: opened(), candidates: true });
      const entry = await ports.recovery.inspect(identity);
      ports.recovery.inspect = async () => ({
        ...entry,
        candidates: Array.from({ length: 3 }, (_, index) => ({
          ...entry.candidates[0]!,
          selection: {
            ...entry.candidates[0]!.selection,
            recordSha256: String(index + 1).repeat(64),
          },
        })),
      });
      const compare = ports.choices.compare;
      let inFlight = false;
      let requests = 0;
      ports.choices.compare = async (request) => {
        if (inFlight) throw { code: 'saveQueueFull' };
        inFlight = true;
        const first = requests++ === 0;
        await new Promise((resolve) => setTimeout(resolve, 10));
        try {
          if (first && failFirst) throw { code: 'recoveryNeedsAttention' };
          return await compare(request);
        } finally {
          inFlight = false;
        }
      };
      render(
        <WritingView
          ports={ports}
          open={{ kind: 'picked' }}
          onSessionClosed={vi.fn()}
        />,
      );
      await waitFor(() =>
        expect(
          screen.getAllByText('Recovery choice', { selector: 'h2' }),
        ).toHaveLength(failFirst ? 2 : 3),
      );
      expect(Boolean(screen.queryByText('Source comparison unavailable'))).toBe(
        failFirst,
      );
    },
  );

  it('opens a draft, protects it explicitly, and exposes separate protection facts', async () => {
    const { ports, calls } = fixturePorts({});
    const closed = vi.fn();
    render(
      <WritingView
        ports={ports}
        open={{ kind: 'new' }}
        onSessionClosed={closed}
      />,
    );
    const protect = await screen.findByRole('button', {
      name: 'Protect draft',
    });
    expect(protect instanceof HTMLButtonElement && protect.disabled).toBe(
      false,
    );
    const status = await screen.findByText(/Recovery: journaled/);
    const section = status.closest('section')!;
    for (const label of ['Recovery:', 'Source file:', 'Snapshots:']) {
      expect(section.textContent).toContain(label);
    }
    fireEvent.click(protect);
    await waitFor(() => expect(calls.checkpoint).toBeGreaterThan(0));
    expect(closed).not.toHaveBeenCalled();
  });

  it('keeps ProseMirror mounted across phase changes and status refreshes', async () => {
    const { ports } = fixturePorts({});
    const closed = vi.fn();
    render(
      <WritingView
        ports={ports}
        open={{ kind: 'new' }}
        onSessionClosed={closed}
      />,
    );
    await screen.findByRole('button', { name: 'Protect draft' });
    const host = screen.getByLabelText('Screenplay editor');
    const mounted = host.querySelector('.ProseMirror');
    expect(mounted).not.toBeNull();
    // Status refreshes (open completion, explicit save) must not remount it.
    const actions = screen.getByLabelText('Screenplay actions');
    fireEvent.click(
      within(actions).getByRole('button', { name: 'Protect draft' }),
    );
    await waitFor(() =>
      expect(host.querySelector('.ProseMirror')).toBe(mounted),
    );
    expect(mounted!.isConnected).toBe(true);
  });

  it('keeps the session on Save As cancellation', async () => {
    const { ports } = fixturePorts({});
    const closed = vi.fn();
    render(
      <WritingView
        ports={ports}
        open={{ kind: 'new' }}
        onSessionClosed={closed}
      />,
    );
    const actions = await screen.findByLabelText('Screenplay actions');
    await within(actions).findByRole('button', { name: 'Protect draft' });
    fireEvent.click(within(actions).getByRole('button', { name: 'Save As' }));
    await screen.findByText(
      'The native dialog was cancelled. Nothing changed.',
    );
    expect(closed).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Protect draft' })).toBeDefined();
  });

  it('closes an unsaved draft through the protected retry path', async () => {
    const { ports, calls } = fixturePorts({});
    const closed = vi.fn();
    render(
      <WritingView
        ports={ports}
        open={{ kind: 'new' }}
        onSessionClosed={closed}
      />,
    );
    const actions = await screen.findByLabelText('Screenplay actions');
    await within(actions).findByRole('button', { name: 'Protect draft' });
    fireEvent.click(
      within(actions).getByRole('button', { name: 'Close session' }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Close and keep recovery' }),
    );
    await waitFor(() => expect(closed).toHaveBeenCalled());
    expect(calls.checkpoint).toBeGreaterThan(0);
    expect(calls.released).toBe(1);
  });

  it('discovers managed recovery after open and adopts it into the editor', async () => {
    const { ports } = fixturePorts({ picked: opened(), candidates: true });
    const closed = vi.fn();
    render(
      <WritingView
        ports={ports}
        open={{ kind: 'picked' }}
        onSessionClosed={closed}
      />,
    );
    const actions = await screen.findByLabelText('Screenplay actions');
    await within(actions).findByRole('button', { name: 'Save' });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Restore recovered draft' }),
    );
    await screen.findByText(/Recovered as current, version 3/);
    await waitFor(() =>
      expect(screen.getByLabelText('Screenplay editor').textContent).toBe('b'),
    );
    expect(closed).not.toHaveBeenCalled();
  });

  it('replaces the outline with the exact recovered capture rather than retaining source headings', async () => {
    const source = new TextEncoder().encode('.INT. OLD - DAY\n!A.\n');
    const recovered = new TextEncoder().encode(
      '# Recovered\n.EXT. NEW é🚀 - NIGHT\n!B.\n',
    );
    const hash = (bytes: Uint8Array) =>
      createHash('sha256').update(bytes).digest('hex');
    const picked = {
      ...opened(),
      source: Array.from(source),
      fingerprint: {
        ...fingerprint(0, hash(source)),
        byteLength: source.length,
      },
    };
    const f = fixturePorts({ picked, candidates: true });
    const compare = f.ports.choices.compare;
    f.ports.choices.compare = async (request) => {
      const result = await compare(request);
      return {
        ...result,
        source: {
          ...result.source,
          fingerprint: picked.fingerprint,
          sourceSha256: hash(source),
          byteLength: source.length,
        },
        recovery: {
          ...result.recovery,
          sourceSha256: hash(recovered),
          byteLength: recovered.length,
        },
      };
    };
    const preview = f.ports.recovery.preview;
    f.ports.recovery.preview = async (selection) => {
      const result = await preview(selection);
      return {
        ...result,
        source: Array.from(recovered),
        candidate: {
          ...result.candidate,
          sourceSha256: hash(recovered),
          byteLength: recovered.length,
        },
        metadata: { ...result.metadata, sourceSha256: hash(recovered) },
      };
    };
    f.ports.choices.recover = async (request) => {
      const result = receipt({
        id: 1,
        protection: 'sourceFile',
        version: request.newVersion,
        sha256: hash(recovered),
        byteLength: recovered.length,
      });
      return {
        ...result,
        fingerprint: { ...result.fingerprint, byteLength: recovered.length },
      };
    };
    render(
      <WritingView
        ports={f.ports}
        open={{ kind: 'picked' }}
        onSessionClosed={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(
        (
          screen.getByRole('button', {
            name: 'Go to Scene 1: INT. OLD - DAY',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Restore recovered draft' }),
    );
    await screen.findByText(/Recovered as current/);
    await waitFor(() =>
      expect(
        (
          screen.getByRole('button', {
            name: 'Go to Scene 1: EXT. NEW é🚀 - NIGHT',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    expect(
      screen.queryByRole('button', { name: 'Go to Scene 1: INT. OLD - DAY' }),
    ).toBeNull();
    expect(screen.getByLabelText('Screenplay editor').textContent).toBe(
      'RecoveredEXT. NEW é🚀 - NIGHTB.',
    );
  });
  it('F6 reaches actions and close moves focus to the protected retry button', async () => {
    const { ports } = fixturePorts({});
    render(
      <WritingView
        ports={ports}
        open={{ kind: 'new' }}
        onSessionClosed={vi.fn()}
      />,
    );
    await screen.findByRole('button', { name: 'Protect draft' });
    const editor = screen
      .getByLabelText('Screenplay editor')
      .querySelector<HTMLElement>('.ProseMirror')!;
    editor.focus();
    fireEvent.keyDown(editor, { key: 'F6' });
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Protect draft' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close session' }));
    expect(document.activeElement).toBe(
      await screen.findByRole('button', { name: 'Close and keep recovery' }),
    );
  });

  it('AUDIT-NATIVE-R1 F6 prefers Save over earlier enabled source actions and returns', async () => {
    const { ports } = fixturePorts({ picked: opened() });
    ports.externalSource = {
      check: vi.fn(async () => ({
        identity,
        status: 'unchanged' as const,
        fingerprint: opened().fingerprint!,
        source: null,
      })),
      reload: vi.fn(),
    };
    render(
      <WritingView
        ports={ports}
        open={{ kind: 'picked' }}
        onSessionClosed={vi.fn()}
      />,
    );
    const save = await screen.findByRole('button', {
      name: 'Save',
    });
    await waitFor(() => expect(save.hasAttribute('disabled')).toBe(false));
    const check = screen.getByRole('button', {
      name: 'Check external changes',
    });
    expect(check.hasAttribute('disabled')).toBe(false);
    const editor = screen
      .getByLabelText('Screenplay editor')
      .querySelector<HTMLElement>('.ProseMirror')!;
    editor.focus();
    fireEvent.keyDown(editor, { key: 'F6' });
    expect(document.activeElement).toBe(save);
    fireEvent.keyDown(save, { key: 'F6' });
    expect(document.activeElement).toBe(editor);
  });

  it('refuses smart keys and element commands when native ownership is read-only', async () => {
    const { ports, calls } = fixturePorts({
      picked: {
        ...opened(),
        ownership: { status: 'viewOnly', reasons: ['alreadyOwned'] },
      },
    });
    render(
      <WritingView
        ports={ports}
        open={{ kind: 'picked' }}
        onSessionClosed={vi.fn()}
      />,
    );
    await within(await screen.findByLabelText('Screenplay actions')).findByRole(
      'button',
      { name: 'Save' },
    );
    const editor = screen
      .getByLabelText('Screenplay editor')
      .querySelector<HTMLElement>('.ProseMirror')!;
    expect(editor.getAttribute('contenteditable')).toBe('false');
    const before = editor.textContent;
    fireEvent.keyDown(editor, { key: 'Enter' });
    fireEvent.change(screen.getByLabelText('Element'), {
      target: { value: 'character' },
    });
    expect(editor.textContent).toBe(before);
    expect(calls.saved).toEqual([]);
    expect(calls.checkpoint).toBe(0);
  });
  it('retains staged import text when an autosave advances the source fingerprint', async () => {
    const { ports } = fixturePorts({ picked: opened() });
    ports.documents.save = async (request) => {
      const base = receiptFor(request.version, false);
      return {
        ...base,
        sourceSha256: request.sourceSha256,
        fingerprint: {
          ...base.fingerprint,
          sha256: request.sourceSha256,
          byteLength: request.source.length,
        },
        recovery: { ...base.recovery, sourceSha256: request.sourceSha256 },
      };
    };
    render(
      <WritingView
        ports={ports}
        open={{ kind: 'picked' }}
        onSessionClosed={vi.fn()}
      />,
    );
    await screen.findByLabelText('Screenplay actions');
    const staged = (await screen.findByLabelText(
      'Fountain screenplay to import',
    )) as HTMLTextAreaElement;
    fireEvent.change(staged, {
      target: { value: 'INT. RETAINED IMPORT - DAY' },
    });
    const editor = screen
      .getByLabelText('Screenplay editor')
      .querySelector<HTMLElement>('.ProseMirror')!;
    fireEvent.paste(editor, {
      clipboardData: {
        getData: (type: string) => (type === 'text/plain' ? 'new ' : ''),
      },
    });
    await waitFor(
      () =>
        expect(
          within(screen.getByLabelText('Protection status')).getByRole('status')
            .textContent,
        ).toBe('Saved locally'),
      { timeout: 4000 },
    );
    expect(screen.getByLabelText('Fountain screenplay to import')).toBe(staged);
    expect(staged.value).toBe('INT. RETAINED IMPORT - DAY');
  });
});

describe('M4-02 Home entry and switching', () => {
  it('protects an unsaved New immediately and retains it after destination cancel', async () => {
    const f = fixturePorts({});
    const destination = vi.spyOn(f.ports.saveAs, 'selectDestination');
    render(
      <WritingView
        ports={f.ports}
        open={{ kind: 'new', destination: true }}
        onSessionClosed={vi.fn()}
      />,
    );
    await screen.findByText(/Destination cancelled/);
    expect(destination).toHaveBeenCalledTimes(1);
    expect(f.calls.checkpoint).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Protect draft' })).toBeTruthy();
    expect(f.calls.released).toBe(0);
  });
  it('retains an active new draft when destination publication fails', async () => {
    const f = fixturePorts({});
    f.ports.saveAs.selectDestination = async () => {
      throw { code: 'permissionDenied' };
    };
    render(
      <WritingView
        ports={f.ports}
        open={{ kind: 'new', destination: true }}
        onSessionClosed={vi.fn()}
      />,
    );
    await screen.findByText(/The new draft stays open/);
    expect(
      within(screen.getByLabelText('Screenplay actions')).getByRole('button', {
        name: 'Save As',
      }),
    ).toBeTruthy();
    expect(f.calls.released).toBe(0);
  });
  it('returns Home only after native protection and release; failure retains editor', async () => {
    const f = fixturePorts({});
    const closed = vi.fn();
    render(
      <WritingView
        ports={f.ports}
        open={{ kind: 'new' }}
        onSessionClosed={closed}
      />,
    );
    await screen.findByText(/Unsaved draft protected/);
    f.ports.documents.checkpoint = async () => {
      throw { code: 'io' };
    };
    const editor = document.querySelector('.ProseMirror')!;
    // Native release failure independently blocks a seemingly protected switch.
    f.ports.documents.release = async () => {
      throw { code: 'io' };
    };
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Close and keep recovery' }),
    );
    await screen.findByText(/Close stopped\./);
    expect(closed).not.toHaveBeenCalled();
    expect(document.querySelector('.ProseMirror')).toBe(editor);
  });
  it('opens recents through the session and shows registry attention without losing read-only access', async () => {
    const f = fixturePorts({});
    const recents = {
      list: vi.fn(),
      locate: vi.fn(),
      remove: vi.fn(),
      confirmLocation: vi.fn(),
      open: vi.fn(async () => ({
        document: {
          ...opened(),
          ownership: {
            status: 'viewOnly' as const,
            reasons: ['alreadyOwned' as const],
          },
        },
        registryHealth: 'needsAttention' as const,
      })),
    };
    render(
      <WritingView
        ports={f.ports}
        recents={recents}
        open={{ kind: 'recent', entryId: 'entry' }}
        onSessionClosed={vi.fn()}
      />,
    );
    await screen.findByText(/Recent metadata needs attention/);
    expect(recents.open).toHaveBeenCalledWith('entry');
    expect(
      screen.getByText(/Save As can preserve a separate copy/),
    ).toBeTruthy();
    expect(
      (
        within(screen.getByLabelText('Screenplay actions')).getByRole(
          'button',
          { name: 'Save' },
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});

describe('M4-04 coordinated import', () => {
  it('cancels pending protection without replacing text; retries through a frozen native receipt and preserves one-step Undo', async () => {
    const { ports } = fixturePorts({ picked: opened() });
    let finish: (() => void) | undefined;
    let cancelPending = true;
    ports.workflows = {
      protect: async (request) => {
        if (cancelPending)
          await new Promise<void>((resolve) => {
            finish = resolve;
          });
        const cp = request.checkpoint;
        return {
          operation: request.operation,
          byteLength: cp.source.length,
          checkpoint: {
            identity: { ...cp.identity },
            version: cp.version,
            sourceSha256: cp.sourceSha256,
            generation: 1,
            protection: 'recoveryCheckpoint',
          },
          revision: {
            documentId: cp.identity.documentId,
            version: cp.version,
            sourceSha256: cp.sourceSha256,
            profileSha256: A,
            commitId: 'a'.repeat(40),
            changed: true,
            safetyRef: 'refs/safety/' + 'a'.repeat(40),
          },
        };
      },
    };
    render(
      <WritingView
        ports={ports}
        open={{ kind: 'picked' }}
        onSessionClosed={vi.fn()}
      />,
    );
    await screen.findByLabelText('Screenplay actions');
    const editor = screen
      .getByLabelText('Screenplay editor')
      .querySelector<HTMLElement>('.ProseMirror')!;
    const original = editor.textContent;
    fireEvent.change(
      await screen.findByLabelText('Fountain screenplay to import'),
      {
        target: { value: '!Replacement.' },
      },
    );
    fireEvent.click(screen.getByText('Import Fountain as screenplay'));
    await waitFor(() => expect(finish).toBeDefined());
    expect(editor.getAttribute('contenteditable')).toBe('false');
    fireEvent.click(screen.getByText('Cancel import protection'));
    finish!();
    await screen.findByText(/Operation cancelled/);
    expect(editor.textContent).toBe(original);
    expect(editor.getAttribute('contenteditable')).toBe('true');
    cancelPending = false;
    fireEvent.click(screen.getByText('Import Fountain as screenplay'));
    await screen.findByText(/Imported. Previous draft protected/);
    expect(editor.textContent).toBe('Replacement.');
    fireEvent.keyDown(editor, { key: 'z', ctrlKey: true });
    await waitFor(() => expect(editor.textContent).toBe(original));
  });
});

describe('M4-05 coordinated moves', () => {
  const oldRects = Object.getOwnPropertyDescriptor(
    Range.prototype,
    'getClientRects',
  );
  const oldBounds = Object.getOwnPropertyDescriptor(
    Range.prototype,
    'getBoundingClientRect',
  );
  afterEach(() => {
    vi.restoreAllMocks();
    for (const [name, descriptor] of [
      ['getClientRects', oldRects],
      ['getBoundingClientRect', oldBounds],
    ] as const) {
      if (descriptor) Object.defineProperty(Range.prototype, name, descriptor);
      else Reflect.deleteProperty(Range.prototype, name);
    }
  });
  async function moveFixture(
    source: string,
    workflows?: WritingPorts['workflows'],
  ) {
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: () => [],
    });
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => new DOMRect(),
    });
    const raw = [...new TextEncoder().encode(source)];
    const picked = {
      ...opened(),
      fingerprint: {
        ...fingerprint(),
        byteLength: raw.length,
        sha256: createHash('sha256').update(Uint8Array.from(raw)).digest('hex'),
      },
      source: raw,
      sourceSha256: createHash('sha256')
        .update(Uint8Array.from(raw))
        .digest('hex'),
    };
    const { ports, calls } = fixturePorts({ picked });
    if (workflows) ports.workflows = workflows;
    const saved: (readonly number[])[] = [];
    ports.documents.save = async (request) => {
      saved.push(request.source);
      const result = receipt({
        id: 1,
        protection: 'sourceFile',
        version: request.version,
        sha256: request.sourceSha256,
        byteLength: request.source.length,
      });
      return {
        ...result,
        fingerprint: {
          ...result.fingerprint,
          byteLength: request.source.length,
        },
      };
    };
    render(
      <WritingView
        ports={ports}
        open={{ kind: 'picked' }}
        onSessionClosed={vi.fn()}
      />,
    );
    await screen.findByLabelText('Screenplay actions');
    const editor = screen
      .getByLabelText('Screenplay editor')
      .querySelector<HTMLElement>('.ProseMirror')!;
    await waitFor(() =>
      expect(
        (
          screen.getByRole('button', {
            name: 'Move Scene 1: INT. A down',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    return { ports, calls, editor, saved };
  }
  it('previews exact attachments, applies a small move without history protection, saves exact bytes and undoes once', async () => {
    const original =
      '.INT. A\n= Synopsis\n!**Alpha**.\n[[Note]]\n\n.INT. B\n!Beta.\n\n';
    const protect = vi.fn();
    const f = await moveFixture(original, { protect });
    fireEvent.click(
      screen.getByRole('button', { name: 'Move Scene 1: INT. A down' }),
    );
    expect(
      (screen.getByLabelText('Exact moved source') as HTMLTextAreaElement)
        .value,
    ).toBe('.INT. A\n= Synopsis\n!**Alpha**.\n[[Note]]\n\n');
    fireEvent.click(screen.getByText('Apply move'));
    await waitFor(() =>
      expect(screen.queryByLabelText('Move preview')).toBeNull(),
    );
    expect(protect).not.toHaveBeenCalled();
    expect(f.editor.querySelector('p')!.textContent).toBe('INT. B');
    fireEvent.click(
      within(screen.getByLabelText('Screenplay actions')).getByRole('button', {
        name: 'Save',
      }),
    );
    await waitFor(() => expect(f.saved.length).toBeGreaterThan(0));
    expect(new TextDecoder().decode(Uint8Array.from(f.saved.at(-1)!))).toBe(
      '.INT. B\n!Beta.\n\n.INT. A\n= Synopsis\n!**Alpha**.\n[[Note]]\n\n',
    );
    await waitFor(() =>
      expect(
        (
          within(screen.getByLabelText('Screenplay actions')).getByRole(
            'button',
            { name: 'Save' },
          ) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    fireEvent.keyDown(f.editor, { key: 'z', ctrlKey: true });
    await waitFor(() =>
      expect(f.editor.querySelector('p')!.textContent).toBe('INT. A'),
    );
    fireEvent.click(
      within(screen.getByLabelText('Screenplay actions')).getByRole('button', {
        name: 'Save',
      }),
    );
    await waitFor(() =>
      expect(new TextDecoder().decode(Uint8Array.from(f.saved.at(-1)!))).toBe(
        original,
      ),
    );
  });
  it('cancels frozen large-move protection, retains preview, refuses history failure and keeps ordinary Save independent', async () => {
    const original = '.INT. A\n' + '!A.\n'.repeat(48) + '\n.INT. B\n!B.\n\n';
    let finish: (() => void) | undefined;
    let failHistory = false;
    const protect = vi.fn(
      async (
        request: import('../../src/application/workflowProtection').WorkflowProtectionRequest,
      ) => {
        expect(request.checkpoint.source.length).toBe(
          new TextEncoder().encode(original).length,
        );
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
        if (failHistory)
          throw new Error('History unavailable; history needs attention');
        const cp = request.checkpoint;
        return {
          operation: request.operation,
          byteLength: cp.source.length,
          checkpoint: {
            identity: cp.identity,
            version: cp.version,
            sourceSha256: cp.sourceSha256,
            generation: 1,
            protection: 'recoveryCheckpoint' as const,
          },
          revision: {
            documentId: cp.identity.documentId,
            version: cp.version,
            sourceSha256: cp.sourceSha256,
            profileSha256: A,
            commitId: 'a'.repeat(40),
            changed: true,
            safetyRef: 'refs/safety/' + 'a'.repeat(40),
          },
        };
      },
    );
    const f = await moveFixture(original, { protect });
    fireEvent.click(
      screen.getByRole('button', { name: 'Move Scene 1: INT. A down' }),
    );
    fireEvent.click(screen.getByText('Apply move'));
    await waitFor(() => expect(finish).toBeDefined());
    expect(protect.mock.calls[0]![0].operation).toBe('sceneMove');
    expect(f.editor.getAttribute('contenteditable')).toBe('false');
    fireEvent.click(screen.getByText('Cancel move protection'));
    finish!();
    await screen.findByText(/Operation cancelled/);
    expect(f.editor.getAttribute('contenteditable')).toBe('true');
    expect(f.editor.querySelector('p')!.textContent).toBe('INT. A');
    failHistory = true;
    finish = undefined;
    fireEvent.click(screen.getByText('Apply move'));
    await waitFor(() => expect(finish).toBeDefined());
    finish!();
    await screen.findByText('History unavailable; history needs attention');
    expect(f.editor.querySelector('p')!.textContent).toBe('INT. A');
    expect(f.editor.getAttribute('contenteditable')).toBe('true');
    expect(screen.getByLabelText('Exact moved source')).toBeTruthy();
    fireEvent.click(screen.getByText('Cancel move preview'));
    fireEvent.click(
      within(screen.getByLabelText('Screenplay actions')).getByRole('button', {
        name: 'Save',
      }),
    );
    await waitFor(() => expect(f.saved.length).toBeGreaterThan(0));
    expect(new TextDecoder().decode(Uint8Array.from(f.saved.at(-1)!))).toBe(
      original,
    );
  });
  it('makes a preview stale after an accepted edit and retains both review copies for an EOF refusal', async () => {
    const f = await moveFixture('.INT. A\n!A.\n\n.INT. B\n!B.');
    fireEvent.click(
      screen.getByRole('button', { name: 'Move Scene 1: INT. A down' }),
    );
    expect(screen.getByLabelText('Original source review copy')).toBeTruthy();
    expect(screen.getByLabelText('Candidate source review copy')).toBeTruthy();
    expect((screen.getByText('Apply move') as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.keyDown(f.editor, { key: 'Enter' });
    await screen.findByText(/Move preview is stale/);
    expect((screen.getByText('Apply move') as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});

it('title input blocks Save, Home and application shortcuts until explicit Apply/Discard; Save captures applied exact bytes', async () => {
  const literal =
    '\ufeffTitle:\t**Old**\r\nAuthor: A\r\nAuthor: B\r\nX-Custom: retain  \r\n\r\n!Body.  ';
  const { ports, calls } = fixturePorts({
    picked: { ...opened(), source: [...new TextEncoder().encode(literal)] },
  });
  const saved: string[] = [];
  ports.documents.save = async (request) => {
    saved.push(
      new TextDecoder('utf-8', { ignoreBOM: true }).decode(
        Uint8Array.from(request.source),
      ),
    );
    return {
      ...receiptFor(request.version),
      sourceSha256: request.sourceSha256,
    };
  };
  render(
    <WritingView
      ports={ports}
      open={{ kind: 'picked' }}
      onSessionClosed={vi.fn()}
    />,
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Title page' })).toBeTruthy(),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Title page' }));
  await waitFor(() =>
    expect(
      (
        screen.getByRole('button', {
          name: 'Edit field 1: Title',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Edit field 1: Title' }));
  const input = screen.getByLabelText('Field value');
  fireEvent.change(input, { target: { value: '*New*\nMore' } });
  fireEvent.click(
    within(screen.getByLabelText('Screenplay actions')).getByRole('button', {
      name: 'Save',
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Home' }));
  fireEvent.keyDown(window, { key: 'o', ctrlKey: true });
  expect(saved).toEqual([]);
  expect(calls.released).toBe(0);
  expect(
    screen.queryByRole('button', { name: 'Retry protection and close' }),
  ).toBeNull();
  expect((input as HTMLTextAreaElement).value).toBe('*New*\nMore');
  const shortcut = new KeyboardEvent('keydown', {
    key: 's',
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  input.dispatchEvent(shortcut);
  expect(shortcut.defaultPrevented).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Apply title input' }));
  await waitFor(() =>
    expect(screen.queryByLabelText('Field value')).toBeNull(),
  );
  fireEvent.click(
    within(screen.getByLabelText('Screenplay actions')).getByRole('button', {
      name: 'Save',
    }),
  );
  await waitFor(() => expect(saved).toHaveLength(1));
  expect(saved[0]).toBe(
    literal.replace('**Old**\r\n', '*New*\r\n    More\r\n'),
  );
});

it('M4-07 registry find/hidden selection/close preserve one editor and trigger no native writes', async () => {
  // JSDOM has no Range layout; actual selection visibility is a native gate.
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value: () => [],
  });
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(),
  });
  const source =
    'Title: moon\n\n.INT. LAB - DAY\n!moon **light**.\n[[moon]]\n/*moon*/\n!moon [[tail]]';
  const fixture = fixturePorts({
    picked: {
      ...opened(),
      source: Array.from(new TextEncoder().encode(source)),
      fingerprint: {
        ...opened().fingerprint!,
        sha256: createHash('sha256').update(source).digest('hex'),
      },
    },
  });
  render(
    <WritingView
      ports={fixture.ports}
      open={{ kind: 'picked' }}
      onSessionClosed={vi.fn()}
    />,
  );
  await screen.findByLabelText('Screenplay actions');
  await waitFor(() =>
    expect(
      document.querySelector('.outline-target:not(:disabled)'),
    ).toBeTruthy(),
  );
  const editor = document.querySelector('.ProseMirror')!;
  const checkpoints = fixture.calls.checkpoint;
  const saves = fixture.calls.saved.length;
  fireEvent.keyDown(editor, { key: 'f', ctrlKey: true });
  const input = await screen.findByLabelText('Find text');
  fireEvent.change(input, { target: { value: 'moon' } });
  await screen.findByText('5 matches.');
  fireEvent.click(screen.getByRole('button', { name: /Note · row 5/ }));

  await waitFor(() =>
    expect(document.querySelector('.find-reveal')?.textContent).toContain(
      'source row 5',
    ),
  );
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: 'Next match' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  expect(document.activeElement).toBe(editor);
  fireEvent.keyDown(editor, { key: 'g', ctrlKey: true });
  await waitFor(() =>
    expect(document.querySelector('.find-reveal')?.textContent).toContain(
      'source row 6',
    ),
  );
  fireEvent.click(screen.getByText('Close find'));
  expect(document.activeElement).toBe(editor);
  expect(document.querySelector('.ProseMirror')).toBe(editor);
  expect(fixture.calls.checkpoint).toBe(checkpoints);
  expect(fixture.calls.saved.length).toBe(saves);
  Reflect.deleteProperty(Range.prototype, 'getClientRects');
  Reflect.deleteProperty(Range.prototype, 'getBoundingClientRect');
});

it('M4-10 toggles presentation without remounting or saving; failure retains settings and persistent protection messages', async () => {
  const { ViewPreferences } =
    await import('../../src/application/viewPreferences');
  let fail = false;
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: vi.fn((key: string, value: string) => {
      if (fail) throw new Error('quota');
      values.set(key, value);
    }),
  };
  const preferences = new ViewPreferences(storage);
  const fixture = fixturePorts({ picked: opened() });
  const mounted = vi.spyOn(editorMount, 'mountScreenplayEditor');
  render(
    <WritingView
      ports={fixture.ports}
      open={{ kind: 'picked' }}
      onSessionClosed={vi.fn()}
      preferences={preferences}
    />,
  );
  await screen.findByLabelText('Screenplay actions');
  const editor = document.querySelector<HTMLElement>('.ProseMirror')!;
  const original = editor.textContent;
  const view = mounted.mock.results.at(-1)!.value as ReturnType<
    typeof editorMount.mountScreenplayEditor
  >;
  const initial = view.state;
  const source = Array.from(captureEditor(initial).source);
  const saves = fixture.calls.saved.length,
    checkpoints = fixture.calls.checkpoint;
  fireEvent.change(screen.getByLabelText('Theme'), {
    target: { value: 'dark' },
  });
  expect(document.documentElement.dataset.theme).toBe('dark');
  fireEvent.change(screen.getByLabelText('Writing zoom'), {
    target: { value: '150' },
  });
  expect(screen.getByLabelText('Screenplay editor').style.fontSize).toBe(
    '1.5rem',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Focus mode' }));
  expect(document.querySelector('.writing-focus')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Exit focus mode' })).toBeTruthy();
  expect(screen.getByLabelText('Protection status')).toBeTruthy();
  fireEvent.click(screen.getByLabelText('Typewriter scroll'));
  expect(document.querySelector('.writing-typewriter')).toBeTruthy();
  fail = true;
  fireEvent.change(screen.getByLabelText('Theme'), {
    target: { value: 'light' },
  });
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(screen.getByText(/could not be stored/).getAttribute('role')).toBe(
    'alert',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Exit focus mode' }));
  expect(document.querySelector('.writing-focus')).toBeTruthy();
  fail = false;
  const ownedEscape = new KeyboardEvent('keydown', {
    key: 'Escape',
    bubbles: true,
    cancelable: true,
  });
  ownedEscape.preventDefault();
  editor.dispatchEvent(ownedEscape);
  expect(document.querySelector('.writing-focus')).toBeTruthy();
  fireEvent.keyDown(editor, { key: 'Escape' });
  expect(document.querySelector('.writing-focus')).toBeNull();
  expect(document.querySelector('.ProseMirror')).toBe(editor);
  expect(editor.textContent).toBe(original);
  expect(view.state).toBe(initial);
  expect(editorVersion(view.state)).toBe(editorVersion(initial));
  expect(view.state.selection).toBe(initial.selection);
  expect(undoDepth(view.state)).toBe(0);
  expect(Array.from(captureEditor(view.state).source)).toEqual(source);
  mounted.mockRestore();
  expect(fixture.calls.saved.length).toBe(saves);
  expect(fixture.calls.checkpoint).toBe(checkpoints);
  expect(new ViewPreferences(storage).getSnapshot().settings.zoom).toBe(150);
});

it('restores a hash/identity-bound UI selection, clears unrelated hints after external edits and isolates corrupt hint storage from Save/close', async () => {
  const { RecentPositions, positionStorageKey } =
    await import('../../src/application/recentPosition');
  const positions = new RecentPositions(window.localStorage);
  positions.remember({
    documentId: identity.documentId,
    sourceSha256: A,
    anchor: { row: 0, offset: 1 },
    head: { row: 0, offset: 1 },
    viewport: null,
  });
  const f = fixturePorts({ picked: opened() });
  let current: ReturnType<typeof editorMount.mountScreenplayEditor> | null =
    null;
  const mount = editorMount.mountScreenplayEditor;
  vi.spyOn(editorMount, 'mountScreenplayEditor').mockImplementation(
    (...args) => {
      current = mount(...args);
      return current;
    },
  );
  const ui = render(
    <WritingView
      ports={f.ports}
      open={{ kind: 'picked' }}
      onSessionClosed={vi.fn()}
    />,
  );
  await screen.findByLabelText('Screenplay actions');
  await waitFor(() => expect(current!.state.selection.head).toBe(2));
  expect(current!.hasFocus()).toBe(true);
  expect(undoDepth(current!.state)).toBe(0);
  ui.unmount();
  // Native fingerprint mismatch deliberately retains source-derived default caret.
  window.localStorage.setItem(
    positionStorageKey,
    JSON.stringify({
      version: 1,
      positions: [
        {
          documentId: identity.documentId,
          sourceSha256: B,
          anchor: { row: 0, offset: 1 },
          head: { row: 0, offset: 1 },
          viewport: null,
        },
      ],
    }),
  );
  const changed = render(
    <WritingView
      ports={f.ports}
      open={{ kind: 'picked' }}
      onSessionClosed={vi.fn()}
    />,
  );
  await screen.findByLabelText('Screenplay actions');
  await waitFor(() => expect(current!.state.selection.head).toBe(1));
  changed.unmount();
  window.localStorage.setItem(positionStorageKey, 'corrupt retained hints');
  const closed = vi.fn();
  render(
    <WritingView
      ports={f.ports}
      open={{ kind: 'picked' }}
      onSessionClosed={closed}
    />,
  );
  await screen.findByText(/Recent positions could not be read/);
  await screen.findByLabelText('Screenplay actions');
  fireEvent.click(
    within(screen.getByLabelText('Screenplay actions')).getByRole('button', {
      name: 'Save',
    }),
  );
  await waitFor(() => expect(f.calls.saved.length).toBeGreaterThan(0));
  fireEvent.click(screen.getByRole('button', { name: 'Close session' }));
  await waitFor(() => expect(closed).toHaveBeenCalled());
  expect(window.localStorage.getItem(positionStorageKey)).toBe(
    'corrupt retained hints',
  );
});

it('Save As thaws a fresh identity/view with the owned caret focused and never applies a foreign equal-source hint', async () => {
  const { RecentPositions } =
    await import('../../src/application/recentPosition');
  const copiedIdentity = {
    handle: '22222222-2222-4222-8222-222222222222',
    documentId: '33333333-3333-4333-8333-333333333333',
    sessionId: '44444444-4444-4444-8444-444444444444',
  };
  new RecentPositions(window.localStorage).remember({
    documentId: copiedIdentity.documentId,
    sourceSha256: A,
    anchor: { row: 0, offset: 0 },
    head: { row: 0, offset: 0 },
    viewport: null,
  });
  const f = fixturePorts({ picked: opened() });
  f.ports.saveAs.selectDestination = async () => ({
    token: 'destination',
    fileName: 'copy.fountain',
    storageRelation: 'sameFilesystem',
  });
  f.ports.saveAs.saveAs = async ({ checkpoint }) => ({
    document: {
      ...opened(),
      identity: copiedIdentity,
      source: checkpoint.source,
    },
    version: checkpoint.version,
    sourceSha256: checkpoint.sourceSha256,
    fileName: 'copy.fountain',
    storageRelation: 'sameFilesystem',
  });
  f.ports.recovery.inspect = async (id) => ({
    documentId: id.documentId,
    candidates: [],
    notices: [],
    error: null,
  });
  const views: ReturnType<typeof editorMount.mountScreenplayEditor>[] = [];
  const mount = editorMount.mountScreenplayEditor;
  vi.spyOn(editorMount, 'mountScreenplayEditor').mockImplementation(
    (...args) => {
      const view = mount(...args);
      views.push(view);
      return view;
    },
  );
  render(
    <WritingView
      ports={f.ports}
      open={{ kind: 'picked' }}
      onSessionClosed={vi.fn()}
    />,
  );
  await screen.findByLabelText('Screenplay actions');
  const { TextSelection } = await import('prosemirror-state');
  views[0]!.dispatch(
    views[0]!.state.tr.setSelection(
      TextSelection.create(views[0]!.state.doc, 2),
    ),
  );
  fireEvent.click(
    within(screen.getByLabelText('Screenplay actions')).getByRole('button', {
      name: 'Save As',
    }),
  );
  await waitFor(() => expect(views).toHaveLength(2));
  await waitFor(() =>
    expect(views[1]!.dom.getAttribute('contenteditable')).toBe('true'),
  );
  expect(views[0]!.isDestroyed).toBe(true);
  expect(views[1]!.state.selection.head).toBe(2);
  expect(views[1]!.hasFocus()).toBe(true);
  expect(undoDepth(views[1]!.state)).toBe(0);
  expect(f.calls.released).toBe(1);
});

it('M4-14 palette navigation rechecks its frame and preserves source/Undo, while shared help disables protected actions', async () => {
  const source =
    '\ufeffTitle: Palette\r\n\r\n.INT. A - DAY\r\n!First.\r\n\r\n.INT. B - NIGHT\r\n!Second.\r\n';
  const raw = [...new TextEncoder().encode(source)];
  const f = fixturePorts({
    picked: {
      ...opened(),
      source: raw,
      fingerprint: {
        ...fingerprint(),
        byteLength: raw.length,
        sha256: createHash('sha256').update(source).digest('hex'),
      },
    },
  });
  const mount = vi.spyOn(editorMount, 'mountScreenplayEditor');
  render(
    <WritingView
      ports={f.ports}
      open={{ kind: 'picked' }}
      onSessionClosed={vi.fn()}
    />,
  );
  await screen.findByLabelText('Screenplay actions');
  await waitFor(() =>
    expect(
      (
        screen.getByRole('button', {
          name: 'Go to Scene 2: INT. B - NIGHT',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  const view = mount.mock.results[0]!
    .value as import('prosemirror-view').EditorView;
  const before = captureEditor(view.state).source,
    depth = undoDepth(view.state);
  view.focus();
  fireEvent.click(screen.getByRole('button', { name: 'Command Palette' }));
  fireEvent.change(
    screen.getByRole('combobox', { name: 'Find an action, scene or section' }),
    {
      target: { value: 'Scene 2:' },
    },
  );
  fireEvent.keyDown(
    screen.getByRole('combobox', { name: 'Find an action, scene or section' }),
    { key: 'Enter' },
  );
  await waitFor(() => expect(view.state.selection.$head.index(0)).toBe(5));
  expect([...captureEditor(view.state).source]).toEqual([...before]);
  expect(undoDepth(view.state)).toBe(depth);
  expect(f.calls.saved).toHaveLength(0);
  await waitFor(() =>
    expect(
      (
        screen.getByRole('button', {
          name: 'Go to Scene 1: INT. A - DAY',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Command Palette' }));
  fireEvent.change(
    screen.getByRole('combobox', { name: 'Find an action, scene or section' }),
    {
      target: { value: 'Scene 1:' },
    },
  );
  expect(
    within(screen.getByRole('dialog')).getByRole('option', {
      name: /Scene 1: INT. A - DAY/,
    }),
  ).toBeTruthy();
  // Simulate a frame invalidation between displaying and activating an entry.
  const changed = view.state.apply(
    view.state.tr.setSelection(
      TextSelection.create(view.state.doc, view.state.selection.head + 1),
    ),
  );
  view.updateState(changed);
  const selection = view.state.selection;
  fireEvent.keyDown(
    screen.getByRole('combobox', { name: 'Find an action, scene or section' }),
    { key: 'Enter' },
  );
  await screen.findByText(
    'Palette navigation is stale or unavailable. Text and selection are retained.',
  );
  expect(view.state.selection.eq(selection)).toBe(true);
  expect(f.calls.saved).toHaveLength(0);
  f.ports.documents.save = async () => {
    throw { code: 'io' };
  };
  fireEvent.click(screen.getByRole('button', { name: 'Home' }));
  await screen.findByRole('button', { name: 'Retry save and close' });
  expect(
    (
      within(screen.getByLabelText('Screenplay actions')).getByRole('button', {
        name: 'Save',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(
    (screen.getByRole('button', { name: 'Run Open' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(
    (screen.getByRole('button', { name: 'Run Undo' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});

it('AUDIT-C02: a capture-failure alert clears once the draft captures again', async () => {
  const source = '\n@MAYA\n(softly)\nHello.\n';
  const raw = [...new TextEncoder().encode(source)];
  const f = fixturePorts({
    picked: {
      ...opened(),
      source: raw,
      fingerprint: {
        ...fingerprint(),
        byteLength: raw.length,
        sha256: createHash('sha256').update(source).digest('hex'),
      },
    },
  });
  const views: ReturnType<typeof editorMount.mountScreenplayEditor>[] = [];
  const mount = editorMount.mountScreenplayEditor;
  vi.spyOn(editorMount, 'mountScreenplayEditor').mockImplementation(
    (...args) => {
      const view = mount(...args);
      views.push(view);
      return view;
    },
  );
  render(
    <WritingView
      ports={f.ports}
      open={{ kind: 'picked' }}
      onSessionClosed={vi.fn()}
    />,
  );
  await screen.findByLabelText('Screenplay actions');
  const view = views[0]!;
  // Text before a Parenthetical's opening bracket has no Fountain spelling.
  const start =
    view.state.doc.child(0).nodeSize + view.state.doc.child(1).nodeSize + 1;
  view.dispatch(view.state.tr.insertText('x', start));
  // AUDIT-PARK-H-F3: the alert names the row in author words.
  const paused =
    /Row 3, the Parenthetical “x\(softly\)”, cannot be saved as Fountain/;
  expect((await screen.findByText(paused)).getAttribute('role')).toBe('alert');
  expect(screen.queryByText(/Parenthetical must be wrapped/)).toBeNull();
  view.dispatch(view.state.tr.delete(start, start + 1));
  await waitFor(() => expect(screen.queryByText(paused)).toBeNull());
  expect(new TextDecoder().decode(captureEditor(view.state).source)).toBe(
    source,
  );
});

it('restores current outline and counts after Save As rollback without losing source, selection or Undo', async () => {
  const source = '.INT. ROOM - DAY\n!Alpha.\n\n.EXT. GARDEN - DAY\n!Beta.\n';
  const raw = [...new TextEncoder().encode(source)];
  const original = {
    ...opened(),
    source: raw,
    fingerprint: {
      ...fingerprint(),
      byteLength: raw.length,
      sha256: createHash('sha256').update(source).digest('hex'),
    },
  };
  const f = fixturePorts({ picked: original });
  const copiedIdentity = {
    handle: '22222222-2222-4222-8222-222222222222',
    documentId: '33333333-3333-4333-8333-333333333333',
    sessionId: '44444444-4444-4444-8444-444444444444',
  };
  f.ports.saveAs.selectDestination = async () => ({
    token: 'destination',
    fileName: 'copy.fountain',
    storageRelation: 'sameFilesystem',
  });
  let published: readonly number[] | null = null;
  f.ports.saveAs.saveAs = async ({ checkpoint }) => {
    published = checkpoint.source;
    return {
      document: {
        ...original,
        identity: copiedIdentity,
        source: checkpoint.source,
        fingerprint: {
          ...original.fingerprint,
          byteLength: checkpoint.source.length,
          sha256: checkpoint.sourceSha256,
        },
      },
      version: checkpoint.version,
      sourceSha256: checkpoint.sourceSha256,
      fileName: 'copy.fountain',
      storageRelation: 'sameFilesystem',
    };
  };
  f.ports.recovery.inspect = async (id) => ({
    documentId: id.documentId,
    candidates: [],
    notices: [],
    error: null,
  });
  f.ports.documents.release = vi.fn(async (id) => {
    if (id.handle === original.identity.handle)
      throw new Error('Original release refused after copy adoption');
  });
  const views: ReturnType<typeof editorMount.mountScreenplayEditor>[] = [];
  const mount = editorMount.mountScreenplayEditor;
  vi.spyOn(editorMount, 'mountScreenplayEditor').mockImplementation(
    (...args) => {
      const view = mount(...args);
      views.push(view);
      return view;
    },
  );
  render(
    <WritingView
      ports={f.ports}
      open={{ kind: 'picked' }}
      onSessionClosed={vi.fn()}
    />,
  );
  await screen.findByLabelText('Screenplay actions');
  await waitFor(() =>
    expect(
      (
        screen.getByRole('button', {
          name: 'Go to Scene 1: INT. ROOM - DAY',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  const initial = views[0]!;
  initial.dispatch(
    initial.state.tr.insertText('X', initial.state.doc.child(0).nodeSize + 1),
  );
  const before = initial.state;
  const expected = [...captureEditor(before).source];
  const depth = undoDepth(before);
  expect(depth).toBeGreaterThan(0);
  fireEvent.click(
    within(screen.getByLabelText('Screenplay actions')).getByRole('button', {
      name: 'Save As',
    }),
  );
  await screen.findByText(
    /Save As adoption failed during original-registration release .*original session remains open/,
  );
  await waitFor(() => expect(views).toHaveLength(3));
  const restored = views[2]!;
  expect([...captureEditor(restored.state).source]).toEqual(expected);
  expect(published).toEqual(expected);
  expect(restored.state.selection.eq(before.selection)).toBe(true);
  expect(undoDepth(restored.state)).toBe(depth);
  await waitFor(() =>
    expect(
      (
        screen.getByRole('button', {
          name: 'Go to Scene 1: INT. ROOM - DAY',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  expect(
    screen.queryByText('Counts updating; earlier facts are stale.'),
  ).toBeNull();
  fireEvent.click(
    screen.getByRole('button', { name: 'Go to Scene 2: EXT. GARDEN - DAY' }),
  );
  expect(restored.state.selection.$head.parent.textContent).toBe(
    'EXT. GARDEN - DAY',
  );
  expect([...captureEditor(restored.state).source]).toEqual(expected);
  expect(undoDepth(restored.state)).toBe(depth);
});

it('offers source comparison, keeps editing, explicitly Reloads and preserves Undo', async () => {
  const { ports } = fixturePorts({ picked: opened() });
  ports.externalSource = {
    check: vi.fn(async () => ({
      identity,
      status: 'changed' as const,
      fingerprint: fingerprint(2, B),
      source: [98],
    })),
    reload: vi.fn(async ({ adopted }) => receiptFor(adopted.version, true)),
  };
  render(
    <WritingView
      ports={ports}
      open={{ kind: 'picked' }}
      onSessionClosed={vi.fn()}
    />,
  );
  const panel = await screen.findByRole('region', {
    name: 'External source change',
  });
  const comparison = within(panel).getByText('Compare draft and source file')
    .parentElement as HTMLDetailsElement;
  comparison.open = true;
  fireEvent(comparison, new Event('toggle'));
  expect(await within(panel).findByText('a')).toBeTruthy();
  expect(within(panel).getByText('b')).toBeTruthy();
  expect(ports.externalSource!.reload).not.toHaveBeenCalled();
  fireEvent.click(within(panel).getByRole('button', { name: 'Keep editing' }));
  expect(
    screen.queryByRole('region', { name: 'External source change' }),
  ).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Reload source' }));
  fireEvent.click(
    await screen.findByRole('button', { name: 'Reload reviewed source' }),
  );
  await waitFor(() =>
    expect(document.querySelector('.ProseMirror')!.textContent).toBe('b'),
  );
  const editor = document.querySelector<HTMLElement>('.ProseMirror')!;
  await waitFor(() =>
    expect(
      screen
        .getByRole('button', { name: 'Reload source' })
        .hasAttribute('disabled'),
    ).toBe(true),
  );
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled'),
    ).toBe(false),
  );
  fireEvent.keyDown(editor, { key: 'z', ctrlKey: true });
  await waitFor(() => expect(editor.textContent).toBe('a'));
});

it('checks on focus without adopting bytes and reports unavailable sources', async () => {
  const { ports } = fixturePorts({ picked: opened() });
  ports.externalSource = {
    check: vi.fn(async () => ({
      identity,
      status: 'unchanged' as const,
      fingerprint: opened().fingerprint!,
      source: null,
    })),
    reload: vi.fn(),
  };
  render(
    <WritingView
      ports={ports}
      open={{ kind: 'picked' }}
      onSessionClosed={vi.fn()}
    />,
  );
  await waitFor(() =>
    expect(ports.externalSource!.check).toHaveBeenCalledTimes(1),
  );
  ports.externalSource!.check = vi.fn(async () => {
    throw new Error('missingSource');
  });
  fireEvent(window, new Event('focus'));
  expect(await screen.findByText(/Source recheck unavailable/)).toBeTruthy();
  expect(document.querySelector('.ProseMirror')!.textContent).toBe('a');
  expect(ports.externalSource!.reload).not.toHaveBeenCalled();
});

it.each([false, true])(
  'AUDIT-C356 keeps Find highlights through navigation and caret updates (retained check %s)',
  async (checked) => {
    const source = '.INT. ROOM - DAY\n\n!moon moon moon\n\n@ORPHAN\n';
    const fixture = fixturePorts({
      picked: {
        ...opened(),
        source: Array.from(new TextEncoder().encode(source)),
        fingerprint: {
          ...opened().fingerprint!,
          sha256: createHash('sha256').update(source).digest('hex'),
        },
      },
    });
    const mounted = vi.spyOn(editorMount, 'mountScreenplayEditor');
    render(
      <WritingView
        ports={fixture.ports}
        open={{ kind: 'picked' }}
        onSessionClosed={vi.fn()}
      />,
    );
    const actions = await screen.findByLabelText('Screenplay actions');
    const view = mounted.mock.results.at(-1)!.value as ReturnType<
      typeof editorMount.mountScreenplayEditor
    >;
    await waitFor(() =>
      expect(
        document.querySelector('.outline-target:not(:disabled)'),
      ).toBeTruthy(),
    );
    if (checked) {
      fireEvent.click(
        within(actions).getByRole('button', { name: 'Script Check' }),
      );
      await waitFor(() =>
        expect(
          document.querySelectorAll('.check-highlight').length,
        ).toBeGreaterThan(0),
      );
    }
    fireEvent.keyDown(view.dom, { key: 'f', ctrlKey: true });
    fireEvent.change(await screen.findByLabelText('Find text'), {
      target: { value: 'moon' },
    });
    await waitFor(() =>
      expect(document.querySelectorAll('.find-highlight')).toHaveLength(3),
    );
    expect(document.querySelectorAll('.check-highlight')).toHaveLength(0);
    const original = captureEditor(view.state).source;
    const depth = undoDepth(view.state);
    for (const name of ['Next match', 'Previous match']) {
      fireEvent.click(screen.getByRole('button', { name }));
      await waitFor(() =>
        expect(document.querySelectorAll('.find-highlight')).toHaveLength(3),
      );
      expect(document.querySelectorAll('.find-active')).toHaveLength(1);
      expect(document.querySelectorAll('.check-highlight')).toHaveLength(0);
    }
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, 2)),
    );
    await waitFor(() =>
      expect(document.querySelectorAll('.find-highlight')).toHaveLength(3),
    );
    expect(document.querySelectorAll('.check-highlight')).toHaveLength(0);
    expect(captureEditor(view.state).source).toEqual(original);
    expect(undoDepth(view.state)).toBe(depth);
    fireEvent.click(screen.getByText('Close find'));
    expect(document.querySelectorAll('.find-highlight')).toHaveLength(0);
  },
);

// AUDIT-TEST: real view/editor glue, with explicit injected native receipts.
function auditDocument(source: string): OpenDocument {
  const bytes = Array.from(new TextEncoder().encode(source));
  return {
    ...opened(),
    source: bytes,
    fingerprint: {
      ...fingerprint(),
      sha256: createHash('sha256').update(source).digest('hex'),
      byteLength: bytes.length,
    },
  };
}
function auditReceipt(
  version: number,
  source: readonly number[],
  id = identity,
) {
  const hash = createHash('sha256')
    .update(Uint8Array.from(source))
    .digest('hex');
  return {
    ...receiptFor(version),
    identity: id,
    sourceSha256: hash,
    fingerprint: { ...fingerprint(version, hash), byteLength: source.length },
    recovery: {
      ...receiptFor(version).recovery,
      identity: id,
      sourceSha256: hash,
    },
  };
}
async function auditView(
  ports: WritingPorts,
  open: Parameters<typeof WritingView>[0]['open'] = { kind: 'picked' },
) {
  const mount = vi.spyOn(editorMount, 'mountScreenplayEditor');
  render(<WritingView ports={ports} open={open} onSessionClosed={vi.fn()} />);
  await screen.findByLabelText('Screenplay actions');
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Find' }).hasAttribute('disabled'),
    ).toBe(false),
  );
  return mount.mock.results.at(-1)!
    .value as import('prosemirror-view').EditorView;
}

it('AUDIT-TEST WritingView opens a resumed draft at version 2 and protects the fresh identity', async () => {
  const { ports } = fixturePorts({});
  const selected = {
    documentId: identity.documentId,
    origin: 'current' as const,
    recordSha256: A,
  };
  const fresh = {
    ...identity,
    handle: '44444444-4444-4444-8444-444444444444',
    documentId: '55555555-5555-4555-8555-555555555555',
  };
  const document = {
    ...auditDocument('!Resumed\n'),
    identity: fresh,
    kind: 'unsaved' as const,
    persistentIdentity: false,
    fingerprint: null,
  };
  ports.recovery.resume = vi.fn(async () => ({ document, draftMetadata: {} }));
  ports.recovery.inspect = async (id) => ({
    documentId: id.documentId,
    candidates: [
      {
        selection: { ...selected, documentId: id.documentId },
        sessionId: id.sessionId,
        version: 1,
        generation: 1,
        sourceSha256: createHash('sha256')
          .update(Uint8Array.from(document.source))
          .digest('hex'),
        byteLength: document.source.length,
        encoding: 'utf8',
      },
    ],
    notices: [],
    error: null,
  });
  const checkpoint = vi.spyOn(ports.documents, 'checkpoint'),
    save = vi.spyOn(ports.documents, 'save');
  const view = await auditView(ports, {
    kind: 'recovered',
    selection: selected,
  });
  expect(ports.recovery.resume).toHaveBeenCalledExactlyOnceWith(selected);
  expect(editorVersion(view.state)).toBe(2);
  expect([...captureEditor(view.state).source]).toEqual(document.source);
  expect(checkpoint).toHaveBeenCalledWith(
    expect.objectContaining({
      identity: fresh,
      version: 2,
      source: document.source,
      expectedFingerprint: null,
    }),
  );
  expect(save).not.toHaveBeenCalled();
});

it('AUDIT-TEST WritingView replace-one advances, replace-all is one Undo step, composition refuses', async () => {
  const original = '.INT. ROOM - DAY\n\n!moon **moon** moon\n';
  const { ports } = fixturePorts({ picked: auditDocument(original) });
  const view = await auditView(ports);
  fireEvent.click(screen.getByRole('button', { name: 'Find' }));
  fireEvent.change(await screen.findByLabelText('Find text'), {
    target: { value: 'moon' },
  });
  await screen.findByText('3 matches.');
  fireEvent.click(screen.getByRole('button', { name: 'Next match' }));
  fireEvent.change(screen.getByLabelText('Replace with'), {
    target: { value: 'sun' },
  });
  const match = screen.getByRole('button', { name: 'Replace match' });
  await waitFor(() => expect(match.hasAttribute('disabled')).toBe(false));
  const before = view.state;
  Object.defineProperty(view, 'composing', { configurable: true, value: true });
  fireEvent.click(match);
  expect(view.state).toBe(before);
  expect(
    screen.getByText(/Replacement is unavailable for this version/),
  ).toBeTruthy();
  Reflect.deleteProperty(view, 'composing');
  fireEvent.click(match);
  await screen.findByText(/2 matches/);
  expect(new TextDecoder().decode(captureEditor(view.state).source)).toBe(
    '.INT. ROOM - DAY\n\n!sun **moon** moon\n',
  );
  await waitFor(() =>
    expect(
      view.state.selection.$head.parent.textContent.slice(
        view.state.selection.$head.parentOffset,
      ),
    ).toContain('moon'),
  );
  const one = view.state,
    oneSource = [...captureEditor(one).source];
  const all = screen.getByRole('button', { name: 'Replace all' });
  await waitFor(() => expect(all.hasAttribute('disabled')).toBe(false));
  fireEvent.click(all);
  await waitFor(() =>
    expect(new TextDecoder().decode(captureEditor(view.state).source)).toBe(
      '.INT. ROOM - DAY\n\n!sun **sun** sun\n',
    ),
  );
  expect(new TextDecoder().decode(captureEditor(view.state).source)).toBe(
    '.INT. ROOM - DAY\n\n!sun **sun** sun\n',
  );
  expect(undoDepth(view.state)).toBe(undoDepth(one) + 1);
  fireEvent.keyDown(view.dom, { key: 'z', ctrlKey: true });
  await waitFor(() =>
    expect([...captureEditor(view.state).source]).toEqual(oneSource),
  );
  expect(view.state.selection.eq(one.selection)).toBe(true);
  fireEvent.keyDown(view.dom, { key: 'z', ctrlKey: true });
  await waitFor(() =>
    expect(new TextDecoder().decode(captureEditor(view.state).source)).toBe(
      original,
    ),
  );
});

it('AUDIT-TEST WritingView Check script navigates without edits, refuses composition and refreshes after an edit', async () => {
  const original = '.INT. ROOM - DAY\n\n@ORPHAN\n';
  const { ports } = fixturePorts({ picked: auditDocument(original) });
  const view = await auditView(ports);
  fireEvent.click(screen.getByRole('button', { name: 'Script Check' }));
  const go = await screen.findByRole('button', { name: 'Go to issue' });
  await waitFor(() => expect(go.hasAttribute('disabled')).toBe(false));
  const before = view.state,
    depth = undoDepth(before);
  Object.defineProperty(view, 'composing', { configurable: true, value: true });
  fireEvent.click(go);
  expect(view.state).toBe(before);
  Reflect.deleteProperty(view, 'composing');
  fireEvent.click(go);
  expect(view.state.selection.$head.parent.type.name).toBe('character');
  expect(document.activeElement).toBe(view.dom);
  expect([...captureEditor(view.state).source]).toEqual([
    ...captureEditor(before).source,
  ]);
  // Selection is draft metadata and may advance its version; source and Undo stay intact.
  expect(view.state.doc).toBe(before.doc);
  expect(undoDepth(view.state)).toBe(depth);
  view.dispatch(
    view.state.tr.insertText(
      'NEW',
      view.state.selection.$head.start(),
      view.state.selection.$head.end(),
    ),
  );
  await screen.findByText(/stale, refresh to recompute/);
  expect(
    screen
      .getByRole('button', { name: 'Go to issue' })
      .hasAttribute('disabled'),
  ).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh check' }));
  await screen.findByText('Cue “NEW” has no dialogue.');
  expect(
    screen
      .getByRole('button', { name: 'Go to issue' })
      .hasAttribute('disabled'),
  ).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Go to issue' }));
  expect(view.state.selection.$head.parent.textContent).toBe('NEW');
  fireEvent.keyDown(view.dom, { key: 'z', ctrlKey: true });
  await waitFor(() =>
    expect(new TextDecoder().decode(captureEditor(view.state).source)).toBe(
      original,
    ),
  );
});

it.each([false, true])(
  'AUDIT-TEST WritingView prepared Restore protects first and handles adoption failure: %s',
  async (adoptionFails) => {
    const original = '.INT. ROOM - DAY\n\n!Draft\n',
      restored = Array.from(
        new TextEncoder().encode('.EXT. NEW - NIGHT\n\n!Snapshot\n'),
      );
    const { ports } = fixturePorts({
      picked: auditDocument(original),
      candidates: true,
    });
    const inspect = ports.recovery.inspect;
    ports.recovery.inspect = async (id) => ({
      ...(await inspect(id)),
      reconciled: true,
    });
    const compare = ports.choices.compare;
    ports.choices.compare = async (request) => ({
      ...(await compare(request)),
      transaction: 'confirmedRecordMatchesSource',
    });
    const entry = await ports.snapshots.create({
      checkpoint: {
        identity,
        version: 1,
        source: restored,
        sourceSha256: auditReceipt(1, restored).sourceSha256,
        expectedFingerprint: fingerprint(),
        draftMetadata: {},
      },
      kind: 'named',
      name: 'Saved version',
    });
    ports.snapshots.list = async () => ({
      entries: [entry!],
      sourceBytes: restored.length,
      needsAttention: false,
      unresolvedArtifacts: 0,
      orphanBlobs: 0,
      atLimit: false,
    });
    const order: string[] = [],
      create = ports.snapshots.create;
    ports.snapshots.create = vi.fn(async (request) => {
      order.push('protect');
      return create(request);
    });
    ports.snapshots.read = vi.fn(async () => {
      order.push('read');
      return { entry: entry!, source: restored };
    });
    const pending = deferred<void>();
    let restoreRequest:
      Parameters<typeof ports.snapshots.restore>[0] | undefined;
    ports.snapshots.restore = vi.fn(async (request) => {
      order.push('restore');
      restoreRequest = request;
      await pending.promise;
      return auditReceipt(request.newVersion, restored);
    });
    const resolve = vi.spyOn(ports.choices, 'resolve');
    ports.documents.save = vi.fn(async (request) =>
      auditReceipt(request.version, request.source),
    );
    const view = await auditView(ports),
      before = view.state;
    fireEvent.click(screen.getByText('Inspect retained recovery'));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Restore previous version' }),
    );
    await waitFor(() =>
      expect(ports.snapshots.restore).toHaveBeenCalledTimes(1),
    );
    expect(order).toEqual(['protect', 'read', 'restore']);
    expect(ports.snapshots.create).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'preDestructive',
        checkpoint: expect.objectContaining({
          source: [...captureEditor(before).source],
          version: editorVersion(before),
        }),
      }),
    );
    expect(restoreRequest!.replacementMetadata).toBeDefined();
    // An independently mounted recovery choice must not enter native resolve while restore owns the lock.
    fireEvent.click(
      await screen.findByRole('button', { name: 'Resolve Interrupted Save' }),
    );
    await screen.findByText(/Resolve did not complete/);
    expect(resolve).not.toHaveBeenCalled();
    if (adoptionFails)
      view.updateState(
        view.state.apply(
          view.state.tr.setSelection(TextSelection.create(view.state.doc, 2)),
        ),
      );
    pending.resolve();
    if (adoptionFails) {
      await screen.findByText(
        /Protection failed or its result could not be confirmed/,
      );
      expect([...captureEditor(view.state).source]).toEqual([
        ...captureEditor(before).source,
      ]);
      expect(undoDepth(view.state)).toBe(undoDepth(before));
      expect(screen.queryByText(/Restored as new version/)).toBeNull();
      // Simulate the native conflict after installation; no new baseline is invented.
      ports.documents.save = vi.fn(async (request) => {
        throw {
          identity: request.identity,
          version: request.version,
          error: { code: 'sourceChanged', action: 'reopenOrSaveCopy' },
          replacement: 'sourceUnchanged',
          recovery: null,
        };
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(ports.documents.save).toHaveBeenCalled());
      expect(
        vi.mocked(ports.documents.save).mock.calls[0]![0].expectedFingerprint,
      ).toEqual(auditDocument(original).fingerprint);
      await waitFor(() =>
        expect(
          screen.getByRole('region', { name: 'Protection status' }).textContent,
        ).toContain('External change detected'),
      );
    } else {
      await screen.findByText(/Restored as new version/);
      expect([...captureEditor(view.state).source]).toEqual(restored);
      expect(editorVersion(view.state)).toBe(restoreRequest!.newVersion);
      expect(undoDepth(view.state)).toBe(undoDepth(before) + 1);
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(ports.documents.save).toHaveBeenCalled());
      expect(
        vi.mocked(ports.documents.save).mock.calls[0]![0].expectedFingerprint,
      ).toEqual(auditReceipt(restoreRequest!.newVersion, restored).fingerprint);
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled'),
        ).toBe(false),
      );
      fireEvent.keyDown(view.dom, { key: 'z', ctrlKey: true });
      await waitFor(() =>
        expect([...captureEditor(view.state).source]).toEqual([
          ...captureEditor(before).source,
        ]),
      );
      expect(view.state.selection.eq(before.selection)).toBe(true);
    }
  },
);

it.each([false, true])(
  'AUDIT-TEST WritingView resolves exact native receipts, refusing foreign identity: %s',
  async (foreign) => {
    const { ports } = fixturePorts({ picked: opened(), candidates: true });
    const compare = ports.choices.compare;
    ports.choices.compare = async (request) => ({
      ...(await compare(request)),
      transaction: 'confirmedRecordMatchesSource',
    });
    ports.choices.resolve = vi.fn(async () => ({
      identity: foreign ? { ...identity, handle: 'foreign' } : identity,
      observation: 'confirmedRecordMatchesSource' as const,
      completed: receiptFor(2),
      previousPreserved: true,
    }));
    const inspect = ports.recovery.inspect;
    ports.recovery.inspect = async (id) => ({
      ...(await inspect(id)),
      reconciled:
        !foreign && vi.mocked(ports.choices.resolve).mock.calls.length > 0,
    });
    const save = vi.spyOn(ports.documents, 'save');
    const view = await auditView(ports),
      before = view.state;
    fireEvent.click(
      await screen.findByRole('button', { name: 'Resolve Interrupted Save' }),
    );
    if (foreign) await screen.findByText(/Resolve did not complete/);
    else await screen.findByText(/An interrupted save was confirmed/);
    expect(view.state.doc).toBe(before.doc);
    expect(view.state.selection.eq(before.selection)).toBe(true);
    expect(undoDepth(view.state)).toBe(undoDepth(before));
    expect(ports.choices.resolve).toHaveBeenCalledExactlyOnceWith(identity);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0]![0].expectedFingerprint).toEqual(
      foreign ? opened().fingerprint : receiptFor(2).fingerprint,
    );
  },
);

// AUDIT-SLP-A: assert the mounted safety surface, rather than an unused component.
it.each([
  {
    label: 'saved',
    status: 'Saved locally' as const,
    journaledVersion: 21,
    fileSavedVersion: 21,
    snapshotAttention: false,
    lastRollingVersion: 21,
    onlyInMemory: false,
  },
  {
    label: 'snapshot attention',
    status: 'Saved locally' as const,
    journaledVersion: 21,
    fileSavedVersion: 21,
    snapshotAttention: true,
    lastRollingVersion: null,
    onlyInMemory: false,
  },
  {
    label: 'failure',
    status: 'Save failed' as const,
    journaledVersion: 20,
    fileSavedVersion: 19,
    snapshotAttention: true,
    lastRollingVersion: null,
    onlyInMemory: true,
  },
  {
    label: 'divergence',
    status: 'External change detected' as const,
    journaledVersion: 21,
    fileSavedVersion: 19,
    snapshotAttention: false,
    lastRollingVersion: 20,
    onlyInMemory: false,
  },
])(
  'mounted Protection status reports exact facts for $label',
  async (sample) => {
    vi.spyOn(SaveCadence.prototype, 'describe').mockReturnValue({
      liveVersion: 21,
      status: sample.status,
      journaledVersion: sample.journaledVersion,
      fileSavedVersion: sample.fileSavedVersion,
      snapshotAttention: sample.snapshotAttention,
      lastRollingVersion: sample.lastRollingVersion,
    });
    vi.spyOn(ProtectedClose.prototype, 'assessment', 'get').mockReturnValue({
      phase: 'editing',
      liveVersion: 21,
      sourceProtected: !sample.onlyInMemory,
      recoveryProtected: !sample.onlyInMemory,
      onlyInMemory: sample.onlyInMemory,
      message: '',
    });
    const { ports } = fixturePorts({});
    render(
      <WritingView
        ports={ports}
        open={{ kind: 'new' }}
        onSessionClosed={vi.fn()}
      />,
    );
    await screen.findByLabelText('Screenplay actions');
    const region = screen.getByRole('region', { name: 'Protection status' });
    await waitFor(() =>
      expect(region.textContent).toContain('Live version 21.'),
    );
    expect(within(region).getByRole('status').textContent).toBe(sample.status);
    const details = region.querySelector('details')!;
    expect(details.open).toBe(false);
    const text = details.textContent!;
    expect(text).toContain(
      `Recovery: journaled version ${sample.journaledVersion}.`,
    );
    expect(text).toContain(
      `Source file: ${sample.status} (saved version ${sample.fileSavedVersion}).`,
    );
    expect(text).toContain(
      `Snapshots: ${sample.snapshotAttention ? 'need attention' : 'healthy'}`,
    );
    expect(text).toContain(
      sample.lastRollingVersion === null
        ? 'no rolling snapshot yet'
        : `last rolling version ${sample.lastRollingVersion}`,
    );
    expect(
      within(region)
        .queryAllByRole('alert')
        .some(
          (alert) =>
            alert.textContent ===
            'Newer changes exist only in memory until protection is confirmed.',
        ),
    ).toBe(sample.onlyInMemory);
  },
);

// AUDIT-D06: mounted routing must preserve the coordinator's exact protection gate.
it('AUDIT-D06 automatically closes a file only after exact save and release, rejecting duplicate requests', async () => {
  const f = fixturePorts({ picked: opened() });
  const saved = deferred<void>(),
    released = deferred<void>();
  f.ports.documents.save = vi.fn(async (request) => {
    await saved.promise;
    return receiptFor(request.version, request.sourceSha256 === B);
  });
  f.ports.documents.release = vi.fn(() => released.promise);
  const closed = vi.fn(),
    next = vi.fn();
  render(
    <WritingView
      ports={f.ports}
      open={{ kind: 'picked' }}
      onSessionClosed={closed}
      onOpenRequested={next}
    />,
  );
  const actions = await screen.findByLabelText('Screenplay actions');
  const editor = document.querySelector<HTMLElement>('.ProseMirror')!;
  fireEvent.click(
    within(actions).getByRole('button', { name: 'Close session' }),
  );
  fireEvent.click(within(actions).getByRole('button', { name: 'Home' }));
  await waitFor(() => expect(f.ports.documents.save).toHaveBeenCalledOnce());
  expect(
    screen.queryByRole('button', { name: 'Retry save and close' }),
  ).toBeNull();
  expect(editor.getAttribute('contenteditable')).toBe('false');
  expect(f.ports.documents.release).not.toHaveBeenCalled();
  expect(closed).not.toHaveBeenCalled();
  saved.resolve();
  await waitFor(() => expect(f.ports.documents.release).toHaveBeenCalledOnce());
  expect(closed).not.toHaveBeenCalled();
  released.resolve();
  await waitFor(() => expect(closed).toHaveBeenCalledOnce());
  expect(next).not.toHaveBeenCalled();
});

it.each(['stale receipt', 'release failure'] as const)(
  'AUDIT-D06 retains the editor on automatic close %s and Keep writing permits edits',
  async (failure) => {
    const f = fixturePorts({ picked: opened() });
    if (failure === 'stale receipt')
      f.ports.documents.save = vi.fn(async () => receiptFor(0));
    else
      f.ports.documents.release = vi.fn(async () => {
        throw { code: 'io' };
      });
    const closed = vi.fn();
    render(
      <WritingView
        ports={f.ports}
        open={{ kind: 'picked' }}
        onSessionClosed={closed}
      />,
    );
    await screen.findByLabelText('Screenplay actions');
    const editor = document.querySelector<HTMLElement>('.ProseMirror')!;
    fireEvent.click(screen.getByRole('button', { name: 'Close session' }));
    await screen.findByText(/Close stopped\./);
    expect(
      screen.getByRole('button', { name: 'Retry save and close' }),
    ).toBeTruthy();
    expect(closed).not.toHaveBeenCalled();
    expect(document.querySelector('.ProseMirror')).toBe(editor);
    expect(editor.getAttribute('contenteditable')).toBe('true');
    fireEvent.click(
      within(
        screen.getByRole('region', { name: 'Close document safely' }),
      ).getByRole('checkbox'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Keep writing' }));
    expect(
      screen.queryByRole('button', { name: 'Close with this risk' }),
    ).toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    fireEvent.paste(editor, {
      clipboardData: {
        getData: (type: string) => (type === 'text/plain' ? 'retained ' : ''),
      },
    });
    await waitFor(() => expect(editor.textContent).toContain('retained '));
    expect(document.activeElement).toBe(editor);
  },
);

it('AUDIT-D06 untitled close requires a choice and cancellation clears an Open request', async () => {
  const f = fixturePorts({}),
    closed = vi.fn(),
    next = vi.fn();
  render(
    <WritingView
      ports={f.ports}
      open={{ kind: 'new' }}
      onSessionClosed={closed}
      onOpenRequested={next}
    />,
  );
  await screen.findByRole('button', { name: 'Protect draft' });
  const before = f.calls.checkpoint;
  fireEvent.click(screen.getByRole('button', { name: 'Run Open' }));
  const keep = await screen.findByRole('button', { name: 'Keep writing' });
  expect(screen.getByText(/This draft has no Fountain file/)).toBeTruthy();
  expect(f.calls.checkpoint).toBe(before);
  expect(f.calls.released).toBe(0);
  fireEvent.click(keep);
  fireEvent.click(screen.getByRole('button', { name: 'Close session' }));
  fireEvent.click(
    await screen.findByRole('button', { name: 'Close and keep recovery' }),
  );
  await waitFor(() => expect(closed).toHaveBeenCalledOnce());
  expect(next).not.toHaveBeenCalled();
  expect(f.calls.released).toBe(1);
  expect(f.calls.checkpoint).toBeGreaterThan(before);
});

it('AUDIT-D06 read-only close releases automatically without a source save', async () => {
  const f = fixturePorts({
    picked: {
      ...opened(),
      ownership: { status: 'viewOnly', reasons: ['alreadyOwned'] },
    },
  });
  const closed = vi.fn();
  render(
    <WritingView
      ports={f.ports}
      open={{ kind: 'picked' }}
      onSessionClosed={closed}
    />,
  );
  await screen.findByLabelText('Screenplay actions');
  fireEvent.click(screen.getByRole('button', { name: 'Home' }));
  await waitFor(() => expect(closed).toHaveBeenCalledOnce());
  expect(f.calls.saved).toHaveLength(0);
  expect(f.calls.released).toBe(1);
  expect(
    screen.queryByRole('button', { name: 'Retry save and close' }),
  ).toBeNull();
});

it('AUDIT-D06 presents a plain status, closed save details and separate protection alerts', async () => {
  const f = fixturePorts({ picked: opened() });
  vi.spyOn(SaveCadence.prototype, 'describe').mockReturnValue({
    liveVersion: 21,
    status: 'Saved locally',
    journaledVersion: 21,
    fileSavedVersion: 21,
    snapshotAttention: true,
    lastRollingVersion: 19,
  });
  vi.spyOn(ProtectedClose.prototype, 'assessment', 'get').mockReturnValue({
    phase: 'editing',
    liveVersion: 21,
    sourceProtected: false,
    recoveryProtected: false,
    onlyInMemory: true,
    message: '',
  });
  render(
    <WritingView
      ports={f.ports}
      open={{ kind: 'picked' }}
      onSessionClosed={vi.fn()}
    />,
  );
  await screen.findByLabelText('Screenplay actions');
  const region = screen.getByRole('region', { name: 'Protection status' });
  expect(within(region).getByRole('status').textContent).toBe('Saved locally');
  const details = region.querySelector('details')!;
  expect(details.open).toBe(false);
  expect(details.textContent).toContain('Recovery: journaled version 21.');
  expect(details.textContent).toContain('saved version 21');
  expect(
    within(region)
      .getAllByRole('alert')
      .map((el) => el.textContent),
  ).toEqual(
    expect.arrayContaining([
      'Snapshots need attention.',
      'Newer changes exist only in memory until protection is confirmed.',
    ]),
  );
});

async function nativeCloseRequest() {
  const events = await import('@tauri-apps/api/event');
  const windows = await import('@tauri-apps/api/window');
  const { nativeCommands } =
    await import('../../src/infrastructure/nativeCommands');
  Object.defineProperty(window, '__TAURI_INTERNALS__', {
    configurable: true,
    value: {},
  });
  let request: (() => void) | undefined;
  vi.mocked(events.listen).mockImplementation(async (name, callback) => {
    if (name === 'protected-close-requested')
      request = () => callback({ event: name, id: 1, payload: null as never });
    return vi.fn<() => void>();
  });
  vi.spyOn(nativeCommands, 'listen').mockResolvedValue(vi.fn<() => void>());
  vi.spyOn(nativeCommands, 'publish').mockResolvedValue();
  const closeWindow = vi.fn(async () => {});
  vi.mocked(windows.getCurrentWindow).mockReturnValue({
    close: closeWindow,
  } as unknown as ReturnType<typeof windows.getCurrentWindow>);
  return {
    request: async () => {
      await waitFor(() => expect(request).toBeDefined());
      await act(async () => request!());
    },
    closeWindow,
  };
}

it('AUDIT-D06 native window requests wait for source and release once, without redirecting Home', async () => {
  const native = await nativeCloseRequest(),
    f = fixturePorts({ picked: opened() });
  const pending = deferred<void>();
  f.ports.documents.save = vi.fn(async (request) => {
    await pending.promise;
    return receiptFor(request.version, request.sourceSha256 === B);
  });
  const closed = vi.fn();
  render(
    <WritingView
      ports={f.ports}
      open={{ kind: 'picked' }}
      onSessionClosed={closed}
    />,
  );
  await screen.findByLabelText('Screenplay actions');
  await native.request();
  await native.request();
  await waitFor(() => expect(f.ports.documents.save).toHaveBeenCalledOnce());
  expect(f.calls.released).toBe(0);
  expect(native.closeWindow).not.toHaveBeenCalled();
  await act(async () => pending.resolve());
  await waitFor(() => expect(native.closeWindow).toHaveBeenCalledOnce());
  expect(f.calls.released).toBe(1);
  expect(closed).not.toHaveBeenCalled();
});

it('AUDIT-D06 cancelled untitled window close clears its destination before Home close', async () => {
  const native = await nativeCloseRequest(),
    f = fixturePorts({}),
    closed = vi.fn();
  render(
    <WritingView
      ports={f.ports}
      open={{ kind: 'new' }}
      onSessionClosed={closed}
    />,
  );
  await screen.findByRole('button', { name: 'Protect draft' });
  await native.request();
  expect(f.calls.released).toBe(0);
  fireEvent.click(await screen.findByRole('button', { name: 'Keep writing' }));
  fireEvent.click(screen.getByRole('button', { name: 'Home' }));
  fireEvent.click(
    await screen.findByRole('button', { name: 'Close and keep recovery' }),
  );
  await waitFor(() => expect(closed).toHaveBeenCalledOnce());
  expect(native.closeWindow).not.toHaveBeenCalled();
});

it('AUDIT-D03B places the navigator and tool panels in shell regions without reordering or remounting the editor', async () => {
  const fixture = fixturePorts({ picked: opened() });
  const view = render(
    <WritingView
      ports={fixture.ports}
      open={{ kind: 'picked' }}
      onSessionClosed={vi.fn()}
    />,
  );
  const actions = await screen.findByLabelText('Screenplay actions');
  const main = actions.closest('main')!;
  const editor = document.querySelector<HTMLElement>('.ProseMirror')!;
  const host = screen.getByLabelText('Screenplay editor');
  await waitFor(() =>
    expect(document.querySelector('.manuscript-outline')).toBeTruthy(),
  );
  // The sticky header stays first; its measured height feeds the sticky columns.
  expect(main.firstElementChild?.className).toBe('writing-presentation');
  expect(
    document.documentElement.style.getPropertyValue('--writing-header'),
  ).toBe('0px');
  const sidebar = main.querySelector(':scope > .writing-sidebar')!;
  expect(sidebar.querySelector('.manuscript-outline')).toBeTruthy();
  expect(sidebar.querySelector('.character-panel')).toBeTruthy();
  expect(sidebar.getAttribute('role')).toBeNull();
  const body = main.querySelector(':scope > .writing-body')!;
  expect(host.parentElement).toBe(body);
  expect(actions.parentElement).toBe(
    main.querySelector(':scope > .writing-top'),
  );
  // No empty drawer region while every tool panel is closed.
  expect(main.querySelector('.writing-drawer')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Find' }));
  await waitFor(() =>
    expect(document.querySelector('.find-panel')).toBeTruthy(),
  );
  const drawer = main.querySelector(':scope > .writing-drawer')!;
  expect(drawer.querySelector('.find-panel')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Script Check' }));
  await waitFor(() =>
    expect(drawer.querySelector('.check-panel')).toBeTruthy(),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Title page' }));
  await waitFor(() =>
    expect(drawer.querySelector('.title-page-panel')).toBeTruthy(),
  );
  // Keyboard order is unchanged: actions, tools, navigator, then the editor.
  const follows = (first: Element, second: Element) =>
    Boolean(
      first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
  expect(follows(actions, drawer)).toBe(true);
  expect(follows(drawer, sidebar)).toBe(true);
  expect(follows(sidebar, host)).toBe(true);
  expect(document.querySelector('.ProseMirror')).toBe(editor);
  expect(screen.getByLabelText('Screenplay editor')).toBe(host);
  view.unmount();
  expect(
    document.documentElement.style.getPropertyValue('--writing-header'),
  ).toBe('');
});

// AUDIT-PARK: D-05 observation "replace-all has no pre-destructive protection
// and relies on Undo". Confirmed as current behavior; SPEC S07 asks only for one
// Undo step and a count, so any protection belongs to the D-05 brief.
it('AUDIT-PARK replace-all takes no snapshot or workflow protection; one Undo restores it', async () => {
  const original = '.INT. ROOM - DAY\n\n!moon moon\n\n!moon\n';
  const { ports } = fixturePorts({ picked: auditDocument(original) });
  const create = vi.spyOn(ports.snapshots, 'create');
  const protect = vi.spyOn(ports.workflows, 'protect');
  const view = await auditView(ports);
  fireEvent.click(screen.getByRole('button', { name: 'Find' }));
  fireEvent.change(await screen.findByLabelText('Find text'), {
    target: { value: 'moon' },
  });
  await screen.findByText('3 matches.');
  fireEvent.change(screen.getByLabelText('Replace with'), {
    target: { value: 'sun' },
  });
  const all = screen.getByRole('button', { name: 'Replace all' });
  await waitFor(() => expect(all.hasAttribute('disabled')).toBe(false));
  const depth = undoDepth(view.state);
  fireEvent.click(all);
  await screen.findByText(/Replaced 3 matches in one step/);
  expect(new TextDecoder().decode(captureEditor(view.state).source)).toBe(
    '.INT. ROOM - DAY\n\n!sun sun\n\n!sun\n',
  );
  expect(
    create.mock.calls.filter(([request]) => request.kind !== 'rolling'),
  ).toEqual([]);
  expect(protect).not.toHaveBeenCalled();
  expect(undoDepth(view.state)).toBe(depth + 1);
  fireEvent.keyDown(view.dom, { key: 'z', ctrlKey: true });
  await waitFor(() =>
    expect(new TextDecoder().decode(captureEditor(view.state).source)).toBe(
      original,
    ),
  );
});

// AUDIT-PARK-H follow-ups: supported new rows capture without blocking other
// authored text. These mounted UI tests use mocked native ports.
async function parkedDraft(original: string) {
  const { ports, calls } = fixturePorts({ picked: auditDocument(original) });
  const text = (source: readonly number[]) =>
    new TextDecoder().decode(Uint8Array.from(source));
  const saved: string[] = [];
  const journaled: string[] = [];
  const checkpoint = ports.documents.checkpoint;
  ports.documents.checkpoint = async (request) => {
    journaled.push(text(request.source));
    return checkpoint(request);
  };
  ports.documents.save = async (request) => {
    saved.push(text(request.source));
    return auditReceipt(request.version, request.source);
  };
  const copy = vi.spyOn(ports.snapshots, 'copy');
  const view = await auditView(ports);
  const endOf = (row: number) => {
    let at = 0;
    for (let index = 0; index < row; index++)
      at += view.state.doc.child(index).nodeSize;
    return at + view.state.doc.child(row).nodeSize - 1;
  };
  return {
    calls,
    saved,
    journaled,
    copy,
    view,
    endOf,
    rows: () =>
      view.state.doc.content.content.map(
        (node) => `${node.type.name}:${node.textContent}`,
      ),
    caret: (at: number) =>
      view.dispatch(
        view.state.tr.setSelection(TextSelection.create(view.state.doc, at)),
      ),
    status: () =>
      within(screen.getByLabelText('Protection status')).getByRole('status')
        .textContent,
    /** Longer than the cadence's two-second dirty ceiling. */
    settle: () => new Promise((resolve) => setTimeout(resolve, 2600)),
    close: () =>
      fireEvent.click(
        within(screen.getByLabelText('Screenplay actions')).getByRole(
          'button',
          { name: 'Close session' },
        ),
      ),
  };
}

it('AUDIT-PARK-H-F2 an empty Scene Heading keeps unrelated edits saved and journaled; completion and ordinary close succeed', async () => {
  const f = await parkedDraft('!Alpha.\n');
  const { view, saved, journaled } = f;

  // An ordinary edit is captured and reaches the source file.
  view.dispatch(view.state.tr.insertText(' Beta.', f.endOf(0)));
  await waitFor(() => expect(saved.at(-1)).toBe('!Alpha. Beta.\n'), {
    timeout: 4000,
  });

  // Enter, then Ctrl+1: the heading is a physical blank with recovery intent.
  // Enter adds the S07.2 separator and new row after it.
  f.caret(f.endOf(0));
  fireEvent.keyDown(view.dom, { key: 'Enter' });
  fireEvent.keyDown(view.dom, { key: '1', ctrlKey: true });
  const empty = ['action:', 'sceneHeading:'];
  expect(f.rows()).toEqual(['action:Alpha. Beta.', ...empty]);
  expect(captureEditor(view.state).document.lines[2]!.intendedKind).toBe(
    'sceneHeading',
  );
  await waitFor(() => expect(saved.at(-1)).toBe('!Alpha. Beta.\n\n\n'), {
    timeout: 4000,
  });

  // Text typed in another row while the heading is empty is real author work.
  // It must reach both the source and recovery while the heading stays empty.
  view.dispatch(view.state.tr.insertText('Gamma. ', 1));
  expect(f.rows()[0]).toBe('action:Gamma. Alpha. Beta.');
  const expected = '!Gamma. Alpha. Beta.\n\n\n';
  await waitFor(() => expect(saved.at(-1)).toBe(expected), { timeout: 4000 });
  expect(journaled).toContain(expected);
  await waitFor(() => expect(f.status()).toBe('Saved locally'));
  expect(screen.queryByText(/cannot round-trip unambiguously/)).toBeNull();
  expect(f.rows()).toEqual(['action:Gamma. Alpha. Beta.', ...empty]);

  // Completion drops sparse intent and saves an ordinary forced heading.
  view.dispatch(view.state.tr.insertText('X', f.endOf(2)));
  await waitFor(
    () => expect(saved.at(-1)).toBe('!Gamma. Alpha. Beta.\n\n.X\n'),
    { timeout: 4000 },
  );
  await waitFor(() =>
    expect(screen.queryByText(/cannot round-trip unambiguously/)).toBeNull(),
  );
  expect(
    captureEditor(view.state).document.lines[2]!.intendedKind,
  ).toBeUndefined();
  f.close();
  await waitFor(() => expect(f.calls.released).toBe(1));
  expect(screen.queryByText(/Close stopped/)).toBeNull();
  expect(f.copy).not.toHaveBeenCalled();
}, 20000);

it.each([
  ['note', '[[]]', '[[remember]]'],
  ['boneyard', '/**/', '/*remember*/'],
])(
  'AUDIT-PARK-H-F1 a new %s row and later edits save and journal; close succeeds',
  async (kind, empty, populated) => {
    const f = await parkedDraft('!Alpha.\n');
    const { view, saved, journaled } = f;
    const picker = screen.getByLabelText('Element');

    f.caret(f.endOf(0));
    fireEvent.keyDown(view.dom, { key: 'Enter' });
    fireEvent.change(picker, { target: { value: kind } });
    expect(f.rows()).toEqual(['action:Alpha.', 'action:', `${kind}:${empty}`]);
    const emptySource = `!Alpha.\n\n${empty}\n`;
    expect(new TextDecoder().decode(captureEditor(view.state).source)).toBe(
      emptySource,
    );
    await waitFor(() => expect(saved.at(-1)).toBe(emptySource), {
      timeout: 4000,
    });
    expect(journaled).toContain(emptySource);

    view.dispatch(view.state.tr.insertText('remember'));
    view.dispatch(view.state.tr.insertText('Gamma. ', 1));
    const final = `!Gamma. Alpha.\n\n${populated}\n`;
    await waitFor(() => expect(saved.at(-1)).toBe(final), { timeout: 4000 });
    expect(journaled).toContain(final);
    expect(f.rows()).toEqual([
      'action:Gamma. Alpha.',
      'action:',
      `${kind}:${populated}`,
    ]);
    expect(screen.queryByText(/Hidden conversion lost/)).toBeNull();
    await waitFor(() => expect(f.status()).toBe('Saved locally'));

    // Removing wrappers remains a separate reviewed operation; the refusal
    // retains the complete captured source and does not interrupt saving.
    f.caret(f.endOf(2) - 2);
    fireEvent.change(picker, { target: { value: 'action' } });
    await screen.findByText(
      /(?:note needs an explicit|Omitted source requires a reviewed) whole-region conversion/,
    );
    expect(new TextDecoder().decode(captureEditor(view.state).source)).toBe(
      final,
    );
    f.close();
    await waitFor(() => expect(f.calls.released).toBe(1));
    expect(f.copy).not.toHaveBeenCalled();
    expect(screen.queryByText(/Close stopped/)).toBeNull();
  },
  20000,
);

it('AUDIT-PARK-H-F3 a refused row is named with how to resume; saving stays paused until it changes', async () => {
  const f = await parkedDraft('@BOB\n(beat)\nHi.\n');
  const { view, saved, journaled } = f;
  const paused =
    'Saving and recovery are paused. Row 2, the Parenthetical “(beat) x”, cannot be saved as Fountain as it stands. A Parenthetical keeps all of its text inside one pair of parentheses. Change that row or Undo to resume. To keep the draft exactly as it is, use Close session, then Save Emergency Copy and close.';
  const protection = within(screen.getByLabelText('Protection status'));
  const alerts = () =>
    protection.queryAllByRole('alert').map((alert) => alert.textContent);

  // An ordinary edit is captured and reaches the source file.
  view.dispatch(view.state.tr.insertText(' Sure.', f.endOf(2)));
  await waitFor(() => expect(saved.at(-1)).toBe('@BOB\n(beat)\nHi. Sure.\n'), {
    timeout: 4000,
  });
  await waitFor(() => expect(f.status()).toBe('Saved locally'));
  expect(alerts()).toEqual([]);

  // The editor accepts text after the closing parenthesis; Fountain cannot hold it.
  view.dispatch(view.state.tr.insertText(' x', f.endOf(1)));
  expect(f.rows()[1]).toBe('parenthetical:(beat) x');
  await waitFor(() => expect(alerts()).toContain(paused));
  expect(screen.queryByText(/must be wrapped|round-trip/)).toBeNull();

  // Author work typed in another row meanwhile is not saved or journaled.
  view.dispatch(view.state.tr.insertText(' Fine.', f.endOf(2)));
  const before = [saved.length, journaled.length];
  await f.settle();
  expect([saved.length, journaled.length]).toEqual(before);
  expect(f.status()).toBe('Changes pending');
  expect(alerts()).toEqual([
    'Newer changes exist only in memory until protection is confirmed.',
    paused,
  ]);

  // An explicit Save reports the same row in the same words.
  fireEvent.click(
    within(screen.getByLabelText('Screenplay actions')).getByRole('button', {
      name: 'Save',
    }),
  );
  await waitFor(() => expect(alerts()).toContain(paused));
  expect(screen.queryByText(/must be wrapped|round-trip/)).toBeNull();
  expect([saved.length, journaled.length]).toEqual(before);

  // Changing the named row resumes capture; nothing typed meanwhile is lost.
  view.dispatch(view.state.tr.delete(f.endOf(1) - 2, f.endOf(1)));
  const resumed = '@BOB\n(beat)\nHi. Sure. Fine.\n';
  await waitFor(() => expect(saved.at(-1)).toBe(resumed), { timeout: 4000 });
  expect(journaled).toContain(resumed);
  await waitFor(() => expect(f.status()).toBe('Saved locally'));
  await waitFor(() => expect(alerts()).toEqual([]));
  f.close();
  await waitFor(() => expect(f.calls.released).toBe(1));
  expect(screen.queryByText(/Close stopped/)).toBeNull();
  expect(f.copy).not.toHaveBeenCalled();
}, 20000);
