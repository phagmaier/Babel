/**
 * Bounded recovery/source cadence over the serial persistence controller.
 *
 * Targets (SPEC S10.3, engineering aims, never power-loss guarantees):
 * recovery coalescing ~500 ms, ordinary recovery acknowledgement within 1 s,
 * source debounce ~750 ms, maximum 2 s dirty delay during continuous typing.
 * Explicit save/close flushes bypass timers. Unchanged sources still receive a
 * fresh native flush on explicit save (native duplicates sync/verify without
 * replacement); timer saves skip already-saved versions.
 *
 * A failed dispatch never re-arms itself: the failure stays visible in
 * persistence state and only a newer edit or an explicit flush retries, so a
 * persistently failing disk is not hammered at cadence. Snapshot/copy errors
 * never touch save state; they set a separate attention flag.
 */
import type {
  CapturedSnapshot,
  PersistenceController,
} from './persistenceController';
import { persistenceStatus, type PersistenceStatus } from './persistenceState';
import type { SnapshotPort } from './snapshots';

export interface CadenceClock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const realClock: CadenceClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) =>
    clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface CadenceOptions {
  readonly recoveryDelayMs: number;
  readonly sourceDelayMs: number;
  readonly maxDirtyMs: number;
  /** Mirrors the native rolling interval (5 minutes); never a recovery winner. */
  readonly rollingIntervalMs: number;
}

export const defaultCadenceOptions: CadenceOptions = {
  recoveryDelayMs: 500,
  sourceDelayMs: 750,
  maxDirtyMs: 2000,
  rollingIntervalMs: 300_000,
};

export interface CadenceStatus {
  readonly status: PersistenceStatus;
  readonly liveVersion: number;
  readonly journaledVersion: number;
  readonly fileSavedVersion: number;
  readonly snapshotAttention: boolean;
  readonly lastRollingVersion: number | null;
}

export interface FlushSummary {
  /** Latest version is journaled after this flush. */
  readonly recovered: boolean;
  /** Latest version is file-saved after this flush. */
  readonly saved: boolean;
  readonly snapshotAttention: boolean;
}

type Protection = 'recoveryCheckpoint' | 'sourceFile';

export class SaveCadence {
  private latest: CapturedSnapshot | null = null;
  private dirtySince: number | null = null;
  private recoveryTimer: unknown = null;
  private sourceTimer: unknown = null;
  private readonly inFlight: Record<Protection, boolean> = {
    recoveryCheckpoint: false,
    sourceFile: false,
  };
  private lastRollingAt = Number.NEGATIVE_INFINITY;
  private lastRollingSha: string | null = null;
  private lastRollingVersion: number | null = null;
  private snapshotAttention = false;
  private disposed = false;
  private paused = false;
  private readonly jobs = new Set<Promise<void>>();

  constructor(
    private readonly controller: PersistenceController,
    private readonly snapshots: SnapshotPort,
    private readonly clock: CadenceClock = realClock,
    private readonly options: CadenceOptions = defaultCadenceOptions,
    private readonly onChange: () => void = () => undefined,
  ) {}

  /**
   * Session adoption primes the opened version for explicit flushes without
   * touching the controller or arming timers. The caller already recorded the
   * snapshot via `changed`; priming only lets a later explicit Save verify a
   * fresh native flush of the adopted bytes.
   */
  prime(snapshot: CapturedSnapshot): void {
    this.assertLive();
    this.latest = snapshot;
    if (this.dirtySince === null) this.dirtySince = this.clock.now();
  }

  /** An immutable producer supplies every new version, including undo steps. */
  noteEdit(snapshot: CapturedSnapshot): void {
    this.assertLive();
    this.controller.changed(snapshot);
    this.latest = snapshot;
    const now = this.clock.now();
    if (this.dirtySince === null) this.dirtySince = now;
    if (this.paused) return;
    if (now - this.dirtySince >= this.options.maxDirtyMs) {
      this.clearTimers();
      void this.dispatch('recoveryCheckpoint');
      void this.dispatch('sourceFile');
      return;
    }
    if (this.recoveryNeeded()) this.arm('recoveryCheckpoint');
    if (this.sourceNeeded()) this.arm('sourceFile');
  }

  /**
   * Explicit Save: bypass timers, protect the latest version through recovery
   * first, then verify a fresh source flush even when the source is unchanged.
   * Always resolves; outcomes are visible in the returned summary and status.
   */
  async flush(): Promise<FlushSummary> {
    this.assertLive();
    this.clearTimers();
    await this.settle();
    const snapshot = this.latest;
    if (snapshot !== null && this.recoveryNeeded()) {
      await this.dispatch('recoveryCheckpoint');
    }
    if (snapshot !== null && this.sourceRequested()) {
      await this.dispatch('sourceFile', true);
    }
    const state = this.controller.state;
    return {
      recovered:
        snapshot === null || state.journaledVersion >= snapshot.version,
      saved:
        snapshot === null ||
        (state.fileSavedVersion === snapshot.version &&
          state.fileSavedSha256 === snapshot.sourceSha256),
      snapshotAttention: this.snapshotAttention,
    };
  }

  /** Stop timers while a frozen lifecycle operation owns the native baseline. */
  pause(): () => void {
    this.paused = true;
    this.clearTimers();
    return () => {
      this.paused = false;
    };
  }

  async settle(): Promise<void> {
    while (this.jobs.size) await Promise.all([...this.jobs]);
  }

