/** Close policy for one editor authority. The owner freezes editing synchronously
 * before capture and keeps it frozen until native relinquishment completes. */
import type { DocumentPort } from './documents';
import type {
  CapturedSnapshot,
  PersistenceController,
} from './persistenceController';
import { sameIdentity } from './persistenceState';
import type { ExternalCopyReceipt, SnapshotPort } from './snapshots';

export interface CloseOwner {
  freeze(): () => void;
  getVersion(): number;
  capture(): Promise<CapturedSnapshot>;
  captureCopy(): Promise<{
    snapshot: CapturedSnapshot;
    format?: 'draftBundle';
  }>;
}
export type ClosePhase = 'editing' | 'working' | 'attention' | 'closed';
export interface CloseAssessment {
  phase: ClosePhase;
  liveVersion: number;
  sourceProtected: boolean;
  recoveryProtected: boolean;
  onlyInMemory: boolean;
  message: string;
}

export class ProtectedClose {
  private phase: ClosePhase = 'editing';
  private message = '';
  private readonly listeners = new Set<(state: CloseAssessment) => void>();

  constructor(
    private readonly controller: PersistenceController,
    private readonly documents: DocumentPort,
    private readonly copies: Pick<SnapshotPort, 'copy'>,
    private readonly owner: CloseOwner,
  ) {}

  subscribe(listener: (state: CloseAssessment) => void): () => void {
    this.listeners.add(listener);
    listener(this.assessment);
    return () => this.listeners.delete(listener);
  }

  get assessment(): CloseAssessment {
    const state = this.controller.state;
    const liveVersion = this.owner.getVersion();
    const sourceProtected =
      liveVersion === state.liveVersion &&
      state.fingerprint !== null &&
      state.fileSavedVersion === state.liveVersion &&
      state.fileSavedSha256 === state.liveSha256 &&
      !state.fileBlocked;
    const recoveryProtected =
      liveVersion === state.liveVersion &&
      state.liveVersion > 0 &&
      state.journaledVersion === state.liveVersion &&
      state.journaledSha256 === state.liveSha256;
    return {
      phase: this.phase,
      liveVersion,
      sourceProtected,
      recoveryProtected,
      onlyInMemory: !sourceProtected && !recoveryProtected,
      message: this.message,
    };
  }

  private publish(phase: ClosePhase, message: string): void {
    this.phase = phase;
    this.message = message;
    for (const listener of this.listeners) {
      try {
        listener(this.assessment);
      } catch {
        // A presentation callback cannot change native close/protection results.
      }
    }
  }

  private async withFrozen(action: () => Promise<void>): Promise<void> {
    if (this.phase === 'working' || this.phase === 'closed')
      throw new Error('Close operation unavailable');
    // freeze() must synchronously reject editor transactions and return a thaw callback.
    let thaw: () => void;
    try {
      thaw = this.owner.freeze();
    } catch (error) {
      this.publish(
        'attention',
        error instanceof Error
          ? error.message
          : 'Close waits until the current operation finishes.',
      );
      throw error;
    }
    this.publish('working', 'Protecting the latest version before close…');
    try {
      await action();
    } catch (error) {
      this.publish(
        'attention',
        this.assessment.onlyInMemory
          ? 'Close stopped. Newer changes exist only in memory. Retry, save an emergency copy, or explicitly accept the risk of losing them.'
          : 'Close stopped. The latest source save or close could not be confirmed. Retry, save an emergency copy, or explicitly accept the risk.',
      );
      throw error;
    } finally {
      if (this.assessment.phase !== 'closed') thaw();
    }
  }

  private async withCapture(
    action: (snapshot: CapturedSnapshot) => Promise<void>,
  ): Promise<void> {
    await this.withFrozen(async () => {
      const snapshot = await this.owner.capture();
      const state = this.controller.state;
      if (
        snapshot.version !== this.owner.getVersion() ||
        snapshot.version !== state.liveVersion ||
        snapshot.sourceSha256 !== state.liveSha256 ||
        snapshot.source.length !== state.liveByteLength
      )
        throw new Error('Latest editor version changed during close');
      await action(snapshot);
    });
  }

