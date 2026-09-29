/** Bounded serial IPC bridge for captured snapshots. Editing, timers and close policy are elsewhere. */
import type {
  DocumentPort,
  JsonValue,
  OpenDocument,
  CheckpointRequest,
  CheckpointReceipt,
  SaveReceipt,
} from './documents';
import {
  acknowledged,
  isSaveReceipt,
  begin,
  edited,
  initialPersistenceState,
  MAX_DRAFT_METADATA_BYTES,
  MAX_SOURCE_BYTES,
  rejected,
  sameIdentity,
  validHash,
  type Operation,
  type PersistenceState,
  type Protection,
} from './persistenceState';

export interface CapturedSnapshot {
  readonly version: number;
  readonly source: readonly number[];
  readonly sourceSha256: string;
  readonly draftMetadata: JsonValue;
}
function metadataIsJson(value: unknown, depth = 0): boolean {
  if (depth > 64) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value))
    return value.every((v) => metadataIsJson(v, depth + 1));
  if (
    typeof value !== 'object' ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return false;
  return Object.values(value).every((v) => metadataIsJson(v, depth + 1));
}
function copy(snapshot: CapturedSnapshot): {
  snapshot: CapturedSnapshot;
  cost: number;
} {
  if (
    !Number.isSafeInteger(snapshot.version) ||
    snapshot.version <= 0 ||
    !validHash(snapshot.sourceSha256) ||
    snapshot.source.length > MAX_SOURCE_BYTES ||
    !snapshot.source.every((b) => Number.isInteger(b) && b >= 0 && b <= 255) ||
    !metadataIsJson(snapshot.draftMetadata)
  )
    throw new Error('Invalid captured snapshot');
  const metadata = JSON.stringify(snapshot.draftMetadata);
  const metadataLength = new TextEncoder().encode(metadata).length;
  if (metadataLength > MAX_DRAFT_METADATA_BYTES)
    throw new Error('Draft metadata too large');
  return {
    snapshot: {
      version: snapshot.version,
      source: Array.from(snapshot.source),
      sourceSha256: snapshot.sourceSha256,
      draftMetadata: JSON.parse(metadata) as JsonValue,
    },
    cost: snapshot.source.length + metadataLength,
  };
}

export class PersistenceController {
  private current: PersistenceState;
  private tail: Promise<void> = Promise.resolve();
  private jobs = 0;
  private bytes = 0;
  constructor(
    opened: OpenDocument,
    private readonly port: DocumentPort,
  ) {
    this.current = initialPersistenceState(opened);
  }
  get state(): PersistenceState {
    return this.current;
  }
  /** A new version includes source/draft changes; an immutable producer supplies its hash. */
  changed(snapshot: CapturedSnapshot): void {
    this.current = edited(
      this.current,
      snapshot.version,
      snapshot.sourceSha256,
      snapshot.source.length,
    );
  }
  checkpoint(snapshot: CapturedSnapshot): Promise<CheckpointReceipt> {
    return this.submit(
      'recoveryCheckpoint',
      snapshot,
    ) as Promise<CheckpointReceipt>;
  }
  /** Every explicit call dispatches a fresh native flush, including exact duplicates. */
  save(snapshot: CapturedSnapshot): Promise<SaveReceipt> {
    return this.submit('sourceFile', snapshot) as Promise<SaveReceipt>;
  }
  /**
   * Anchor an out-of-band native receipt (recovery adoption, snapshot
   * restore, transaction resolution) to the live version. The snapshot must
   * already be live via `changed`; the receipt must match it exactly, or
   * nothing changes. Only this explicit validated adoption can re-anchor a
   * blocked/diverged baseline; ordinary submission guards stay unchanged.
   */
  adoptReceipt(snapshot: CapturedSnapshot, receipt: SaveReceipt): void {
    const before = this.current;
    if (
      snapshot.version !== before.liveVersion ||
      snapshot.sourceSha256 !== before.liveSha256 ||
      snapshot.source.length !== before.liveByteLength
    )
      throw new Error('Snapshot does not match current document version');
    if (
      !sameIdentity(receipt.identity, before.identity) ||
      receipt.version !== before.liveVersion ||
      receipt.sourceSha256 !== before.liveSha256
    )
      throw new Error('Receipt does not match the live version');
    if (before.pending.length)
      throw new Error('Persistence operations still pending');
    const started = begin(
      { ...before, fileBlocked: false, externalChange: false },
      'sourceFile',
    );
    const updated = acknowledged(started.state, started.operation, receipt);
    if (
      updated.pending.includes(started.operation) ||
      updated.failure?.id === started.operation.id
    )
      throw new Error('Invalid persistence receipt');
    this.current = updated;
  }
  /** Explicit native resolution may confirm an older version while newer edits
   * remain live. Re-anchor only the fingerprint; grant no credit to those edits. */
  adoptResolvedBaseline(receipt: SaveReceipt): void {
    const state = this.current;
    if (
      !isSaveReceipt(receipt) ||
      !sameIdentity(receipt.identity, state.identity) ||
      !state.writable ||
      state.pending.length ||
      receipt.version >= state.liveVersion ||
      receipt.version < state.fileSavedVersion
    )
      throw new Error('Invalid resolved baseline receipt');
    this.current = {
      ...state,
      fingerprint: { ...receipt.fingerprint },
      fileBlocked: false,
      externalChange: false,
      failure: null,
    };
  }