  describe(): CadenceStatus {
    const state = this.controller.state;
    return {
      status: persistenceStatus(state),
      liveVersion: state.liveVersion,
      journaledVersion: state.journaledVersion,
      fileSavedVersion: state.fileSavedVersion,
      snapshotAttention: this.snapshotAttention,
      lastRollingVersion: this.lastRollingVersion,
    };
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimers();
  }

  private assertLive(): void {
    if (this.disposed) throw new Error('Save cadence is disposed');
  }

  private arm(protection: Protection): void {
    this.clear(protection);
    const delay =
      protection === 'recoveryCheckpoint'
        ? this.options.recoveryDelayMs
        : this.options.sourceDelayMs;
    const timer = this.clock.setTimeout(() => {
      if (this.recoveryTimer === timer) this.recoveryTimer = null;
      if (this.sourceTimer === timer) this.sourceTimer = null;
      void this.dispatch(protection);
    }, delay);
    if (protection === 'recoveryCheckpoint') this.recoveryTimer = timer;
    else this.sourceTimer = timer;
  }

  private clear(protection: Protection): void {
    const handle =
      protection === 'recoveryCheckpoint'
        ? this.recoveryTimer
        : this.sourceTimer;
    if (handle !== null) this.clock.clearTimeout(handle);
    if (protection === 'recoveryCheckpoint') this.recoveryTimer = null;
    else this.sourceTimer = null;
  }

  private clearTimers(): void {
    this.clear('recoveryCheckpoint');
    this.clear('sourceFile');
  }

  private recoveryNeeded(): boolean {
    const snapshot = this.latest;
    if (snapshot === null) return false;
    return snapshot.version > this.controller.state.journaledVersion;
  }

  private sourceNeeded(): boolean {
    const snapshot = this.latest;
    if (snapshot === null) return false;
    const state = this.controller.state;
    return (
      (snapshot.version > state.fileSavedVersion ||
        state.fileSavedSha256 !== snapshot.sourceSha256) &&
      state.writable &&
      state.fingerprint !== null &&
      !state.fileBlocked &&
      !state.externalChange
    );
  }

  /** Explicit flush requests a fresh native flush even for unchanged sources. */
  private sourceRequested(): boolean {
    const snapshot = this.latest;
    if (snapshot === null) return false;
    const state = this.controller.state;
    return (
      state.writable &&
      state.fingerprint !== null &&
      !state.fileBlocked &&
      !state.externalChange
    );
  }

  /**
   * @param fresh Explicit saves verify a fresh native flush even when the
   * source is unchanged. Availability guards (writable, baseline, blocks)
   * still apply; only the already-saved skip is bypassed.
   */
  private dispatch(protection: Protection, fresh = false): Promise<void> {
    const job = this.performDispatch(protection, fresh);
    this.jobs.add(job);
    void job.finally(() => this.jobs.delete(job));
    return job;
  }

  private async performDispatch(
    protection: Protection,
    fresh = false,
  ): Promise<void> {
    const snapshot = this.latest;
    const needed =
      protection === 'recoveryCheckpoint'
        ? this.recoveryNeeded()
        : fresh
          ? this.sourceRequested()
          : this.sourceNeeded();
    if (snapshot === null || this.inFlight[protection] || !needed) {
      this.refreshDirty();
      return;
    }
    this.inFlight[protection] = true;
    try {
      if (protection === 'recoveryCheckpoint') {
        await this.controller.checkpoint(snapshot);
      } else {
        const receipt = await this.controller.save(snapshot);
        await this.maybeRollingSnapshot(snapshot, receipt.sourceSha256);
      }
    } catch {
      // Failure stays visible in persistence state; only a newer edit or an
      // explicit flush retries. Snapshot errors are isolated below.
    } finally {
      this.inFlight[protection] = false;
      this.refreshDirty();
      this.onChange();
      // A newer edit may have spent both timers while this older job ran.
      // Drain that edit once; never automatically retry the same failed version.
      if (
        !this.disposed &&
        !this.paused &&
        this.latest &&
        this.latest.version > snapshot.version &&
        (protection === 'recoveryCheckpoint'
          ? this.recoveryNeeded()
          : this.sourceNeeded())
      )
        void this.dispatch(protection);
    }
  }

  private async maybeRollingSnapshot(
    snapshot: CapturedSnapshot,
    sourceSha256: string,
  ): Promise<void> {
    const state = this.controller.state;
    if (
      this.clock.now() - this.lastRollingAt < this.options.rollingIntervalMs ||
      sourceSha256 === this.lastRollingSha ||
      state.fingerprint === null
    )
      return;
    try {
      await this.snapshots.create({
        checkpoint: {
          identity: { ...state.identity },
          version: snapshot.version,
          source: [...snapshot.source],
          sourceSha256: snapshot.sourceSha256,
          expectedFingerprint: { ...state.fingerprint },
          draftMetadata: snapshot.draftMetadata,
        },
        kind: 'rolling',
        name: null,
      });
      this.lastRollingAt = this.clock.now();
      this.lastRollingSha = sourceSha256;
      this.lastRollingVersion = snapshot.version;
      this.snapshotAttention = false;
    } catch {
      // Snapshot/copy errors remain separate from save state.
      this.snapshotAttention = true;
    }
  }

  private refreshDirty(): void {
    const snapshot = this.latest;
    if (snapshot === null) {
      this.dirtySince = null;
      return;
    }
    const state = this.controller.state;
    const recovered = snapshot.version <= state.journaledVersion;
    const saved =
      state.fileSavedVersion === snapshot.version &&
      state.fileSavedSha256 === snapshot.sourceSha256;
    if (recovered && (saved || !this.sourceRequested())) this.dirtySince = null;
  }
}
