import { expect, it, vi } from 'vitest';
import type { DocumentPort } from '../../src/application/documents';
import { PersistenceController } from '../../src/application/persistenceController';
import {
  ProtectedClose,
  type CloseOwner,
} from '../../src/application/protectedClose';
import type { SnapshotPort } from '../../src/application/snapshots';
import {
  A,
  B,
  identity,
  opened,
  receiptFor,
  snapshot,
} from './persistence-fixtures';

function fixture(unsaved = false) {
  const initial = {
    ...opened(),
    kind: unsaved ? ('unsaved' as const) : ('loose' as const),
    fingerprint: unsaved ? null : opened().fingerprint,
  };
  const documents: DocumentPort = {
    readInitial: vi.fn(async () => initial),
    release: vi.fn(async () => undefined),
    releaseAtRisk: vi.fn(async () => undefined),
    checkpoint: vi.fn(async (request) => ({
      identity: request.identity,
      version: request.version,
      sourceSha256: request.sourceSha256,
      generation: request.version,
      protection: 'recoveryCheckpoint' as const,
    })),
    save: vi.fn(async (request) =>
      receiptFor(request.version, request.sourceSha256 === B),
    ),
  };
  const copies: Pick<SnapshotPort, 'copy'> = {
    copy: vi.fn(async ({ checkpoint }) => ({
      identity: checkpoint.identity,
      version: checkpoint.version,
      sourceSha256: checkpoint.sourceSha256,
      byteLength: checkpoint.source.length,
      fileName: 'copy.fountain',
      storageRelation: 'unknownPhysicalDisk' as const,
    })),
  };
  const controller = new PersistenceController(initial, documents);
  let current = snapshot(21);
  controller.changed(current);
  let frozen = false;
  const owner: CloseOwner = {
    getVersion: () => current.version,
    captureCopy: async () => ({ snapshot: current }),
    freeze() {
      expect(frozen).toBe(false);
      frozen = true;
      return () => {
        frozen = false;
      };
    },
    async capture() {
      expect(frozen).toBe(true);
      return current;
    },
  };
  const close = new ProtectedClose(controller, documents, copies, owner);
  return {
    close,
    controller,
    documents,
    copies,
    isFrozen: () => frozen,
    edit(next = snapshot(22, true)) {
      expect(frozen).toBe(false);
      current = next;
      controller.changed(next);
    },
  };
}

it('waits for the latest exact source receipt before native release', async () => {
  const f = fixture();
  let resolve!: (receipt: ReturnType<typeof receiptFor>) => void;
  const pending = new Promise<ReturnType<typeof receiptFor>>((yes) => {
    resolve = yes;
  });
  f.documents.save = vi.fn(() => pending);
  const closing = f.close.retry();
  await Promise.resolve();
  expect(f.isFrozen()).toBe(true);
  expect(f.documents.release).not.toHaveBeenCalled();
  resolve(receiptFor(21));
  await closing;
  expect(f.close.assessment.phase).toBe('closed');
  expect(f.close.assessment.sourceProtected).toBe(true);
  expect(f.documents.release).toHaveBeenCalledOnce();
});

it('rejects stale/foreign receipts and preserves editable latest changes', async () => {
  const f = fixture();
  f.documents.save = vi.fn(async () => receiptFor(20));
  await expect(f.close.retry()).rejects.toThrow();
  expect(f.close.assessment.phase).toBe('attention');
  expect(f.close.assessment.recoveryProtected).toBe(true);
  expect(f.isFrozen()).toBe(false);
  expect(f.documents.release).not.toHaveBeenCalled();
  f.edit();
  expect(f.controller.state.liveVersion).toBe(22);
});