  async settle(): Promise<void> {
    await this.tail;
  }

  /** Validate adoption against a proposed state before touching the editor. */
  validateAdoption(snapshot: CapturedSnapshot, receipt: SaveReceipt): void {
    const copied = copy(snapshot).snapshot;
    const state =
      copied.version > this.current.liveVersion
        ? edited(
            this.current,
            copied.version,
            copied.sourceSha256,
            copied.source.length,
          )
        : this.current;
    if (
      state.pending.length ||
      !sameIdentity(receipt.identity, state.identity) ||
      receipt.version !== copied.version ||
      receipt.sourceSha256 !== copied.sourceSha256
    )
      throw new Error('Receipt does not match the live version');
    const started = begin(
      { ...state, fileBlocked: false, externalChange: false },
      'sourceFile',
    );
    const updated = acknowledged(started.state, started.operation, receipt);
    if (
      updated.pending.includes(started.operation) ||
      updated.failure?.id === started.operation.id
    )
      throw new Error('Invalid persistence receipt');
  }

  private submit(
    protection: Protection,
    value: CapturedSnapshot,
  ): Promise<CheckpointReceipt | SaveReceipt> {
    if (this.jobs >= 8)
      return Promise.reject(new Error('Persistence queue full'));
    const { snapshot, cost } = copy(value);
    if (this.bytes + cost > 32 * 1024 * 1024)
      return Promise.reject(new Error('Persistence queue full'));
    if (
      snapshot.version !== this.current.liveVersion ||
      snapshot.sourceSha256 !== this.current.liveSha256 ||
      snapshot.source.length !== this.current.liveByteLength
    ) {
      return Promise.reject(
        new Error('Snapshot does not match current document version'),
      );
    }
    const started = begin(this.current, protection);
    this.current = started.state;
    this.jobs += 1;
    this.bytes += cost;
    const run = () => this.dispatch(started.operation, snapshot);
    const result = this.tail.then(run);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result.finally(() => {
      this.jobs -= 1;
      this.bytes -= cost;
    });
  }
  private async dispatch(
    operation: Operation,
    snapshot: CapturedSnapshot,
  ): Promise<CheckpointReceipt | SaveReceipt> {
    const request: CheckpointRequest = {
      identity: { ...this.current.identity },
      version: snapshot.version,
      source: snapshot.source,
      sourceSha256: snapshot.sourceSha256,
      draftMetadata: snapshot.draftMetadata,
      // Only a validated predecessor's receipt advances this baseline. No disk reload/adoption.
      expectedFingerprint: this.current.fingerprint
        ? { ...this.current.fingerprint }
        : null,
    };
    try {
      if (
        operation.protection === 'sourceFile' &&
        (this.current.fileBlocked ||
          this.current.externalChange ||
          !request.expectedFingerprint)
      ) {
        throw {
          identity: request.identity,
          version: request.version,
          error: { code: 'saveNeedsAttention', action: 'reopenOrSaveCopy' },
          replacement: 'sourceUnchanged',
          recovery: null,
        };
      }
      const receipt =
        operation.protection === 'sourceFile'
          ? await this.port.save({
              ...request,
              expectedFingerprint: request.expectedFingerprint!,
            })
          : await this.port.checkpoint(request);
      const updated = acknowledged(this.current, operation, receipt);
      this.current = updated;
      if (
        updated.pending.includes(operation) ||
        updated.failure?.id === operation.id
      )
        throw new Error('Invalid persistence receipt');
      return receipt;
    } catch (failure: unknown) {
      this.current = rejected(this.current, operation, failure);
      throw failure;
    }
  }
}
