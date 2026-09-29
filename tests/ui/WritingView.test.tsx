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
import { WritingView, type WritingPorts } from '../../src/app/WritingView';
import type { OpenDocument } from '../../src/application/documents';
import {
  A,
  B,
  fingerprint,
  identity,
  opened,
  receiptFor,
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
