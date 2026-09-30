/** M3-12 writing surface: open/edit/save/close flows with injected ports. */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { WritingView, type WritingPorts } from '../../src/app/WritingView';
import type { OpenDocument } from '../../src/application/documents';
import {
  A,
  B,
  fingerprint,
  identity,
  opened,
  receiptFor,
  receipt,
} from '../contract/persistence-fixtures';

afterEach(cleanup);

function unsaved(): OpenDocument {
  return {
    ...opened(),
    kind: 'unsaved',
    persistentIdentity: false,
    fingerprint: null,
    source: [],
  };
}

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
    fireEvent.change(screen.getByLabelText('Fountain screenplay to import'), {
      target: { value: '!Replacement.' },
    });
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
