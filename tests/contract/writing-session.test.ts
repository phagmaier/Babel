/** M3-12 writing lifecycle: Save As identity switch, export copy, external adoption, close wiring. */
import { describe, expect, it, vi } from 'vitest';
import type {
  DocumentIdentity,
  DocumentPort,
  OpenDocument,
} from '../../src/application/documents';
import type { DocumentEntryPort } from '../../src/application/documentEntry';
import type { SaveAsPort } from '../../src/application/saveAs';
import type { SnapshotPort } from '../../src/application/snapshots';
import type { CapturedSnapshot } from '../../src/application/persistenceController';
import {
  WritingSession,
  type SessionEditor,
  type SessionPorts,
  type SessionSelection,
} from '../../src/application/writingSession';
import { A, B, fingerprint, opened, receiptFor } from './persistence-fixtures';

function fakeClock() {
  let now = 0;
  const queue: { at: number; fn: () => void }[] = [];
  const clock = {
    now: () => now,
    setTimeout: (fn: () => void, ms: number) => {
      const handle = { at: now + ms, fn };
      queue.push(handle);
      return handle;
    },
    clearTimeout: (handle: unknown) => {
      const index = queue.indexOf(handle as { at: number; fn: () => void });
      if (index >= 0) queue.splice(index, 1);
    },
    advance: async (ms: number) => {
      now += ms;
      queue.sort((a, b) => a.at - b.at);
      while (queue.length > 0 && queue[0]!.at <= now) {
        const next = queue.shift()!;
        next.fn();
        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    },
  };
  return clock;
}

class FakeEditor implements SessionEditor {
  retain() {
    const current = this.current,
      selection = this.selection,
      writable = this.writable;
    return () => {
      this.current = current;
      this.selection = selection;
      this.writable = writable;
    };
  }
  async prepareSource(source: readonly number[], version: number) {
    const before = this.current;
    this.sourceWas(source, version);
    const snapshot = this.current;
    this.current = before;
    return { snapshot, apply: () => this.applySource(source, version) };
  }
  advanceVersion(version: number) {
    this.current = { ...this.current, version };
  }
  getVersion() {
    return this.current.version;
  }
  async captureDraft() {
    return this.current;
  }
  current: CapturedSnapshot = {
    version: 1,
    source: [97],
    sourceSha256: A,
    draftMetadata: {},
  };
  selection: SessionSelection | null = null;
  loaded: { source: readonly number[]; selection: SessionSelection | null }[] =
    [];
  applied: number[][] = [];
  frozen = false;
  writable = true;
  loadInitial(
    source: readonly number[],
    selection: SessionSelection | null,
    writable = true,
    initialVersion = 1,
  ): void {
    this.writable = writable;
    this.loaded.push({ source, selection });
    this.sourceWas(source, initialVersion);
  }
  applySource(source: readonly number[], version: number): void {
    this.applied.push([...source]);
    this.sourceWas(source, version);
  }
  sourceWas(source: readonly number[], version: number): void {
    const bytes = [...source];
    this.current = {
      version,
      source: bytes,
      sourceSha256:
        bytes.length === 1 && bytes[0] === 97
          ? A
          : bytes.length === 1 && bytes[0] === 98
            ? B
            : 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      draftMetadata: {},
    };
  }
  async capture(): Promise<CapturedSnapshot> {
    return this.current;
  }
  freeze(): () => void {
    expect(this.frozen).toBe(false);
    this.frozen = true;
    return () => {
      this.frozen = false;
    };
  }
  getSelection(): SessionSelection | null {
    return this.selection;
  }
  setSelection(selection: SessionSelection | null): void {
    this.selection = selection;
  }
}

const freshIdentity = (): DocumentIdentity => ({
  handle: '44444444-4444-4444-8444-444444444444',
  documentId: '55555555-5555-4555-8555-555555555555',
  sessionId: '66666666-6666-4666-8666-666666666666',
});

function ports(overrides: Partial<SessionPorts> = {}): {
  ports: SessionPorts;
  entry: {
    picked: OpenDocument | null;
    destination: { token: string; storageRelation: 'sameFilesystem' } | null;
  };
  documents: { released: DocumentIdentity[]; saved: number[] };
  saveAs: {
    target: {
      token: string;
      fileName: string;
      storageRelation: 'sameFilesystem';
    } | null;
    fail: boolean;
    published: boolean;
  };
  snapshots: { createFails: boolean };
} {
  const entry = {
    picked: null as OpenDocument | null,
    destination: null as {
      token: string;
      storageRelation: 'sameFilesystem';
    } | null,
  };
  const documents = {
    released: [] as DocumentIdentity[],
    saved: [] as number[],
  };
  const saveAs = {
    target: null as {
      token: string;
      fileName: string;
      storageRelation: 'sameFilesystem';
    } | null,
    fail: false,
    published: false,
  };
  const snapshots = { createFails: false };
  const documentPort: DocumentPort = {
    release: vi.fn(async (id) => {
      documents.released.push({ ...id });
    }),
    releaseAtRisk: vi.fn(async () => undefined),
    checkpoint: vi.fn(async (request) => ({
      identity: { ...request.identity },
      version: request.version,
      sourceSha256: request.sourceSha256,
      generation: request.version,
      protection: 'recoveryCheckpoint' as const,
    })),
    save: vi.fn(async (request) => {
      documents.saved.push(request.version);
      return receiptFor(request.version, request.sourceSha256 === B);
    }),
  };
  const snapshotPort: SnapshotPort = {
    list: vi.fn(async () => ({
      entries: [],
      sourceBytes: 0,
      needsAttention: false,
      unresolvedArtifacts: 0,
      orphanBlobs: 0,
      atLimit: false,
    })),
    read: vi.fn(async () => {
      throw new Error('unreachable');
    }),
    create: vi.fn(async () => {
      if (snapshots.createFails)
        throw { code: 'snapshotNeedsAttention', action: 'retry' };
      return null;
    }),
    prune: vi.fn(async () => ({
      entries: [],
      sourceBytes: 0,
      needsAttention: false,
      unresolvedArtifacts: 0,
      orphanBlobs: 0,
      atLimit: false,
    })),
    restore: vi.fn(async () => {
      throw new Error('unreachable');
    }),
    copy: vi.fn(async ({ checkpoint }) => ({
      identity: { ...checkpoint.identity },
      version: checkpoint.version,
      sourceSha256: checkpoint.sourceSha256,
      byteLength: checkpoint.source.length,
      fileName: 'emergency.fountain',
      storageRelation: 'unknownPhysicalDisk' as const,
    })),
  };
  const entryPort: DocumentEntryPort = {
    createUnsaved: vi.fn(async () => ({
      ...opened(),
      kind: 'unsaved' as const,
      persistentIdentity: false,
      fingerprint: null,
      source: [],
    })),
    openViaPicker: vi.fn(async () => entry.picked),
    selectDestination: vi.fn(async () => entry.destination),
  };
  const saveAsPort: SaveAsPort = {
    selectDestination: vi.fn(async () => saveAs.target),
    saveAs: vi.fn(async (request) => {
      if (saveAs.fail) throw { code: 'io', action: 'retry' };
      saveAs.published = true;
      return {
        document: {
          ...opened(),
          identity: freshIdentity(),
          source: [...request.checkpoint.source],
          fingerprint: fingerprint(
            request.checkpoint.version,
            request.checkpoint.sourceSha256,
          ),
        },
        version: request.checkpoint.version,
        sourceSha256: request.checkpoint.sourceSha256,
        fileName: saveAs.target!.fileName,
        storageRelation: saveAs.target!.storageRelation,
      };
    }),
  };
  return {
    ports: {
      entry: entryPort,
      documents: documentPort,
      saveAs: saveAsPort,
      snapshots: snapshotPort,
      ...overrides,
    },
    entry,
    documents,
    saveAs,
    snapshots,
  };
}

describe('M3-12 writing session lifecycle', () => {
  it('protects a PDF capture while frozen, then thaws without granting source-save credit', async () => {
    const fakes = ports(),
      editor = new FakeEditor();
    const session = new WritingSession(fakes.ports, editor, fakeClock());
    fakes.entry.picked = opened();
    await session.openPicked();
    editor.sourceWas([98], 2);
    const prepare = vi.fn(
      async (
        cp: import('../../src/application/documents').CheckpointRequest,
      ) => {
        expect(editor.frozen).toBe(true);
        expect(fakes.ports.documents.checkpoint).toHaveBeenCalledWith(
          expect.objectContaining({ version: 2, source: [98] }),
        );
        return {
          identity: cp.identity,
          captureToken: 'capture',
          version: cp.version,
          sourceSha256: cp.sourceSha256,
          checkpoint: {
            identity: cp.identity,
            version: cp.version,
            sourceSha256: cp.sourceSha256,
            generation: 1,
            protection: 'recoveryCheckpoint' as const,
          },
        };
      },
    );
    const capture = await session.captureForPdf(prepare);
    expect(capture.snapshot.version).toBe(2);
    expect(editor.frozen).toBe(false);
    expect(fakes.documents.saved).toEqual([]);
    expect(editor.current.source).toEqual([98]);
    session.dispose();
  });
  it('refuses PDF capture after failed protection and thaws the unchanged editor', async () => {
    const fakes = ports(),
      editor = new FakeEditor();
    const session = new WritingSession(fakes.ports, editor, fakeClock());
    fakes.entry.picked = opened();
    await session.openPicked();
    editor.sourceWas([98], 2);
    vi.mocked(fakes.ports.documents.checkpoint).mockRejectedValueOnce({
      code: 'io',
    });
    const prepare = vi.fn();
    await expect(session.captureForPdf(prepare)).rejects.toBeTruthy();
    expect(prepare).not.toHaveBeenCalled();
    expect(editor.frozen).toBe(false);
    expect(editor.current.source).toEqual([98]);
    expect(fakes.documents.saved).toEqual([]);
    session.dispose();
  });
  it.each(['load', 'capture', 'release', 'native-release'] as const)(
    'retains the original editor and identity after Save As %s failure',
    async (failure) => {
      const fakes = ports();
      const editor = new FakeEditor();
      const session = new WritingSession(fakes.ports, editor, fakeClock());
      fakes.entry.picked = opened();
      await session.openPicked();
      const identity = session.active!.identity;
      const snapshot = editor.current;
      editor.selection = { anchor: 1, head: 2 };
      fakes.saveAs.target = {
        token: 'target',
        fileName: 'Copy.fountain',
        storageRelation: 'sameFilesystem',
      };
      if (failure === 'load')
        vi.spyOn(editor, 'loadInitial').mockImplementationOnce(() => {
          editor.sourceWas([98], 55);
          throw new Error('adoption failed');
        });
      else if (failure === 'capture') {
        const capture = editor.capture.bind(editor);
        vi.spyOn(editor, 'capture')
          .mockImplementationOnce(capture)
          .mockRejectedValueOnce(new Error('capture failed'));
      } else
        vi.mocked(fakes.ports.documents.release).mockRejectedValueOnce(
          failure === 'native-release'
            ? { code: 'saveNeedsAttention' }
            : new Error('release failed'),
        );
      await expect(session.saveAs()).rejects.toThrow(
        failure === 'load'
          ? 'fresh-session adoption (adoption failed)'
          : failure === 'capture'
            ? 'fresh-session adoption (capture failed)'
            : failure === 'native-release'
              ? 'original-registration release (saveNeedsAttention)'
              : 'original-registration release (release failed)',
      );
      expect(session.active!.identity).toEqual(identity);
      expect(editor.current).toBe(snapshot);
      expect(editor.selection).toEqual({ anchor: 1, head: 2 });
      expect(editor.frozen).toBe(false);
      expect(fakes.saveAs.published).toBe(true);
      await session.save();
      expect(fakes.ports.documents.save).toHaveBeenLastCalledWith(
        expect.objectContaining({ identity }),
      );
      session.dispose();
    },
  );
  it.each(['load', 'capture'])(
    'releases a registration after initial %s failure',
    async (stage) => {
      const fakes = ports();
      const editor = new FakeEditor();
      if (stage === 'load')
        editor.loadInitial = () => {
          throw new Error('initial failure');
        };
      else
        editor.capture = async () => {
          throw new Error('initial failure');
        };
      const session = new WritingSession(fakes.ports, editor, fakeClock());
      await expect(session.openNew()).rejects.toThrow('initial failure');
      session.dispose();
      expect(fakes.ports.documents.release).toHaveBeenCalledOnce();
      expect(session.active).toBeNull();
    },
  );
  it('reports a newer editor version while capture fails and closes only after an exact draft bundle copy', async () => {
    const fakes = ports();
    const editor = new FakeEditor();
    const session = new WritingSession(fakes.ports, editor, fakeClock());
    fakes.entry.picked = opened();
    await session.openPicked();
    await session.save();
    editor.current = { ...editor.current, version: 2 };
    editor.capture = async () => {
      throw new Error('unrepresentable');
    };
    expect(session.cadenceStatus.status).toBe('Changes pending');
    expect(session.close.assessment).toMatchObject({
      liveVersion: 2,
      sourceProtected: false,
      recoveryProtected: false,
      onlyInMemory: true,
    });
    await expect(session.noteEdit()).rejects.toThrow('unrepresentable');
    await expect(session.close.retry()).rejects.toThrow('unrepresentable');
    fakes.ports.snapshots.copy = vi
      .fn()
      .mockRejectedValueOnce(new Error('copy failed'))
      .mockImplementation(async ({ checkpoint }) => ({
        identity: checkpoint.identity,
        version: checkpoint.version,
        sourceSha256: checkpoint.sourceSha256,
        byteLength: checkpoint.source.length,
        fileName: 'preserved.draft.json',
        storageRelation: 'sameFilesystem',
      }));
    await expect(session.close.saveEmergencyCopy('token')).rejects.toThrow(
      'copy failed',
    );
    expect(session.close.assessment.phase).toBe('attention');
    await session.close.saveEmergencyCopy('token');
    expect(fakes.ports.snapshots.copy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        format: 'draftBundle',
        checkpoint: expect.objectContaining({ version: 2 }),
      }),
    );
    expect(session.close.assessment.sourceProtected).toBe(false);
    expect(session.close.assessment.phase).toBe('closed');
    session.finishClose();
  });

  it('allows explicit version-bound risk close without requiring a failed capture', async () => {
    const fakes = ports();
    const editor = new FakeEditor();
    const session = new WritingSession(fakes.ports, editor, fakeClock());
    await session.openNew();
    editor.current = { ...editor.current, version: 2 };
    editor.capture = async () => {
      throw new Error('hash unavailable');
    };
    await expect(session.close.acceptRisk(true, 1)).rejects.toThrow(
      'draft changed',
    );
    await session.close.acceptRisk(true, 2);
    expect(session.close.assessment.phase).toBe('closed');
    session.finishClose();
  });
  it('opens an unsaved draft and protects it through explicit save', async () => {
    const fakes = ports();
    const editor = new FakeEditor();
    const session = new WritingSession(fakes.ports, editor, fakeClock());
    await session.openNew();
    expect(session.active?.kind).toBe('unsaved');
    expect(session.active?.liveVersion).toBe(1);
    const summary = await session.save();
    expect(summary.recovered).toBe(true);
    session.dispose();
  });

  it('reports picker cancellation without changing state', async () => {
    const fakes = ports();
    const editor = new FakeEditor();
    const session = new WritingSession(fakes.ports, editor, fakeClock());
    fakes.entry.picked = null;
    expect(await session.openPicked()).toBe(false);
    expect(session.active).toBeNull();
    session.dispose();
  });

  it('refuses a second open until the current session closes', async () => {
    const fakes = ports();
    const editor = new FakeEditor();
    const session = new WritingSession(fakes.ports, editor, fakeClock());
    await session.openNew();
    await expect(session.openNew()).rejects.toThrow(
      'Close the current session first',
    );
    session.dispose();
  });

  it('keeps the old session on Save As cancel and on publication failure', async () => {
    const fakes = ports();
    const editor = new FakeEditor();
    const session = new WritingSession(fakes.ports, editor, fakeClock());
    fakes.entry.picked = opened();
    expect(await session.openPicked()).toBe(true);
    const before = session.active?.identity;
    fakes.saveAs.target = null;
    expect(await session.saveAs()).toEqual({ status: 'cancelled' });
    expect(session.active?.identity).toEqual(before);
    expect(fakes.documents.released).toEqual([]);
    fakes.saveAs.target = {
      token: 't',
      fileName: 'n.fountain',
      storageRelation: 'sameFilesystem',
    };
    fakes.saveAs.fail = true;
    await expect(session.saveAs()).rejects.toThrow();
    expect(session.active?.identity).toEqual(before);
    expect(fakes.documents.released).toEqual([]);
    expect(editor.loaded).toHaveLength(1);
    session.dispose();
  });

  it('adopts a fresh identity on Save As, preserving selection with a new undo boundary', async () => {
    const fakes = ports();
    const editor = new FakeEditor();
    const session = new WritingSession(fakes.ports, editor, fakeClock());
    fakes.entry.picked = opened();
    await session.openPicked();
    const oldIdentity = session.active!.identity;
    const selection: SessionSelection = {
      anchor: 2,
      head: 2,
    };
    editor.selection = selection;
    fakes.saveAs.target = {
      token: 't',
      fileName: 'copy.fountain',
      storageRelation: 'sameFilesystem',
    };
    const outcome = await session.saveAs();
    expect(outcome).toEqual({
      status: 'published',
      fileName: 'copy.fountain',
      storageRelation: 'sameFilesystem',
    });
    // Old registration released exactly once; new identity is active.
    expect(fakes.documents.released).toEqual([oldIdentity]);
    expect(session.active?.identity).not.toEqual(oldIdentity);
    // Old persistence stack retired: live version restarts and the editor was
    // rebuilt from the published bytes with the selection preserved.
    expect(session.active?.liveVersion).toBe(1);
    expect(editor.loaded).toHaveLength(2);
    expect(editor.loaded[1]!.source).toEqual([97]);
    expect(editor.loaded[1]!.selection).toEqual(selection);
    expect(editor.selection).toEqual(selection);
    // New registration earned fresh receipts through the duplicate-safe flush.
    expect(fakes.documents.saved).toContain(1);
    session.dispose();
  });

  it('compares Save As bytes without copying the capture for every byte', async () => {
    const fakes = ports();
    const editor = new FakeEditor();
    const session = new WritingSession(fakes.ports, editor, fakeClock());
    fakes.entry.picked = opened();
    await session.openPicked();
    const source = Array.from({ length: 4096 }, () => 97);
    editor.sourceWas(source, 2);
    let copies = 0;
    editor.current = {
      ...editor.current,
      get source() {
        copies++;
        return [...source];
      },
    };
    fakes.saveAs.target = {
      token: 't',
      fileName: 'copy.fountain',
      storageRelation: 'sameFilesystem',
    };
    await session.saveAs();
    expect(editor.loaded.at(-1)!.source).toEqual(source);
    // Fixed overhead at the capture/IPC boundaries, independent of byte count.
    expect(copies).toBeLessThan(30);
    session.dispose();
  });

  it('publishes the latest editor bytes after destination picking', async () => {
    const fakes = ports();
    const editor = new FakeEditor();
    const session = new WritingSession(fakes.ports, editor, fakeClock());
    fakes.entry.picked = opened();
    await session.openPicked();
    fakes.saveAs.target = {
      token: 't',
      fileName: 'n.fountain',
      storageRelation: 'sameFilesystem',
    };
    editor.sourceWas([98], 2);
    editor.current = {
      ...editor.current,
      capture: { internal: true },
    } as CapturedSnapshot;
    await session.saveAs();
    expect(fakes.saveAs.published).toBe(true);
    expect(editor.loaded.at(-1)!.source).toEqual([98]);
    session.dispose();
  });

  it('copies without touching identity, and refuses mismatched receipts', async () => {
    const fakes = ports();
    const editor = new FakeEditor();
    const session = new WritingSession(fakes.ports, editor, fakeClock());
    fakes.entry.picked = opened();
    await session.openPicked();
    const before = session.active!.identity;
    fakes.entry.destination = null;
    expect(await session.exportCopy()).toEqual({ status: 'cancelled' });
    fakes.entry.destination = { token: 'd', storageRelation: 'sameFilesystem' };
    const outcome = await session.exportCopy();
    expect(outcome).toEqual({
      status: 'copied',
      fileName: 'emergency.fountain',
      storageRelation: 'unknownPhysicalDisk',
    });
    expect(session.active!.identity).toEqual(before);
    session.dispose();
  });

  it('adopts recovery bytes as the exact next version and re-anchors the baseline', async () => {
    const fakes = ports();
    const editor = new FakeEditor();
    const session = new WritingSession(fakes.ports, editor, fakeClock());
    fakes.entry.picked = opened();
    await session.openPicked();
    await session.adoptExternalBytes([98], receiptFor(2, true));
    expect(editor.applied).toEqual([[98]]);
    expect(session.active?.liveVersion).toBe(2);
    // The adopted receipt is the new baseline: status is saved, not pending.
    expect(session.cadenceStatus.status).toBe('Saved locally');
    expect(session.cadenceStatus.fileSavedVersion).toBe(2);
    // A later edit saves against the adopted fingerprint (no stale conflict).
    editor.sourceWas([97], 3);
    await session.noteEdit();
    const summary = await session.save();
    expect(summary.saved).toBe(true);
    expect(fakes.documents.saved).toContain(3);
    await expect(
      session.adoptExternalBytes([98], receiptFor(3, true)),
    ).rejects.toThrow('Adopted version must advance the live sequence');
    expect(editor.applied).toHaveLength(1);
    session.dispose();
  });

  it('re-anchors the baseline after a transaction resolution without editor changes', async () => {
    const fakes = ports();
    const editor = new FakeEditor();
    const session = new WritingSession(fakes.ports, editor, fakeClock());
    fakes.entry.picked = opened();
    await session.openPicked();
    await session.adoptNativeReceipt(receiptFor(1, false));
    expect(session.cadenceStatus.status).toBe('Saved locally');
    expect(editor.applied).toEqual([]);
    await expect(
      session.adoptNativeReceipt({ ...receiptFor(1, false), sourceSha256: B }),
    ).rejects.toThrow('Receipt does not match the live version');
    session.dispose();
  });

  it('abandons a dead-mount open by releasing without the close flow', async () => {
    const fakes = ports();
    const editor = new FakeEditor();
    const session = new WritingSession(fakes.ports, editor, fakeClock());
    await session.openNew();
    await session.abandon();
    expect(session.active).toBeNull();
    expect(fakes.documents.released).toHaveLength(1);
    expect(editor.loaded).toHaveLength(1);
    session.dispose();
  });

  it('closes an unsaved draft through recovery and retires the session', async () => {
    const fakes = ports();
    const editor = new FakeEditor();
    const session = new WritingSession(fakes.ports, editor, fakeClock());
    await session.openNew();
    await session.close.retry();
    expect(session.close.assessment.phase).toBe('closed');
    session.finishClose();
    expect(session.active).toBeNull();
    expect(fakes.documents.released).toHaveLength(1);
    session.dispose();
  });

  it('closes a named source only with an exact source receipt', async () => {
    const fakes = ports();
    const editor = new FakeEditor();
    const session = new WritingSession(fakes.ports, editor, fakeClock());
    fakes.entry.picked = opened();
    await session.openPicked();
    await session.close.retry();
    expect(session.close.assessment.phase).toBe('closed');
    expect(fakes.documents.saved).toContain(1);
    session.finishClose();
    expect(session.active).toBeNull();
    session.dispose();
  });

  it('blocks saving from read-only sessions with an honest reason', async () => {
    const fakes = ports();
    const editor = new FakeEditor();
    const session = new WritingSession(fakes.ports, editor, fakeClock());
    fakes.entry.picked = {
      ...opened(),
      ownership: { status: 'viewOnly', reasons: ['alreadyOwned'] },
    };
    await session.openPicked();
    expect(session.active?.readOnly).toBe(true);
    expect(session.active?.readOnlyReason).toContain('read-only');
    await expect(session.save()).rejects.toThrow('Read-only');
    fakes.saveAs.target = {
      token: 'target',
      fileName: 'Copy.fountain',
      storageRelation: 'sameFilesystem',
    };
    expect((await session.saveAs()).status).toBe('published');
    expect(session.active?.readOnly).toBe(false);
    expect(fakes.ports.documents.checkpoint).not.toHaveBeenCalledWith(
      expect.objectContaining({ identity: fakes.entry.picked.identity }),
    );
    session.dispose();
  });

  it('keeps saving while snapshot creation fails, with attention recorded', async () => {
    const fakes = ports();
    const editor = new FakeEditor();
    const clock = fakeClock();
    const session = new WritingSession(fakes.ports, editor, clock);
    fakes.entry.picked = opened();
    await session.openPicked();
    fakes.snapshots.createFails = true;
    editor.sourceWas([98], 2);
    await session.noteEdit();
    await clock.advance(400_000);
    // Snapshot failure sets attention without touching save state.
    expect(session.cadenceStatus.snapshotAttention).toBe(true);
    const summary = await session.save();
    expect(summary.saved).toBe(true);
    session.dispose();
  });
  it('freezes the editor until Save As publication and adoption finish', async () => {
    const fakes = ports();
    const editor = new FakeEditor();
    fakes.entry.picked = opened();
    fakes.saveAs.target = {
      token: 't',
      fileName: 'copy.fountain',
      storageRelation: 'sameFilesystem',
    };
    const publish = fakes.ports.saveAs.saveAs;
    fakes.ports.saveAs.saveAs = async (request) => {
      expect(editor.frozen).toBe(true);
      expect(request.checkpoint.source).toEqual([98]);
      expect(Object.keys(request.checkpoint).sort()).toEqual([
        'draftMetadata',
        'expectedFingerprint',
        'identity',
        'source',
        'sourceSha256',
        'version',
      ]);
      return publish(request);
    };
    const session = new WritingSession(fakes.ports, editor, fakeClock());
    await session.openPicked();
    editor.sourceWas([98], 2);
    await session.saveAs();
    expect(editor.frozen).toBe(false);
    session.dispose();
  });

  it('refuses a foreign or malformed adoption before changing any editor bytes', async () => {
    const fakes = ports();
    const editor = new FakeEditor();
    fakes.entry.picked = opened();
    const session = new WritingSession(fakes.ports, editor, fakeClock());
    await session.openPicked();
    await expect(
      session.adoptExternalBytes([98], {
        ...receiptFor(2, true),
        identity: freshIdentity(),
      }),
    ).rejects.toThrow();
    await expect(
      session.adoptExternalBytes([97], receiptFor(2, true)),
    ).rejects.toThrow();
    await expect(
      session.adoptExternalBytes([98], {
        ...receiptFor(2, true),
        fingerprint: { ...fingerprint(2, B), byteLength: 99 },
      }),
    ).rejects.toThrow();
    expect(editor.applied).toEqual([]);
    expect(session.active!.liveVersion).toBe(1);
    session.dispose();
  });

  it('protects the latest live draft before native recovery and adopts a later native version', async () => {
    const fakes = ports();
    const editor = new FakeEditor();
    fakes.entry.picked = opened();
    const order: string[] = [];
    fakes.ports.snapshots.create = async ({ checkpoint, kind, name }) => {
      expect(editor.frozen).toBe(true);
      expect(checkpoint.source).toEqual([97]);
      order.push('protected');
      return {
        selection: { snapshotId: 'snapshot', recordSha256: A },
        record: {
          schemaVersion: 1,
          snapshotId: 'snapshot',
          documentId: checkpoint.identity.documentId,
          sessionId: checkpoint.identity.sessionId,
          version: checkpoint.version,
          sourceSha256: checkpoint.sourceSha256,
          byteLength: checkpoint.source.length,
          createdSeconds: 1,
          kind,
          name,
        },
      };
    };
    const session = new WritingSession(fakes.ports, editor, fakeClock());
    await session.openPicked();
    await session.replaceFromNative(async () => {
      expect(order).toEqual(['protected']);
      order.push('replaced');
      return { source: [98], receipt: receiptFor(10, true) };
    });
    expect(order).toEqual(['protected', 'replaced']);
    expect(editor.current.version).toBe(10);
    expect(session.cadenceStatus.status).toBe('Saved locally');
    expect(editor.frozen).toBe(false);
    session.dispose();
  });

  it('stops native replacement when protecting the live draft fails', async () => {
    const fakes = ports();
    const editor = new FakeEditor();
    fakes.entry.picked = opened();
    fakes.ports.snapshots.create = async () => {
      throw new Error('disk full');
    };
    const session = new WritingSession(fakes.ports, editor, fakeClock());
    await session.openPicked();
    const replace = vi.fn();
    await expect(session.replaceFromNative(replace)).rejects.toThrow(
      'disk full',
    );
    expect(replace).not.toHaveBeenCalled();
    expect(editor.applied).toEqual([]);
    expect(editor.frozen).toBe(false);
    session.dispose();
  });

  it('releases a late native open after disposal without mounting an editor', async () => {
    const fakes = ports();
    const editor = new FakeEditor();
    let complete!: (value: OpenDocument) => void;
    fakes.ports.entry.openViaPicker = () =>
      new Promise((resolve) => {
        complete = resolve;
      });
    const session = new WritingSession(fakes.ports, editor, fakeClock());
    const opening = session.openPicked();
    session.dispose();
    complete(opened());
    await opening;
    expect(editor.loaded).toEqual([]);
    expect(fakes.documents.released).toHaveLength(1);
  });

  it('closes read-only sources without submitting a save or checkpoint', async () => {
    const fakes = ports();
    const editor = new FakeEditor();
    fakes.entry.picked = {
      ...opened(),
      ownership: { status: 'viewOnly', reasons: ['alreadyOwned'] },
    };
    const session = new WritingSession(fakes.ports, editor, fakeClock());
    await session.openPicked();
    await session.close.retry();
    expect(fakes.ports.documents.save).not.toHaveBeenCalled();
    expect(fakes.ports.documents.checkpoint).not.toHaveBeenCalled();
    expect(session.close.assessment.phase).toBe('closed');
    session.finishClose();
    session.dispose();
  });
  it('resolves an older native save without marking newer edits saved', async () => {
    const fakes = ports();
    const editor = new FakeEditor();
    fakes.entry.picked = opened();
    const session = new WritingSession(fakes.ports, editor, fakeClock());
    await session.openPicked();
    editor.sourceWas([98], 2);
    await session.noteEdit();
    await session.adoptNativeReceipt(receiptFor(1, false));
    expect(session.active!.liveVersion).toBe(2);
    expect(editor.current.source).toEqual([98]);
    expect(session.cadenceStatus.status).not.toBe('Saved locally');
    expect(session.cadenceStatus.fileSavedVersion).toBe(0);
    expect((await session.save()).saved).toBe(true);
    session.dispose();
  });
});

