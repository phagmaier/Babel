/**
 * M3-12 production writing lifecycle. One active session binds an opened
 * document, its persistence controller, save cadence and protected close to a
 * single editor owner supplied by the view. Identity switches dispose the old
 * persistence stack; adopted bytes cross explicit editor history boundaries.
 *
 * Recovery/restore/import never delete material: both generations survive and
 * only exact receipts advance protection state. There is no history
 * dependency in this coordinator — history IPC does not exist in the default
 * desktop, so a history failure cannot block saving by construction.
 */
import type { DocumentEntryPort } from './documentEntry';
import type {
  CapturedSnapshot,
  PersistenceController,
} from './persistenceController';
import { PersistenceController as Controller } from './persistenceController';
import type {
  DiskFingerprint,
  DocumentIdentity,
  DocumentPort,
  OpenDocument,
  SaveReceipt,
} from './documents';
import { ProtectedClose } from './protectedClose';
import type { CadenceClock, FlushSummary } from './saveCadence';
import { realClock, SaveCadence } from './saveCadence';
import type { SaveAsPort, SaveStorageRelation } from './saveAs';
import { sameIdentity, type SnapshotPort } from './snapshots';

export interface SessionSelection {
  readonly anchor: number;
  readonly head: number;
}

/** ProseMirror view side. Selections round-trip opaquely; out-of-range values are clamped by the view. */
export interface SessionEditor {
  loadInitial(
    source: readonly number[],
    selection: SessionSelection | null,
    writable: boolean,
    initialVersion: number,
  ): void;
  applySource(
    source: readonly number[],
    version: number,
    selection: SessionSelection | null,
  ): void;
  capture(): Promise<CapturedSnapshot>;
  freeze(): () => void;
  getSelection(): SessionSelection | null;
  setSelection(selection: SessionSelection | null): void;
}

export interface SessionPorts {
  entry: DocumentEntryPort;
  documents: DocumentPort;
  saveAs: SaveAsPort;
  snapshots: SnapshotPort;
  recovery?: import('./startupRecovery').RecoveryPort;
}

export interface ActiveInfo {
  identity: DocumentIdentity;
  kind: OpenDocument['kind'];
  readOnly: boolean;
  readOnlyReason: string | null;
  liveVersion: number;
  fingerprint: DiskFingerprint | null;
}

export type SaveAsOutcome =
  | { status: 'cancelled' }
  | {
      status: 'published';
      fileName: string;
      storageRelation: SaveStorageRelation;
    };
export type ExportOutcome =
  | { status: 'cancelled' }
  | {
      status: 'copied';
      fileName: string;
      storageRelation: SaveStorageRelation;
    };

function matchLive(
  state: { liveVersion: number; liveSha256: string; liveByteLength: number },
  snapshot: CapturedSnapshot,
  action: string,
): void {
  if (
    snapshot.version !== state.liveVersion ||
    snapshot.sourceSha256 !== state.liveSha256 ||
    snapshot.source.length !== state.liveByteLength
  )
    throw new Error(`Editor changed during ${action}`);
}

export class WritingSession {
  private disposed = false;
  private opened: OpenDocument | null = null;
  private controller: PersistenceController | null = null;
  private cadence: SaveCadence | null = null;
  private closer: ProtectedClose | null = null;

  constructor(
    private readonly ports: SessionPorts,
    private readonly editor: SessionEditor,
    private readonly clock: CadenceClock = realClock,
    private readonly onChange: () => void = () => undefined,
  ) {}

  get active(): ActiveInfo | null {
    if (!this.opened || !this.controller) return null;
    const state = this.controller.state;
    const exclusive = this.opened.ownership.status === 'exclusive';
    const utf8 = this.opened.encoding === 'utf8';
    const reason = !exclusive
      ? 'The source is open read-only.'
      : !utf8
        ? 'The source encoding is unsupported; viewing only.'
        : state.fileBlocked || state.externalChange
          ? 'Saving needs attention before the next source save.'
          : null;
    return {
      identity: { ...this.opened.identity },
      kind: this.opened.kind,
      readOnly: !exclusive || !utf8,
      readOnlyReason: reason,
      liveVersion: state.liveVersion,
      fingerprint: state.fingerprint ? { ...state.fingerprint } : null,
    };
  }

