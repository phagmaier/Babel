import { expect, it, vi } from 'vitest';
import type {
  CheckpointReceipt,
  CheckpointRequest,
  DocumentPort,
  SaveReceipt,
  SaveRequest,
} from '../../src/application/documents';
import { PersistenceController } from '../../src/application/persistenceController';
import { persistenceStatus } from '../../src/application/persistenceState';
import {
  identity,
  opened,
  receiptFor,
  snapshot,
  A,
  B,
} from './persistence-fixtures';
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function port(): DocumentPort {
  return {
    readInitial: async () => opened(),
    release: async () => undefined,
    releaseAtRisk: async () => undefined,
    checkpoint: vi.fn(
      async (req: CheckpointRequest): Promise<CheckpointReceipt> => ({
        identity: req.identity,
        version: req.version,
        sourceSha256: req.sourceSha256,
        generation: req.version,
        protection: 'recoveryCheckpoint',
      }),
    ),
    save: vi.fn(async (req) => receiptFor(req.version, req.sourceSha256 === B)),
  };
}
it('serializes native calls, keeps newer edits dirty and binds next request to confirmed baseline', async () => {
  const first = deferred<SaveReceipt>();
  const second = deferred<SaveReceipt>();
  const native = port();
  native.save = vi
    .fn()
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const controller = new PersistenceController(opened(), native);
  controller.changed(snapshot(21));
  const saving21 = controller.save(snapshot(21));
  controller.changed(snapshot(22, true));
  const saving22 = controller.save(snapshot(22, true));
  await Promise.resolve();
  expect(native.save).toHaveBeenCalledTimes(1);
  expect(persistenceStatus(controller.state)).toBe('Saving');
  first.resolve(receiptFor(21));
  await saving21;
  expect(controller.state.fileSavedVersion).toBe(21);
  expect(controller.state.liveVersion).toBe(22);
  expect(persistenceStatus(controller.state)).not.toBe('Saved locally');
  expect(native.save).toHaveBeenCalledTimes(2);
  const latest = vi.mocked(native.save).mock.calls[1]?.[0];
  expect(latest?.expectedFingerprint).toEqual(receiptFor(21).fingerprint);
  expect(latest?.sourceSha256).toBe(B);
  second.resolve(receiptFor(22, true));
  await saving22;
  expect(persistenceStatus(controller.state)).toBe('Saved locally');
});
it('owns queued bytes and metadata while an editor producer changes its objects', async () => {
  const native = port();
  let sent: SaveRequest | undefined;
  native.save = vi.fn(async (request) => {
    sent = request;
    return receiptFor(21);
  });
  const controller = new PersistenceController(opened(), native);
  const captured = {
    ...snapshot(21),
    source: [97],
    draftMetadata: { unknown: { text: 'keep' } },
  };
  controller.changed(captured);
  const promise = controller.save(captured);
  captured.source[0] = 98;
  captured.draftMetadata.unknown.text = 'mutated';
  await promise;
  expect(sent?.source).toEqual([97]);
  expect(sent?.sourceSha256).toBe(A);
  expect(sent?.draftMetadata).toEqual({ unknown: { text: 'keep' } });
});
it('each explicit duplicate performs a fresh native flush', async () => {
  const native = port();
  const controller = new PersistenceController(opened(), native);
  controller.changed(snapshot(21));
  const first = await controller.save(snapshot(21));
  const second = await controller.save(snapshot(21));
  expect(first).toEqual(second);
  expect(native.save).toHaveBeenCalledTimes(2);
  expect(vi.mocked(native.save).mock.calls[1]?.[0].expectedFingerprint).toEqual(
    first.fingerprint,
  );
});
it('separate checkpoint completion never invents a file save', async () => {
  const native = port();
  const controller = new PersistenceController(opened(), native);
  controller.changed(snapshot(21));
  await controller.checkpoint(snapshot(21));
  expect(controller.state.journaledVersion).toBe(21);
  expect(controller.state.fileSavedVersion).toBe(0);
  expect(persistenceStatus(controller.state)).toBe(
    'Recovery protected; file save pending',
  );
  expect(native.save).not.toHaveBeenCalled();
});
it('transport uncertainty stops queued source replacement but permits newer raw recovery', async () => {
  const first = deferred<SaveReceipt>();
  const native = port();
  native.save = vi.fn(() => first.promise);
  const controller = new PersistenceController(opened(), native);
  controller.changed(snapshot(21));
  const a = controller.save(snapshot(21));
  const caughtA = a.catch((error) => error);
  controller.changed(snapshot(22, true));
  const b = controller.save(snapshot(22, true));
  const caughtB = b.catch((error) => error);
  await Promise.resolve();
  first.reject('transport dropped after a possible replacement');
  await caughtA;
  await caughtB;
  expect(controller.state.fileBlocked).toBe(true);
  expect(controller.state.fileSavedVersion).toBe(0);
  expect(native.save).toHaveBeenCalledTimes(1);
  expect(persistenceStatus(controller.state)).toBe('Save failed');
  await controller.checkpoint(snapshot(22, true));
  expect(controller.state.journaledVersion).toBe(22);
  expect(controller.state.fileSavedVersion).toBe(0);
});
it('a failure recovery receipt records raw protection and preserves the exact native error', async () => {
  const native = port();
  const recovery: CheckpointReceipt = {
    identity,
    version: 21,
    sourceSha256: A,
    generation: 1,
    protection: 'recoveryCheckpoint',
  };
  const failure = {
    identity,
    version: 21,
    error: { code: 'sourceChanged', action: 'reopenOrSaveCopy' },
    replacement: 'sourceUnchanged',
    recovery,
  };
  native.save = vi.fn(async () => {
    throw failure;
  });
  const controller = new PersistenceController(opened(), native);
  controller.changed(snapshot(21));
  await expect(controller.save(snapshot(21))).rejects.toBe(failure);
  expect(controller.state.journaledVersion).toBe(21);
  expect(controller.state.fileSavedVersion).toBe(0);
  expect(persistenceStatus(controller.state)).toBe('External change detected');
});
it('invalid native receipt cannot advance baseline or mark current edits saved', async () => {
  const native = port();
  native.save = vi.fn(async () => ({
    ...receiptFor(21),
    fingerprint: { ...receiptFor(21).fingerprint, sha256: B },
  }));
  const controller = new PersistenceController(opened(), native);
  controller.changed(snapshot(21));
  await expect(controller.save(snapshot(21))).rejects.toThrow(
    'Invalid persistence receipt',
  );
  expect(controller.state.fileSavedVersion).toBe(0);
  expect(controller.state.fingerprint).toEqual(opened().fingerprint);
  expect(controller.state.fileBlocked).toBe(true);
});
it('bounds queued operations and rejects non-JSON draft metadata without normalization', async () => {
  const hold = deferred<SaveReceipt>();
  const native = port();
  native.save = vi.fn(() => hold.promise);
  const controller = new PersistenceController(opened(), native);
  controller.changed(snapshot(21));
  const jobs = Array.from({ length: 8 }, () => controller.save(snapshot(21)));
  await expect(controller.save(snapshot(21))).rejects.toThrow('queue full');
  hold.resolve(receiptFor(21));
  await Promise.all(jobs);
  expect(native.save).toHaveBeenCalledTimes(8);
  expect(() =>
    controller.checkpoint({
      ...snapshot(21),
      draftMetadata: { bad: Number.NaN },
    }),
  ).toThrow('Invalid captured snapshot');
  expect(() =>
    controller.checkpoint({
      ...snapshot(21),
      draftMetadata: { bad: Infinity },
    }),
  ).toThrow('Invalid captured snapshot');
});