describe('M4-02 selected native entry', () => {
  it('releases a delayed registration after its session was disposed', async () => {
    const f = ports();
    const editor = new FakeEditor();
    const session = new WritingSession(f.ports, editor, fakeClock());
    let finish!: (value: OpenDocument) => void;
    const pending = session.openSelected(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    session.dispose();
    finish(opened());
    await pending;
    expect(f.documents.released).toEqual([opened().identity]);
    expect(editor.loaded).toEqual([]);
    expect(session.active).toBeNull();
  });
  it('retains read-only ownership and refuses selection over a live session', async () => {
    const f = ports();
    const editor = new FakeEditor();
    const session = new WritingSession(f.ports, editor, fakeClock());
    await session.openSelected(async () => ({
      ...opened(),
      ownership: { status: 'viewOnly', reasons: ['alreadyOwned'] },
    }));
    expect(session.active?.readOnly).toBe(true);
    expect(editor.writable).toBe(false);
    const load = vi.fn(async () => opened());
    await expect(session.openSelected(load)).rejects.toThrow(
      'Close the current session first',
    );
    expect(load).not.toHaveBeenCalled();
    session.dispose();
  });
});

describe('external source Reload', () => {
  it.each([false, true])(
    'preserves the %s dirty choice until explicit protected Reload',
    async (dirty) => {
      const editor = new FakeEditor();
      const external = {
        check: vi.fn(async () => ({
          identity: opened().identity,
          status: 'changed' as const,
          fingerprint: fingerprint(2, B),
          source: [98],
        })),
        reload: vi.fn(
          async (request: {
            adopted: import('../../src/application/documents').CheckpointRequest;
          }) => receiptFor(request.adopted.version, true),
        ),
      };
      const f = ports({ externalSource: external });
      f.entry.picked = opened();
      const session = new WritingSession(f.ports, editor, fakeClock());
      await session.openPicked();
      if (dirty) {
        editor.sourceWas([98], 2);
        await session.noteEdit();
      }
      const before = editor.current;
      await session.checkExternalSource();
      expect(session.externalDirty).toBe(dirty);
      expect(editor.current).toBe(before);
      expect(external.reload).not.toHaveBeenCalled();
      await session.reloadExternalSource();
      expect(editor.current.source).toEqual([98]);
      expect(external.reload.mock.calls[0]![0]).toMatchObject({
        current: { source: before.source },
        adopted: { version: before.version + 1, source: [98] },
      });
      expect(session.externalChange).toBeNull();
      expect(session.cadenceStatus.status).toBe('Saved locally');
      expect(editor.frozen).toBe(false);
      session.dispose();
    },
  );
  it('refuses failed native protection without changing source/selection, then thaws', async () => {
    const editor = new FakeEditor();
    const f = ports({
      externalSource: {
        check: async () => ({
          identity: opened().identity,
          status: 'changed',
          fingerprint: fingerprint(2, B),
          source: [98],
        }),
        reload: async () => {
          throw new Error('Safety snapshot refused');
        },
      },
    });
    f.entry.picked = opened();
    const session = new WritingSession(f.ports, editor, fakeClock());
    await session.openPicked();
    await session.checkExternalSource();
    const before = editor.current;
    await expect(session.reloadExternalSource()).rejects.toThrow(
      'Safety snapshot',
    );
    expect(editor.current.source).toEqual(before.source);
    expect(editor.current.version).toBe(before.version + 2);
    expect(editor.applied).toHaveLength(0);
    expect(session.externalChange).not.toBeNull();
    expect(editor.frozen).toBe(false);
    session.dispose();
  });
});

it('retains the draft and copy route when both Reload and fresh recovery fail', async () => {
  const editor = new FakeEditor();
  const nativeFailure = new Error('Disk changed after review');
  const recoveryFailure = new Error('Recovery storage unavailable');
  const f = ports({
    externalSource: {
      check: async () => ({
        identity: opened().identity,
        status: 'changed',
        fingerprint: fingerprint(2, B),
        source: [98],
      }),
      reload: async () => {
        throw nativeFailure;
      },
    },
  });
  f.ports.documents.checkpoint = async () => {
    throw recoveryFailure;
  };
  f.entry.picked = opened();
  const session = new WritingSession(f.ports, editor, fakeClock());
  await session.openPicked();
  await session.checkExternalSource();
  const failed = await session
    .reloadExternalSource()
    .catch((error: unknown) => error);
  expect(failed).toBeInstanceOf(AggregateError);
  expect((failed as AggregateError).errors).toEqual([
    nativeFailure,
    recoveryFailure,
  ]);
  expect((failed as AggregateError).cause).toBe(recoveryFailure);
  expect((failed as Error).message).toContain('save a separate copy');
  expect(editor.current.source).toEqual([97]);
  expect(editor.applied).toHaveLength(0);
  expect(editor.frozen).toBe(false);
  expect(session.externalChange).not.toBeNull();
  session.dispose();
});

// AUDIT-TEST: guard failures must stop publication/adoption, not merely throw later.
describe('AUDIT-TEST session boundaries', () => {
  async function active() {
    const fakes = ports(),
      editor = new FakeEditor();
    fakes.entry.picked = opened();
    const session = new WritingSession(fakes.ports, editor, fakeClock());
    await session.openPicked();
    return { fakes, editor, session };
  }

  it.each(['version', 'hash', 'length'] as const)(
    'refuses a stale %s capture before export',
    async (field) => {
      const { fakes, editor, session } = await active();
      fakes.entry.destination = {
        token: 'd',
        storageRelation: 'sameFilesystem',
      };
      const before = editor.current;
      editor.current = {
        ...before,
        ...(field === 'version'
          ? { version: 0 }
          : field === 'hash'
            ? { sourceSha256: B }
            : { source: [97, 97] }),
      };
      await expect(session.exportCopy()).rejects.toThrow(
        'Editor changed during capture',
      );
      expect(fakes.ports.snapshots.copy).not.toHaveBeenCalled();
      expect(session.active?.identity).toEqual(opened().identity);
      session.dispose();
    },
  );

  it.each(['version', 'hash', 'identity', 'bytes', 'fingerprint'] as const)(
    'refuses mismatched Save As %s before adoption',
    async (field) => {
      const { fakes, editor, session } = await active();
      fakes.saveAs.target = {
        token: 't',
        fileName: 'copy.fountain',
        storageRelation: 'sameFilesystem',
      };
      const publish = fakes.ports.saveAs.saveAs;
      fakes.ports.saveAs.saveAs = async (request) => {
        const result = await publish(request);
        if (field === 'version') result.version++;
        if (field === 'hash') result.sourceSha256 = B;
        if (field === 'identity') result.document.identity = opened().identity;
        if (field === 'bytes') result.document.source = [98];
        if (field === 'fingerprint')
          result.document.fingerprint = fingerprint(1, B);
        return result;
      };
      const before = editor.current;
      await expect(session.saveAs()).rejects.toThrow(
        'Save As registration does not match published bytes',
      );
      expect(editor.current).toBe(before);
      expect(editor.loaded).toHaveLength(1);
      expect(fakes.documents.released).toEqual([]);
      expect(session.active?.identity).toEqual(opened().identity);
      expect(editor.frozen).toBe(false);
      session.dispose();
    },
  );

  it.each(['identity', 'version', 'hash', 'length', 'name'] as const)(
    'refuses mismatched export-copy %s without altering the session',
    async (field) => {
      const { fakes, editor, session } = await active();
      fakes.entry.destination = {
        token: 'd',
        storageRelation: 'sameFilesystem',
      };
      const copy = fakes.ports.snapshots.copy;
      fakes.ports.snapshots.copy = async (request) => {
        const result = await copy(request);
        if (field === 'identity') result.identity = freshIdentity();
        if (field === 'version') result.version++;
        if (field === 'hash') result.sourceSha256 = B;
        if (field === 'length') result.byteLength++;
        if (field === 'name') result.fileName = '';
        return result;
      };
      const before = editor.current;
      await expect(session.exportCopy()).rejects.toThrow(
        'Export copy receipt does not match latest version',
      );
      expect(editor.current).toBe(before);
      expect(session.cadenceStatus.fileSavedVersion).toBe(0);
      expect(fakes.documents.released).toEqual([]);
      session.dispose();
    },
  );

  it.each(['version', 'hash'] as const)(
    'refuses a mismatched prepared adoption %s before applying',
    async (field) => {
      const { editor, session } = await active();
      const apply = vi.fn();
      const before = editor.current;
      await expect(
        session.adoptExternalBytes([98], receiptFor(2, true), {
          snapshot: {
            ...before,
            version: field === 'version' ? 3 : 2,
            source: [98],
            sourceSha256: field === 'hash' ? A : B,
          },
          apply,
        }),
      ).rejects.toThrow('Prepared replacement does not match the receipt');
      expect(apply).not.toHaveBeenCalled();
      expect(editor.current).toBe(before);
      expect(session.cadenceStatus.fileSavedVersion).toBe(0);
      session.dispose();
    },
  );

  it.each(['version', 'hash'] as const)(
    'refuses an editor that applies the wrong adoption %s',
    async (field) => {
      const { editor, session } = await active();
      const applied = vi
        .spyOn(editor, 'applySource')
        .mockImplementation((source, version) =>
          editor.sourceWas(
            field === 'hash' ? [97] : source,
            field === 'version' ? version + 1 : version,
          ),
        );
      await expect(
        session.adoptExternalBytes([98], receiptFor(2, true)),
      ).rejects.toThrow(
        'Adopted bytes did not land as the acknowledged live version',
      );
      expect(applied).toHaveBeenCalledTimes(1);
      expect(session.cadenceStatus.fileSavedVersion).toBe(0);
      expect(session.active?.fingerprint).toEqual(opened().fingerprint);
      session.dispose();
    },
  );

  it.each([
    'null',
    'documentId',
    'sessionId',
    'version',
    'hash',
    'length',
    'kind',
  ] as const)(
    'refuses %s pre-destructive protection before calling replacement',
    async (field) => {
      const { fakes, editor, session } = await active();
      fakes.ports.snapshots.create = async ({ checkpoint }) => {
        if (field === 'null') return null;
        const record = {
          schemaVersion: 1 as const,
          snapshotId: 'snapshot',
          documentId: checkpoint.identity.documentId,
          sessionId: checkpoint.identity.sessionId,
          version: checkpoint.version,
          sourceSha256: checkpoint.sourceSha256,
          byteLength: checkpoint.source.length,
          createdSeconds: 1,
          kind: 'preDestructive' as const,
          name: null,
        };
        return {
          selection: { snapshotId: 'snapshot', recordSha256: A },
          record: {
            ...record,
            ...(field === 'documentId'
              ? { documentId: 'foreign' }
              : field === 'sessionId'
                ? { sessionId: 'foreign' }
                : field === 'version'
                  ? { version: 0 }
                  : field === 'hash'
                    ? { sourceSha256: B }
                    : field === 'length'
                      ? { byteLength: 2 }
                      : { kind: 'rolling' as const }),
          },
        };
      };
      const replace = vi.fn(),
        before = editor.current;
      await expect(session.replaceFromNative(replace)).rejects.toThrow(
        'Latest editor draft was not protected; replacement stopped',
      );
      expect(replace).not.toHaveBeenCalled();
      expect(editor.current).toBe(before);
      expect(editor.frozen).toBe(false);
      session.dispose();
    },
  );

  it.each([
    'identity',
    'version',
    'hash',
    'checkpointVersion',
    'checkpointHash',
    'token',
  ] as const)('refuses a mismatched protected PDF %s', async (field) => {
    const { fakes, editor, session } = await active();
    const before = editor.current;
    await expect(
      session.captureForPdf(async (cp) => ({
        identity: field === 'identity' ? freshIdentity() : cp.identity,
        version: field === 'version' ? 2 : cp.version,
        sourceSha256: field === 'hash' ? B : cp.sourceSha256,
        captureToken: field === 'token' ? '' : 'capture',
        checkpoint: {
          identity: cp.identity,
          version: field === 'checkpointVersion' ? 2 : cp.version,
          sourceSha256: field === 'checkpointHash' ? B : cp.sourceSha256,
          generation: 1,
          protection: 'recoveryCheckpoint',
        },
      })),
    ).rejects.toThrow('PDF capture does not match the protected version');
    expect(fakes.ports.documents.checkpoint).toHaveBeenCalledTimes(1);
    expect(editor.current).toBe(before);
    expect(editor.frozen).toBe(false);
    expect(session.cadenceStatus.fileSavedVersion).toBe(0);
    session.dispose();
  });

  it('rejects foreign resolution identity before receipt adoption and thaws', async () => {
    const { editor, session } = await active();
    await expect(
      session.resolveNative(async () => ({
        identity: freshIdentity(),
        observation: 'confirmedRecordMatchesSource' as const,
        completed: receiptFor(1),
        previousPreserved: true,
      })),
    ).rejects.toThrow('Resolution identity does not match the active session');
    expect(editor.current.source).toEqual([97]);
    expect(editor.frozen).toBe(false);
    expect(session.cadenceStatus.fileSavedVersion).toBe(0);
    session.dispose();
  });
});

describe('AUDIT-TEST recovery composition', () => {
  const selection = {
    documentId: opened().identity.documentId,
    origin: 'current' as const,
    recordSha256: A,
  };
  async function recovering() {
    const { unavailableRecovery } =
      await import('../../src/application/startupRecovery');
    const recovered = {
      ...opened(),
      identity: freshIdentity(),
      kind: 'unsaved' as const,
      persistentIdentity: false,
      fingerprint: null,
    };
    const recovery: import('../../src/application/startupRecovery').RecoveryPort =
      {
        ...unavailableRecovery,
        resume: vi.fn(async () => ({ document: recovered, draftMetadata: {} })),
        inspect: vi.fn(async (identity) => ({
          documentId: identity.documentId,
          candidates: [
            {
              selection: { ...selection, documentId: identity.documentId },
              sessionId: identity.sessionId,
              version: 1,
              generation: 1,
              sourceSha256: A,
              byteLength: 1,
              encoding: 'utf8' as const,
            },
          ],
          notices: [],
          error: null,
        })),
      };
    const fakes = ports({ recovery }),
      editor = new FakeEditor();
    return {
      fakes,
      editor,
      recovery,
      recovered,
      session: new WritingSession(fakes.ports, editor, fakeClock()),
    };
  }

  it('resumes with fresh identity at version 2 and confirms raw protection without touching the original', async () => {
    const { fakes, editor, recovery, recovered, session } = await recovering();
    await session.openRecovery(selection);
    expect(recovery.resume).toHaveBeenCalledExactlyOnceWith(selection);
    expect(session.active).toMatchObject({
      identity: recovered.identity,
      kind: 'unsaved',
      liveVersion: 2,
    });
    expect(editor.current.source).toEqual([97]);
    expect(fakes.ports.documents.checkpoint).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        identity: recovered.identity,
        version: 2,
        source: [97],
        expectedFingerprint: null,
      }),
    );
    expect(session.cadenceStatus.journaledVersion).toBe(2);
    expect(session.cadenceStatus.fileSavedVersion).toBe(0);
    expect(fakes.ports.documents.save).not.toHaveBeenCalled();
    expect(fakes.documents.released).toEqual([]);
    session.dispose();
  });

  it.each([false, true])(
    'preserves the resume protection failure when release fails: %s',
    async (releaseFails) => {
      const { fakes, editor, recovered, session } = await recovering();
      vi.mocked(fakes.ports.documents.checkpoint).mockRejectedValueOnce(
        new Error('checkpoint unavailable'),
      );
      if (releaseFails)
        vi.mocked(fakes.ports.documents.release).mockRejectedValueOnce(
          new Error('release unavailable'),
        );
      const opening = session.openRecovery(selection);
      await expect(opening).rejects.toThrow(
        'Resumed draft protection could not be confirmed; the original checkpoint remains preserved',
      );
      if (releaseFails) {
        const failure = await opening.catch((error: unknown) => error);
        expect(failure).toBeInstanceOf(AggregateError);
        const aggregate = failure as AggregateError;
        expect(aggregate.errors).toEqual([
          expect.objectContaining({
            message:
              'Resumed draft protection could not be confirmed; the original checkpoint remains preserved',
          }),
          expect.objectContaining({ message: 'release unavailable' }),
        ]);
        expect(aggregate.cause).toBe(aggregate.errors[1]);
      }
      expect(fakes.ports.documents.release).toHaveBeenCalledExactlyOnceWith(
        recovered.identity,
      );
      expect(fakes.ports.documents.save).not.toHaveBeenCalled();
      expect(session.active).toBeNull();
      expect(editor.current.source).toEqual([97]);
      session.dispose();
    },
  );

  it.each(['resume', 'inspect', 'capture'] as const)(
    'releases a resumed registration disposed during %s without flushing',
    async (stage) => {
      const { fakes, editor, recovery, recovered, session } =
        await recovering();
      let finish!: () => void;
      const pending = new Promise<void>((resolve) => {
        finish = resolve;
      });
      const reached = vi.fn();
      if (stage === 'resume') {
        recovery.resume = async () => {
          reached();
          await pending;
          return { document: recovered, draftMetadata: {} };
        };
      } else if (stage === 'inspect') {
        const inspect = recovery.inspect;
        recovery.inspect = async (identity) => {
          reached();
          await pending;
          return inspect(identity);
        };
      } else {
        editor.capture = async () => {
          reached();
          await pending;
          return editor.current;
        };
      }
      const opening = session.openRecovery(selection);
      await vi.waitFor(() => expect(reached).toHaveBeenCalled());
      session.dispose();
      finish();
      await expect(opening).resolves.toBeUndefined();
      expect(session.active).toBeNull();
      expect(fakes.ports.documents.release).toHaveBeenCalledExactlyOnceWith(
        recovered.identity,
      );
      expect(fakes.ports.documents.checkpoint).not.toHaveBeenCalled();
      expect(fakes.ports.documents.save).not.toHaveBeenCalled();
      expect(editor.loaded).toHaveLength(stage === 'capture' ? 1 : 0);
    },
  );

  it('rejects foreign recovery inspection before loading and releases only that registration', async () => {
    const { fakes, editor, recovery, recovered, session } = await recovering();
    recovery.inspect = async () => ({
      documentId: selection.documentId,
      candidates: [],
      notices: [],
      error: null,
    });
    await expect(session.openRecovery(selection)).rejects.toThrow(
      'Recovery identity does not match the selected document',
    );
    expect(editor.loaded).toEqual([]);
    expect(session.active).toBeNull();
    expect(fakes.ports.documents.release).toHaveBeenCalledExactlyOnceWith(
      recovered.identity,
    );
    expect(fakes.ports.documents.checkpoint).not.toHaveBeenCalled();
    session.dispose();
  });
});
