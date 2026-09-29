import { beforeEach, expect, it, vi } from 'vitest';
import type {
  CheckpointRequest,
  DocumentPort,
  SaveRequest,
} from '../../src/application/documents';
import { PersistenceController } from '../../src/application/persistenceController';
import {
  SaveCadence,
  defaultCadenceOptions,
  type CadenceClock,
} from '../../src/application/saveCadence';
import type { SnapshotPort } from '../../src/application/snapshots';
import { A, B, opened, receiptFor, snapshot } from './persistence-fixtures';

function clock(): CadenceClock & { advance(ms: number): Promise<void> } {
  let now = 0;
  let next = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const api: CadenceClock & { advance(ms: number): Promise<void> } = {
    now: () => now,
    setTimeout: (fn, ms) => {
      const id = next++;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: (id) => {
      timers.delete(id as number);
    },
    advance: async (ms) => {
      const target = now + ms;
      for (;;) {
        const due = [...timers.entries()]
          .filter(([, t]) => t.at <= target)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        now = due[1].at;
        due[1].fn();
        await drain();
      }
      now = target;
      await drain();
    },
  };
  return api;
}

async function drain(rounds = 20): Promise<void> {
  for (let i = 0; i < rounds; i++) await Promise.resolve();
}

function ports(): {
  native: DocumentPort;
  checkpoints: CheckpointRequest[];
  saves: SaveRequest[];
  snapshots: SnapshotPort & { created: unknown[] };
} {
  const checkpoints: CheckpointRequest[] = [];
  const saves: SaveRequest[] = [];
  const created: unknown[] = [];
  const native: DocumentPort = {
    readInitial: async () => opened(),
    release: async () => undefined,
    releaseAtRisk: async () => undefined,
    checkpoint: async (req) => {
      checkpoints.push(req);
      return {
        identity: req.identity,
        version: req.version,
        sourceSha256: req.sourceSha256,
        generation: req.version,
        protection: 'recoveryCheckpoint',
      };
    },
    save: async (req) => {
      saves.push(req);
      return receiptFor(req.version, req.sourceSha256 === B);
    },
  };
  const snapshots = {
    created,
    list: async () => ({
      entries: [],
      sourceBytes: 0,
      needsAttention: false,
      unresolvedArtifacts: 0,
      orphanBlobs: 0,
      atLimit: false,
    }),
    read: async () => {
      throw new Error('unused');
    },
    create: async (req: unknown) => {
      created.push(req);
      return null;
    },
    prune: async () => ({
      entries: [],
      sourceBytes: 0,
      needsAttention: false,
      unresolvedArtifacts: 0,
      orphanBlobs: 0,
      atLimit: false,
    }),
    restore: async () => {
      throw new Error('unused');
    },
    copy: async () => {
      throw new Error('unused');
    },
  };
  return { native, checkpoints, saves, snapshots };
}

function cadence(
  overrides?: Partial<typeof defaultCadenceOptions>,
  seed = opened(),
) {
  const t = clock();
  const p = ports();
  const controller = new PersistenceController(seed, p.native);
  const scheduler = new SaveCadence(controller, p.snapshots, t, {
    ...defaultCadenceOptions,
    ...overrides,
  });
  return { t, p, controller, scheduler };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

it('coalesces rapid edits into one recovery checkpoint and one source save', async () => {
  const { t, p, scheduler } = cadence();
  for (let v = 1; v <= 5; v++) scheduler.noteEdit(snapshot(v, v % 2 === 0));
  expect(p.checkpoints).toHaveLength(0);
  await t.advance(500);
  expect(p.checkpoints.map((c) => c.version)).toEqual([5]);
  expect(p.saves).toHaveLength(0);
  await t.advance(250);
  expect(p.saves.map((s) => s.version)).toEqual([5]);
  expect(scheduler.describe().status).toBe('Saved locally');
});

it('forces protection at the maximum dirty delay during continuous typing', async () => {
  const { t, p, scheduler } = cadence({
    recoveryDelayMs: 5000,
    sourceDelayMs: 5000,
    maxDirtyMs: 2000,
  });
  for (let v = 1; v <= 20; v++) {
    scheduler.noteEdit(snapshot(v, v % 2 === 0));
    await t.advance(100);
  }
  expect(p.checkpoints).toHaveLength(0);
  scheduler.noteEdit(snapshot(21, false));
  await drain();
  expect(p.checkpoints.map((c) => c.version)).toEqual([21]);
  expect(p.saves.map((s) => s.version)).toEqual([21]);
});

it('explicit flush bypasses timers and verifies a fresh flush when unchanged', async () => {
  const { t, p, scheduler } = cadence();
  scheduler.noteEdit(snapshot(21, false));
  const summary = await scheduler.flush();
  expect(summary).toMatchObject({ recovered: true, saved: true });
  expect(p.checkpoints.map((c) => c.version)).toEqual([21]);
  expect(p.saves.map((s) => s.version)).toEqual([21]);
  await t.advance(10_000);
  expect(p.checkpoints).toHaveLength(1);
  expect(p.saves).toHaveLength(1);
  const repeat = await scheduler.flush();
  expect(repeat).toMatchObject({ recovered: true, saved: true });
  expect(p.saves).toHaveLength(2);
});

it('checkpoints undo steps as newer versions without clearing later edits', async () => {
  const { t, p, scheduler } = cadence();
  scheduler.noteEdit(snapshot(1, false));
  scheduler.noteEdit(snapshot(2, true));
  scheduler.noteEdit(snapshot(3, false));
  await t.advance(500);
  expect(p.checkpoints.map((c) => c.version)).toEqual([3]);
  await t.advance(250);
  expect(scheduler.describe()).toMatchObject({
    liveVersion: 3,
    journaledVersion: 3,
    fileSavedVersion: 3,
  });
});

it('keeps the latest raw protection visible when the queue saturates', async () => {
  const { t, p, controller, scheduler } = cadence();
  const gate = (() => {
    let release!: () => void;
    const promise = new Promise<void>((r) => (release = r));
    return { promise, release };
  })();
  const native = p.native;
  native.checkpoint = async (req: CheckpointRequest) => {
    await gate.promise;
    return {
      identity: req.identity,
      version: req.version,
      sourceSha256: req.sourceSha256,
      generation: req.version,
      protection: 'recoveryCheckpoint',
    };
  };
  for (let v = 1; v <= 8; v++) {
    controller.changed(snapshot(v, false));
    void controller.checkpoint(snapshot(v, false)).catch(() => undefined);
  }
  scheduler.noteEdit(snapshot(9, false));
  await t.advance(500);
  await drain();
  expect(scheduler.describe().liveVersion).toBe(9);
  expect(scheduler.describe().journaledVersion).toBe(0);
  gate.release();
  await drain();
  const summary = await scheduler.flush();
  expect(summary.recovered).toBe(true);
});

it('surfaces source failure with recovery intact and retries only on demand', async () => {
  const { t, p, scheduler } = cadence();
  const native = p.native;
  const workingSave = native.save;
  native.save = async (req: SaveRequest) => {
    p.saves.push(req);
    throw {
      identity: req.identity,
      version: req.version,
      error: { code: 'io', action: 'retry' },
      replacement: 'sourceUnchanged',
      recovery: {
        identity: req.identity,
        version: req.version,
        sourceSha256: req.sourceSha256,
        generation: req.version,
        protection: 'recoveryCheckpoint',
      },
    };
  };
  scheduler.noteEdit(snapshot(21, false));
  await t.advance(500);
  await t.advance(250);
  await drain();
  expect(scheduler.describe()).toMatchObject({
    status: 'Save failed',
    journaledVersion: 21,
    fileSavedVersion: 0,
  });
  expect(p.saves).toHaveLength(1);
  await t.advance(10_000);
  expect(p.saves).toHaveLength(1);
  native.save = workingSave;
  const summary = await scheduler.flush();
  expect(summary.saved).toBe(true);
});

it('triggers rolling snapshots on a cadence without touching save state', async () => {
  const { t, p, scheduler } = cadence({ rollingIntervalMs: 300_000 });
  scheduler.noteEdit(snapshot(21, false));
  await scheduler.flush();
  expect(p.snapshots.created).toHaveLength(1);
  const first = p.snapshots.created[0] as {
    checkpoint: CheckpointRequest;
    kind: string;
    name: null;
  };
  expect(first.kind).toBe('rolling');
  expect(first.name).toBeNull();
  expect(first.checkpoint.version).toBe(21);
  expect(first.checkpoint.sourceSha256).toBe(A);
  scheduler.noteEdit(snapshot(22, true));
  await scheduler.flush();
  expect(p.snapshots.created).toHaveLength(1);
  await t.advance(300_001);
  scheduler.noteEdit(snapshot(23, true));
  await scheduler.flush();
  expect(p.snapshots.created).toHaveLength(2);
  expect(scheduler.describe()).toMatchObject({
    status: 'Saved locally',
    lastRollingVersion: 23,
    snapshotAttention: false,
  });
});

it('isolates snapshot failure from save protection', async () => {
  const { p, scheduler } = cadence({ rollingIntervalMs: 0 });
  p.snapshots.create = async () => {
    throw new Error('snapshot store busy');
  };
  scheduler.noteEdit(snapshot(21, false));
  const summary = await scheduler.flush();
  expect(summary.saved).toBe(true);
  expect(summary.snapshotAttention).toBe(true);
  expect(scheduler.describe().status).toBe('Saved locally');
  expect(scheduler.describe().snapshotAttention).toBe(true);
});

it('protects unsaved drafts through recovery only', async () => {
  const seed = opened();
  seed.fingerprint = null;
  const { p, scheduler } = cadence(undefined, seed);
  scheduler.noteEdit(snapshot(1, false));
  const summary = await scheduler.flush();
  expect(summary).toMatchObject({ recovered: true, saved: false });
  expect(p.saves).toHaveLength(0);
  expect(scheduler.describe().status).toBe(
    'Recovery protected; file save pending',
  );
});

it('refuses work after dispose without losing confirmed state', async () => {
  const { scheduler } = cadence();
  scheduler.noteEdit(snapshot(21, false));
  await scheduler.flush();
  scheduler.dispose();
  expect(() => scheduler.noteEdit(snapshot(22, false))).toThrow();
  await expect(scheduler.flush()).rejects.toThrow();
  expect(scheduler.describe().status).toBe('Saved locally');
});

/* End of cadence contract. */