  /** Explicit Save bypasses any ordinary cadence; an unsaved draft needs a checkpoint. */
  async retry(): Promise<void> {
    await this.withCapture(async (snapshot) => {
      const state = this.controller.state;
      if (!state.writable) {
        await this.documents.release(state.identity);
        this.publish(
          'closed',
          'Read-only document closed. The source was unchanged.',
        );
        return;
      }
      if (state.fingerprint && !state.fileBlocked && !state.externalChange) {
        try {
          await this.controller.save(snapshot);
        } catch (error) {
          // Source save protects recovery first. If it did not, try raw recovery
          // independently without granting source credit.
          if (!this.assessment.recoveryProtected) {
            try {
              await this.controller.checkpoint(snapshot);
            } catch {
              // The original source failure is the actionable result.
            }
          }
          throw error;
        }
        if (!this.assessment.sourceProtected)
          throw new Error('Exact source receipt missing');
      } else if (!state.fingerprint) {
        await this.controller.checkpoint(snapshot);
        if (!this.assessment.recoveryProtected)
          throw new Error('Exact recovery receipt missing');
      } else {
        // Diverged/uncertain source must not be retried against a guessed baseline.
        if (!this.assessment.recoveryProtected)
          await this.controller.checkpoint(snapshot);
        throw new Error(
          'Source requires explicit conflict or transaction resolution',
        );
      }
      await this.documents.release(state.identity);
      this.publish(
        'closed',
        state.fingerprint
          ? 'Latest version saved locally and closed.'
          : 'Unsaved draft recovery protected and closed.',
      );
    });
  }

  /** Destination token comes only from native selection. A copy grants no source credit. */
  async saveEmergencyCopy(
    destinationToken: string,
  ): Promise<ExternalCopyReceipt> {
    let confirmed: ExternalCopyReceipt | undefined;
    await this.withFrozen(async () => {
      const { snapshot, format } = await this.owner.captureCopy();
      if (snapshot.version !== this.owner.getVersion())
        throw new Error('Draft changed during emergency copy');
      const state = this.controller.state;
      if (
        !format &&
        (snapshot.version !== state.liveVersion ||
          snapshot.sourceSha256 !== state.liveSha256 ||
          snapshot.source.length !== state.liveByteLength)
      )
        throw new Error('Latest editor capture does not match emergency copy');
      const receipt = await this.copies.copy({
        checkpoint: {
          identity: state.identity,
          version: snapshot.version,
          source: snapshot.source,
          sourceSha256: snapshot.sourceSha256,
          expectedFingerprint: state.fingerprint,
          draftMetadata: snapshot.draftMetadata,
        },
        destinationToken,
        ...(format ? { format } : {}),
      });
      if (
        !sameIdentity(receipt.identity, state.identity) ||
        receipt.version !== snapshot.version ||
        receipt.sourceSha256 !== snapshot.sourceSha256 ||
        receipt.byteLength !== snapshot.source.length ||
        typeof receipt.fileName !== 'string' ||
        receipt.fileName.length === 0 ||
        (format === 'draftBundle' &&
          !receipt.fileName.endsWith('.draft.json')) ||
        !['sameFilesystem', 'unknownPhysicalDisk'].includes(
          receipt.storageRelation,
        )
      )
        throw new Error('Emergency copy receipt does not match latest version');
      confirmed = receipt;
      // A verified external copy permits relinquishing even when an earlier
      // source result is uncertain; native recovery/transaction files remain.
      await this.documents.releaseAtRisk(state.identity);
      this.publish(
        'closed',
        format
          ? 'Draft recovery bundle verified and document closed. The Fountain source was not marked saved.'
          : 'Exact emergency copy verified and document closed. The source file was not marked saved.',
      );
    });
    return confirmed!;
  }

  /** Caller must display the current assessment and obtain a fresh explicit choice. */
  async acceptRisk(
    confirmed: boolean,
    expectedVersion = this.owner.getVersion(),
  ): Promise<void> {
    if (!confirmed) throw new Error('Explicit close risk acceptance required');
    await this.withFrozen(async () => {
      if (this.owner.getVersion() !== expectedVersion)
        throw new Error(
          'The draft changed; review the current close risk again',
        );
      await this.documents.releaseAtRisk(this.controller.state.identity);
      this.publish(
        'closed',
        'Closed with explicit risk. Unprotected changes may be lost.',
      );
    });
  }
}
