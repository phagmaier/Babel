import { TextSelection } from 'prosemirror-state';
/** M3-12 writing surface: open/edit/save/close flows with injected ports. */
import {
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
      readInitial: async (id) => ({ ...opened(), identity: { ...id } }),
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
    fountainImport: {
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

  it('opens a draft, protects it explicitly, and reports four distinct protection facts', async () => {
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
    for (const label of [
      'Recovery:',
      'Source file:',
      'Snapshots:',
      'History',
    ]) {
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
      await screen.findByRole('button', { name: 'Retry save and close' }),
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
      await screen.findByRole('button', { name: 'Recover as Current' }),
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
      await screen.findByRole('button', { name: 'Recover as Current' }),
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
      await screen.findByRole('button', { name: 'Retry save and close' }),
    );
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
        expect(screen.getByText(/Recovery: journaled/).textContent).toContain(
          'Saved locally',
        ),
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
      await screen.findByRole('button', { name: 'Retry save and close' }),
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
    ports.workflows = workflows;
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
  ports.documents.readInitial = async (id) => ({
    ...opened(),
    identity: id,
    source: [...new TextEncoder().encode(literal)],
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
  expect(screen.getByRole('alert').textContent).toContain(
    'could not be stored',
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
  await screen.findByRole('button', { name: 'Retry save and close' });
  fireEvent.click(screen.getByRole('button', { name: 'Retry save and close' }));
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
  expect((await screen.findByRole('alert')).textContent).toContain(
    'Parenthetical must be wrapped',
  );
  view.dispatch(view.state.tr.delete(start, start + 1));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
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