  get close(): ProtectedClose {
    if (!this.closer) throw new Error('No active writing session');
    return this.closer;
  }

  get cadenceStatus() {
    if (!this.cadence) throw new Error('No active writing session');
    return this.cadence.describe();
  }

  /** Latest capture becomes the live version. The view calls this after every edit. */
  async noteEdit(): Promise<void> {
    if (!this.cadence) throw new Error('No active writing session');
    // Cadence records the controller version itself; recording twice would
    // reject the second identical version.
    const cadence = this.cadence;
    const controller = this.controller!;
    const snapshot = await this.editor.capture();
    if (cadence !== this.cadence) return;
    if (snapshot.version > controller.state.liveVersion)
      cadence.noteEdit(snapshot);
  }

  async openNew(): Promise<void> {
    this.requireEmpty();
    await this.adoptFresh(await this.ports.entry.createUnsaved());
  }

  /** False means the picker was cancelled; nothing changed. */
  async openPicked(): Promise<boolean> {
    this.requireEmpty();
    const opened = await this.ports.entry.openViaPicker();
    if (!opened) return false;
    await this.adoptFresh(opened);
    return true;
  }

  async save(): Promise<FlushSummary> {
    const active = this.requireActive();
    if (active.readOnly) throw new Error('Read-only sessions cannot save');
    await this.synchronize();
    return this.cadence!.flush();
  }

  /**
   * Save As publishes the latest bytes beside the untouched source.
   * Cancellation or publication failure retains the old active session.
   * Adoption mints a fresh persistence stack: old captures and receipts are
   * unreachable afterwards, selection is preserved, and the rebuilt editor
   * state starts a new undo history.
   */
  async saveAs(): Promise<SaveAsOutcome> {
    const active = this.requireActive();
    if (active.readOnly) throw new Error('Read-only sessions cannot Save As');
    const controller = this.controller!;
    const identity = controller.state.identity;
    const target = await this.ports.saveAs.selectDestination(identity);
    if (!target) return { status: 'cancelled' };
    return this.withFrozen(async (snapshot) => {
      const state = controller.state;
      // Protect the frozen live draft before publishing or retiring its identity.
      await controller.checkpoint(snapshot);
      const published = await this.ports.saveAs.saveAs({
        checkpoint: this.checkpoint(snapshot),
        destinationToken: target.token,
      });
      if (
        published.version !== snapshot.version ||
        published.sourceSha256 !== snapshot.sourceSha256 ||
        sameIdentity(published.document.identity, state.identity) ||
        published.document.source.length !== snapshot.source.length ||
        published.document.source.some(
          (byte, index) => byte !== snapshot.source[index],
        ) ||
        published.document.fingerprint?.sha256 !== snapshot.sourceSha256
      )
        throw new Error('Save As registration does not match published bytes');
      const selection = this.editor.getSelection();
      try {
        await this.ports.documents.release(state.identity);
      } catch (error) {
        // The publication stands alone, but its unused registration must not leak.
        await this.ports.documents
          .release(published.document.identity)
          .catch(() => undefined);
        throw new Error(
          `Previous session could not be released; the new file ${published.fileName} stands alone`,
          { cause: error },
        );
      }
      this.retire();
      await this.adoptFresh(published.document, snapshot.source, selection);
      await this.cadence!.flush();
      return {
        status: 'published',
        fileName: published.fileName,
        storageRelation: published.storageRelation,
      };
    });
  }

  /**
   * Export copy leaves identity, captures and receipts untouched; only a
   * verified standalone file is new.
   */
  async exportCopy(): Promise<ExportOutcome> {
    // Copies work independently of read-only ownership; only an active session is required.
    this.requireActive();
    const controller = this.controller!;
    const destination = await this.ports.entry.selectDestination(
      controller.state.identity,
    );
    if (!destination) return { status: 'cancelled' };
    // Re-capture after the dialog: edits made while picking copy nothing.
    const snapshot = await this.synchronize();
    const state = controller.state;
    matchLive(state, snapshot, 'export copy');
    const receipt = await this.ports.snapshots.copy({
      checkpoint: {
        identity: { ...state.identity },
        version: snapshot.version,
        source: snapshot.source,
        sourceSha256: snapshot.sourceSha256,
        expectedFingerprint: state.fingerprint,
        draftMetadata: snapshot.draftMetadata,
      },
      destinationToken: destination.token,
    });
    if (
      !sameIdentity(receipt.identity, state.identity) ||
      receipt.version !== snapshot.version ||
      receipt.sourceSha256 !== snapshot.sourceSha256 ||
      receipt.byteLength !== snapshot.source.length ||
      receipt.fileName.length === 0
    )
      throw new Error('Export copy receipt does not match latest version');
    return {
      status: 'copied',
      fileName: receipt.fileName,
      storageRelation: receipt.storageRelation,
    };
  }