it('orders a metadata observation before queued saves without minting file-save credit', async () => {
  const native = port();
  const controller = new PersistenceController(opened(), native);
  controller.changed(snapshot(21, true));
  const observed =
    deferred<import('../../src/application/documents').SourceCheck>();
  const metadata = { ...opened().fingerprint!, inode: '999', changedNanos: 44 };
  const portCheck = { check: vi.fn(() => observed.promise), reload: vi.fn() };
  const checking = controller.checkSource(portCheck);
  await Promise.resolve();
  native.save = vi.fn(async (request) => ({
    ...receiptFor(request.version, true),
    fingerprint: { ...metadata, sha256: B },
  }));
  const saving = controller.save(snapshot(21, true));
  expect(native.save).not.toHaveBeenCalled();
  observed.resolve({
    identity,
    status: 'metadataOnly',
    fingerprint: metadata,
    source: null,
  });
  await checking;
  expect(controller.state.fileSavedVersion).toBe(0);
  await saving;
  expect(vi.mocked(native.save).mock.calls[0]![0].expectedFingerprint).toEqual(
    metadata,
  );
});

it('rejects stale/foreign/false metadata observations and blocks a real external generation', async () => {
  const controller = new PersistenceController(opened(), port());
  controller.changed(snapshot(21, true));
  const base = opened().fingerprint!;
  const change = {
    identity,
    status: 'changed' as const,
    fingerprint: receiptFor(22, true).fingerprint,
    source: [98],
  };
  expect(controller.observeSource({ ...base, inode: '999' }, change)).toBe(
    false,
  );
  expect(() =>
    controller.observeSource(base, {
      ...change,
      identity: { ...identity, handle: 'foreign' },
    }),
  ).toThrow();
  expect(() =>
    controller.observeSource(base, { ...change, status: 'metadataOnly' }),
  ).toThrow();
  expect(controller.observeSource(base, change)).toBe(true);
  expect(controller.state.externalChange).toBe(true);
  expect(controller.state.fileSavedVersion).toBe(0);
});