it('keeps an unsaved draft open on checkpoint failure, then closes after exact recovery', async () => {
  const f = fixture(true);
  f.documents.checkpoint = vi
    .fn()
    .mockRejectedValueOnce(new Error('disk full'))
    .mockImplementation(async (request) => ({
      identity: request.identity,
      version: request.version,
      sourceSha256: request.sourceSha256,
      generation: 1,
      protection: 'recoveryCheckpoint',
    }));
  await expect(f.close.retry()).rejects.toThrow('disk full');
  expect(f.close.assessment.onlyInMemory).toBe(true);
  expect(f.documents.release).not.toHaveBeenCalled();
  await f.close.retry();
  expect(f.close.assessment.recoveryProtected).toBe(true);
  expect(f.close.assessment.sourceProtected).toBe(false);
  expect(f.documents.release).toHaveBeenCalledOnce();
});

it('source and recovery failures remain in memory; copy failure never closes; exact copy can close', async () => {
  const f = fixture();
  f.documents.save = vi.fn(async () => {
    throw {
      identity,
      version: 21,
      error: { code: 'io', action: 'retry' },
      replacement: 'sourceUnchanged',
      recovery: null,
    };
  });
  f.documents.checkpoint = vi.fn(async () => {
    throw new Error('recovery full');
  });
  await expect(f.close.retry()).rejects.toBeDefined();
  expect(f.close.assessment.onlyInMemory).toBe(true);
  f.copies.copy = vi
    .fn()
    .mockRejectedValueOnce(new Error('backup full'))
    .mockImplementation(async () => ({
      identity,
      version: 21,
      sourceSha256: A,
      byteLength: 1,
      fileName: 'copy.fountain',
      storageRelation: 'unknownPhysicalDisk',
    }));
  await expect(f.close.saveEmergencyCopy('native-token')).rejects.toThrow(
    'backup full',
  );
  expect(f.documents.releaseAtRisk).not.toHaveBeenCalled();
  await f.close.saveEmergencyCopy('native-token');
  expect(f.documents.releaseAtRisk).toHaveBeenCalledOnce();
  expect(f.close.assessment.sourceProtected).toBe(false);
});

it('lost source response never earns close credit, while raw recovery remains available', async () => {
  const f = fixture();
  f.documents.save = vi.fn(async () => {
    throw new Error('lost native response');
  });
  await expect(f.close.retry()).rejects.toThrow('lost native response');
  expect(f.controller.state.fileBlocked).toBe(true);
  expect(f.close.assessment.sourceProtected).toBe(false);
  expect(f.close.assessment.recoveryProtected).toBe(true);
  expect(f.documents.release).not.toHaveBeenCalled();
  await expect(f.close.retry()).rejects.toThrow('resolution');
  expect(f.documents.save).toHaveBeenCalledOnce();
});

it('a stale emergency copy receipt cannot authorize release', async () => {
  const f = fixture();
  f.copies.copy = vi.fn(async () => ({
    identity,
    version: 20,
    sourceSha256: A,
    byteLength: 1,
    fileName: 'stale.fountain',
    storageRelation: 'sameFilesystem' as const,
  }));
  await expect(f.close.saveEmergencyCopy('native-token')).rejects.toThrow(
    'does not match',
  );
  expect(f.close.assessment.phase).toBe('attention');
  expect(f.documents.releaseAtRisk).not.toHaveBeenCalled();
});

it('requires explicit risk acceptance and preserves native failure', async () => {
  const f = fixture();
  await expect(f.close.acceptRisk(false)).rejects.toThrow('required');
  expect(f.documents.releaseAtRisk).not.toHaveBeenCalled();
  f.documents.releaseAtRisk = vi
    .fn()
    .mockRejectedValueOnce(new Error('native busy'))
    .mockResolvedValue(undefined);
  await expect(f.close.acceptRisk(true)).rejects.toThrow('native busy');
  expect(f.close.assessment.phase).toBe('attention');
  await f.close.acceptRisk(true);
  expect(f.close.assessment.phase).toBe('closed');
});

it('refuses risk acceptance for an older displayed draft version', async () => {
  const f = fixture();
  const displayedVersion = f.close.assessment.liveVersion;
  f.edit();
  await expect(f.close.acceptRisk(true, displayedVersion)).rejects.toThrow(
    'draft changed',
  );
  expect(f.documents.releaseAtRisk).not.toHaveBeenCalled();
  expect(f.close.assessment.phase).toBe('attention');
  expect(f.isFrozen()).toBe(false);
});