  /**
   * Adopt recovery/restore bytes as one explicit editor transaction. The new
   * editor version must advance the live sequence, establishing an
   * explicit history boundary; the exact native receipt then re-anchors the
   * persistence baseline so later saves compare against the adopted
   * generation instead of a stale fingerprint.
   */
  async adoptExternalBytes(
    source: readonly number[],
    receipt: SaveReceipt,
  ): Promise<void> {
    const active = this.requireActive();
    if (active.readOnly)
      throw new Error('Read-only sessions cannot adopt bytes');
    const controller = this.controller!;
    const current = await this.editor.capture();
    matchLive(controller.state, current, 'external adoption');
    if (receipt.version <= current.version)
      throw new Error('Adopted version must advance the live sequence');
    const sourceSha256 = [
      ...new Uint8Array(
        await crypto.subtle.digest('SHA-256', Uint8Array.from(source).buffer),
      ),
    ]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    controller.validateAdoption(
      {
        ...current,
        version: receipt.version,
        source: [...source],
        sourceSha256,
      },
      receipt,
    );
    const selection = this.editor.getSelection();
    this.editor.applySource(source, receipt.version, selection);
    const next = await this.editor.capture();
    if (
      next.version !== receipt.version ||
      next.sourceSha256 !== receipt.sourceSha256
    )
      throw new Error(
        'Adopted bytes did not land as the acknowledged live version',
      );
    if (next.version > controller.state.liveVersion)
      this.cadence!.noteEdit(next);
    controller.adoptReceipt(next, receipt);
  }

  /** Protect the live editor independently before recovery/restore changes disk. */
  async replaceFromNative(
    operation: (
      current: import('./documents').CheckpointRequest,
    ) => Promise<{ source: readonly number[]; receipt: SaveReceipt }>,
  ): Promise<SaveReceipt> {
    if (this.requireActive().readOnly)
      throw new Error('Read-only sessions cannot replace content');
    return this.withFrozen(async (snapshot) => {
      const current = this.checkpoint(snapshot);
      const protectedEntry = await this.ports.snapshots.create({
        checkpoint: current,
        kind: 'preDestructive',
        name: null,
      });
      if (
        !protectedEntry ||
        protectedEntry.record.documentId !== current.identity.documentId ||
        protectedEntry.record.sessionId !== current.identity.sessionId ||
        protectedEntry.record.version !== current.version ||
        protectedEntry.record.sourceSha256 !== current.sourceSha256 ||
        protectedEntry.record.byteLength !== current.source.length ||
        protectedEntry.record.kind !== 'preDestructive'
      )
        throw new Error(
          'Latest editor draft was not protected; replacement stopped',
        );
      const result = await operation(current);
      await this.adoptExternalBytes(result.source, result.receipt);
      return result.receipt;
    });
  }

  async resolveNative(
    operation: () => Promise<import('./recoveryChoices').TransactionResolution>,
  ) {
    return this.withFrozen(async () => {
      const result = await operation();
      if (!sameIdentity(result.identity, this.controller!.state.identity))
        throw new Error(
          'Resolution identity does not match the active session',
        );
      if (result.completed) await this.adoptNativeReceipt(result.completed);
      return result;
    });
  }

  private checkpoint(
    snapshot: CapturedSnapshot,
  ): import('./documents').CheckpointRequest {
    const state = this.controller!.state;
    return {
      version: snapshot.version,
      source: snapshot.source,
      sourceSha256: snapshot.sourceSha256,
      draftMetadata: snapshot.draftMetadata,
      identity: { ...state.identity },
      expectedFingerprint: state.fingerprint,
    };
  }

