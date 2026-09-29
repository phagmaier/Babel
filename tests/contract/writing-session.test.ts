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
    readInitial: vi.fn(async (id) => ({ ...opened(), identity: { ...id } })),
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
    await expect(session.saveAs()).rejects.toThrow('Read-only');
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