  private async synchronize(): Promise<CapturedSnapshot> {
    const snapshot = await this.editor.capture();
    const state = this.controller!.state;
    if (snapshot.version > state.liveVersion) this.cadence!.noteEdit(snapshot);
    else matchLive(state, snapshot, 'capture');
    return snapshot;
  }

  private async withFrozen<T>(
    action: (snapshot: CapturedSnapshot) => Promise<T>,
  ): Promise<T> {
    const cadence = this.cadence!;
    const thaw = this.editor.freeze();
    const resume = cadence.pause();
    try {
      await cadence.settle();
      await this.controller!.settle();
      return await action(await this.synchronize());
    } finally {
      resume();
      thaw();
      this.onChange();
    }
  }

  /**
   * Re-anchor after a transaction resolution that completed natively without
   * changing editor bytes. Same-version receipts must match exactly; an older
   * receipt updates only the fingerprint and grants newer edits no save credit.
   */
  async adoptNativeReceipt(receipt: SaveReceipt): Promise<void> {
    const active = this.requireActive();
    if (active.readOnly)
      throw new Error('Read-only sessions cannot adopt receipts');
    const controller = this.controller!;
    const current = await this.editor.capture();
    matchLive(controller.state, current, 'receipt adoption');
    if (receipt.version < current.version)
      controller.adoptResolvedBaseline(receipt);
    else controller.adoptReceipt(current, receipt);
  }

  /**
   * Release the active registration without the close flow. Only for
   * abandoned opens (a dead mount that natively opened after unmount);
   * never for user-visible sessions, which close through ProtectedClose.
   */
  async abandon(): Promise<void> {
    const opened = this.opened;
    this.retire();
    if (opened) await this.ports.documents.release(opened.identity);
  }

  /** Called after the close coordinator reaches 'closed'. */
  finishClose(): void {
    if (!this.closer || this.closer.assessment.phase !== 'closed')
      throw new Error('Session is not closed');
    this.retire();
  }

  dispose(): void {
    this.disposed = true;
    this.retire();
  }

  private requireEmpty(): void {
    if (this.opened) throw new Error('Close the current session first');
  }

  private requireActive(): ActiveInfo {
    const active = this.active;
    if (!active) throw new Error('No active writing session');
    return active;
  }

  private async adoptFresh(
    opened: OpenDocument,
    source?: readonly number[],
    selection: SessionSelection | null = null,
  ): Promise<void> {
    if (this.disposed) {
      await this.ports.documents.release(opened.identity);
      return;
    }
    const controller = new Controller(opened, this.ports.documents);
    const cadence = new SaveCadence(
      controller,
      this.ports.snapshots,
      this.clock,
      undefined,
      this.onChange,
    );
    const closer = new ProtectedClose(
      controller,
      this.ports.documents,
      this.ports.snapshots,
      {
        freeze: () => {
          const thaw = this.editor.freeze();
          const resume = cadence.pause();
          return () => {
            resume();
            thaw();
          };
        },
        capture: async () => {
          await cadence.settle();
          await controller.settle();
          return this.synchronize();
        },
      },
    );
    this.opened = opened;
    this.controller = controller;
    this.cadence = cadence;
    this.closer = closer;
    let initialVersion = 1;
    if (this.ports.recovery) {
      let catalog: import('./startupRecovery').RecoveryCatalog;
      try {
        catalog = await this.ports.recovery.list();
      } catch (error) {
        await this.ports.documents.release(opened.identity);
        this.retire();
        throw error;
      }
      const candidates = catalog.entries
        .filter((entry) => entry.documentId === opened.identity.documentId)
        .flatMap((entry) => [...entry.candidates]);
      initialVersion = Math.max(
        initialVersion,
        ...candidates.map((candidate) => candidate.version + 1),
      );
    }
    if (this.disposed) {
      await this.ports.documents.release(opened.identity);
      return;
    }
    this.editor.loadInitial(
      source ?? opened.source,
      selection,
      !this.active!.readOnly,
      initialVersion,
    );
    const initial = await this.editor.capture();
    if (this.disposed) {
      await this.ports.documents.release(opened.identity);
      return;
    }
    controller.changed(initial);
    cadence.prime(initial);
  }

  private retire(): void {
    try {
      this.cadence?.dispose();
    } catch {
      // Disposal must not hide the adopting session's errors.
    }
    this.opened = null;
    this.controller = null;
    this.cadence = null;
    this.closer = null;
  }
}
