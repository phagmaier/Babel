/**
 * M3-12 production writing lifecycle. One active session binds an opened
 * document, its persistence controller, save cadence and protected close to a
 * single editor owner supplied by the view. Identity switches dispose the old
 * persistence stack; adopted bytes cross explicit editor history boundaries.
 *
 * Recovery/restore/import never delete material: both generations survive and
 * only exact receipts advance protection state. There is no history
 * dependency for ordinary saving. Destructive workflows require a separate
 * checkpoint/safety receipt and exact frozen editor guard.
 */
import type { DocumentEntryPort } from './documentEntry';
import type {
  CapturedSnapshot,
  PersistenceController,
} from './persistenceController';
import { PersistenceController as Controller } from './persistenceController';
import { sameIdentity } from './persistenceState';
import type {
  DiskFingerprint,
  DocumentIdentity,
  DocumentPort,
  OpenDocument,
  JsonValue,
  SaveReceipt,
} from './documents';
import { ProtectedClose } from './protectedClose';
import type { CadenceClock, FlushSummary } from './saveCadence';
import { realClock, SaveCadence } from './saveCadence';
import type { SaveAsPort, SaveStorageRelation } from './saveAs';
import type { SnapshotPort } from './snapshots';
import { sha256 } from './editorCapture';
import { verifiedEditorMetadata } from './editorMetadata';
import {
  validateWorkflowReceipt,
  type WorkflowOperation,
  type WorkflowResult,
  type WorkflowProtectionPort,
} from './workflowProtection';

export interface SessionSelection {
  readonly anchor: number;
  readonly head: number;
}

/** ProseMirror view side. Selections round-trip opaquely; out-of-range values are clamped by the view. */
export interface SessionEditor {
  /** Opaque immutable EditorState token includes document and selection. Missing means unavailable. */
  workflowState?(): { token: object; composing: boolean } | null;
  /** Allow one synchronous owned transaction while all user input remains frozen. */
  applyWorkflow?(apply: () => boolean): boolean;
  loadInitial(
    source: readonly number[],
    selection: SessionSelection | null,
    writable: boolean,
    initialVersion: number,
    draftMetadata?: JsonValue,
  ): void;
  applySource(
    source: readonly number[],
    version: number,
    selection: SessionSelection | null,
  ): void;
  capture(): Promise<CapturedSnapshot>;
  captureDraft(): Promise<CapturedSnapshot>;
  prepareSource(
    source: readonly number[],
    version: number,
    draftMetadata?: JsonValue,
  ): Promise<{ snapshot: CapturedSnapshot; apply(): void }>;
  retain(): () => void;
  getVersion(): number;
  advanceVersion(version: number): void;
  freeze(): () => void;
  getSelection(): SessionSelection | null;
  setSelection(selection: SessionSelection | null): void;
}

export interface SessionPorts {
  entry: DocumentEntryPort;
  documents: DocumentPort;
  externalSource?: import('./documents').ExternalSourcePort;
  saveAs: SaveAsPort;
  snapshots: SnapshotPort;
  recovery?: import('./startupRecovery').RecoveryPort;
  workflows?: WorkflowProtectionPort;
}

export interface ActiveInfo {
  identity: DocumentIdentity;
  persistentIdentity: boolean;
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
  private workflowBusy = false;
  private sourceCheckBusy = false;
  private externalReview: import('./documents').SourceCheck | null = null;

  get externalChange() {
    return this.externalReview;
  }
  get externalDirty() {
    const state = this.controller?.state;
    return !!state && state.liveSha256 !== state.fingerprint?.sha256;
  }

  /** Advisory check: at most one buffer; ordinary saves keep their native pre-write guard. */
  async checkExternalSource(): Promise<void> {
    const controller = this.controller,
      active = this.active,
      port = this.ports.externalSource;
    if (
      !controller ||
      !active?.fingerprint ||
      active.readOnly ||
      !port ||
      this.sourceCheckBusy
    )
      return;
    this.sourceCheckBusy = true;
    try {
      const observed = await controller.checkSource(port);
      if (controller !== this.controller || !observed) return;
      if (observed.status === 'changed') {
        if (
          !observed.source ||
          (await sha256(Uint8Array.from(observed.source))) !==
            observed.fingerprint.sha256
        )
          throw new Error('External source comparison could not be verified');
        if (
          JSON.stringify(this.externalReview?.fingerprint) !==
          JSON.stringify(observed.fingerprint)
        )
          this.externalReview = observed;
      } else this.externalReview = null;
      this.onChange();
    } finally {
      this.sourceCheckBusy = false;
    }
  }

  async reloadExternalSource(): Promise<SaveReceipt> {
    const review = this.externalReview,
      port = this.ports.externalSource;
    if (!review?.source || !port)
      throw new Error('Check external changes before Reload');
    if (this.requireActive().readOnly)
      throw new Error('Read-only sessions cannot Reload');
    return this.withFrozen(async (snapshot) => {
      const prepared = await this.editor.prepareSource(
        review.source!,
        snapshot.version + 1,
      );
      if (prepared.snapshot.sourceSha256 !== review.fingerprint.sha256)
        throw new Error(
          'External source cannot be captured faithfully; Save As a separate copy',
        );
      try {
        const result = await port.reload({
          current: this.checkpoint(snapshot),
          adopted: {
            ...this.checkpoint(prepared.snapshot),
            expectedFingerprint: review.fingerprint,
          },
        });
        await this.adoptExternalBytes(review.source!, result, prepared);
        this.externalReview = null;
        return result;
      } catch (error) {
        // A reply may be lost after the adopted version was journaled. Skip that
        // reservation while preserving the current bytes/selection/Undo, then protect
        // the retained draft independently. No source receipt or baseline is invented.
        this.editor.advanceVersion(
          Math.max(this.editor.getVersion(), prepared.snapshot.version) + 1,
        );
        try {
          await this.controller!.checkpoint(await this.synchronize());
        } catch (protection) {
          throw new AggregateError(
            [error, protection],
            'Reload stopped; draft protection needs attention. Keep this session open and save a separate copy.',
            { cause: protection },
          );
        }
        throw error;
      }
    });
  }

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
      persistentIdentity: this.opened.persistentIdentity,
      kind: this.opened.kind,
      readOnly: !exclusive || !utf8,
      readOnlyReason: reason,
      liveVersion: Math.max(state.liveVersion, this.editor.getVersion()),
      fingerprint: state.fingerprint ? { ...state.fingerprint } : null,
    };
  }

  get close(): ProtectedClose {
    if (!this.closer) throw new Error('No active writing session');
    return this.closer;
  }

  get cadenceStatus() {
    if (!this.cadence) throw new Error('No active writing session');
    const described = this.cadence.describe();
    const liveVersion = this.editor.getVersion();
    return liveVersion > described.liveVersion
      ? { ...described, liveVersion, status: 'Changes pending' as const }
      : described;
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

  async openRecovery(
    selection: import('./startupRecovery').RecoverySelection,
  ): Promise<void> {
    this.requireEmpty();
    if (!this.ports.recovery) throw new Error('Recovery unavailable');
    const resumed = await this.ports.recovery.resume(selection);
    try {
      await this.adoptFresh(
        resumed.document,
        undefined,
        null,
        resumed.draftMetadata,
      );
      // A stale mount has already released the resumed registration. It must
      // not flush a retired cadence or turn cancellation into an open error.
      if (this.disposed) return;
      const protection = this.active?.readOnly
        ? null
        : await this.cadence!.flush();
      if (this.disposed) return;
      if (protection && !protection.recovered)
        throw new Error(
          'Resumed draft protection could not be confirmed; the original checkpoint remains preserved',
        );
    } catch (error) {
      if (this.opened) {
        try {
          await this.abandon();
        } catch (cleanup) {
          throw new AggregateError(
            [error, cleanup],
            `${error instanceof Error ? error.message : 'Resume failed; the original checkpoint remains preserved'}; native release could not be confirmed`,
            { cause: cleanup },
          );
        }
      }
      throw error;
    }
  }

  /** False means the picker was cancelled; nothing changed. */
  async openPicked(): Promise<boolean> {
    this.requireEmpty();
    const opened = await this.ports.entry.openViaPicker();
    if (!opened) return false;
    await this.adoptFresh(opened);
    return true;
  }

  /** Entry loaders own native selection; stale mounts release returned registrations. */
  async openSelected(load: () => Promise<OpenDocument>): Promise<void> {
    this.requireEmpty();
    await this.adoptFresh(await load());
  }

  async save(): Promise<FlushSummary> {
    const active = this.requireActive();
    if (active.readOnly) throw new Error('Read-only sessions cannot save');
    await this.synchronize();
    return this.cadence!.flush();
  }

  /** Only the caller's separately owned synchronous transaction may edit after protection. */
  async runProtectedWorkflow(
    operation: WorkflowOperation,
    apply: () => boolean,
    signal?: AbortSignal,
  ): Promise<WorkflowResult> {
    if (this.workflowBusy)
      return {
        status: 'refused',
        reason: 'Another protected workflow is pending; retry when it finishes',
      };
    this.workflowBusy = true;
    try {
      const active = this.requireActive();
      if (active.readOnly)
        throw new Error(
          'Read-only drafts cannot run this workflow; use Save As',
        );
      const port = this.ports.workflows;
      if (!port)
        throw new Error(
          'Workflow protection unavailable; keep this draft open and retry',
        );
      const controller = this.controller!;
      const cadence = this.cadence!;
      const initial = this.editor.workflowState?.();
      const version = this.editor.getVersion();
      const selection = this.editor.getSelection();
      const assertCurrent = () => {
        if (signal?.aborted)
          throw new Error(
            'Operation cancelled; current and staged content retained',
          );
        const current = this.editor.workflowState?.();
        const selected = this.editor.getSelection();
        if (
          this.disposed ||
          this.controller !== controller ||
          this.cadence !== cadence ||
          !initial ||
          !current ||
          current.composing ||
          initial.composing ||
          current.token !== initial.token ||
          this.editor.getVersion() !== version ||
          selected?.anchor !== selection?.anchor ||
          selected?.head !== selection?.head
        )
          throw new Error(
            'Draft or selection changed while protecting; finish composition and retry',
          );
      };
      assertCurrent();
      return await this.withFrozen(async (snapshot) => {
        assertCurrent();
        matchLive(controller.state, snapshot, 'workflow protection');
        const request = { operation, checkpoint: this.checkpoint(snapshot) };
        const receipt = await port.protect(request);
        validateWorkflowReceipt(request, receipt);
        assertCurrent();
        // No await separates this final check from the owned editor dispatch.
        if (!this.editor.applyWorkflow || !this.editor.applyWorkflow(apply))
          throw new Error(
            'Editor refused the protected operation; draft retained',
          );
        return { status: 'applied', protection: receipt };
      });
    } catch (error) {
      return {
        status: 'refused',
        reason:
          error instanceof Error
            ? error.message
            : 'Protection failed; draft retained. Retry, Save, or make an emergency copy; history needs attention',
      };
    } finally {
      this.workflowBusy = false;
    }
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
    const controller = this.controller!;
    const identity = controller.state.identity;
    const target = await this.ports.saveAs.selectDestination(identity);
    if (!target) return { status: 'cancelled' };
    return this.withFrozen(async (snapshot) => {
      const state = controller.state;
      // Protect the frozen live draft before publishing or retiring its identity.
      if (!active.readOnly) await controller.checkpoint(snapshot);
      const published = await this.ports.saveAs.saveAs({
        checkpoint: this.checkpoint(snapshot),
        destinationToken: target.token,
      });
      // Captures expose owned byte copies. Read once before the comparison so
      // each indexed access does not allocate another manuscript-sized array.
      const source = snapshot.source;
      if (
        published.version !== snapshot.version ||
        published.sourceSha256 !== snapshot.sourceSha256 ||
        sameIdentity(published.document.identity, state.identity) ||
        published.document.source.length !== source.length ||
        published.document.source.some(
          (byte, index) => byte !== source[index],
        ) ||
        published.document.fingerprint?.sha256 !== snapshot.sourceSha256
      )
        throw new Error('Save As registration does not match published bytes');
      const selection = this.editor.getSelection();
      const rollbackEditor = this.editor.retain();
      const previous = {
        opened: this.opened,
        controller: this.controller,
        cadence: this.cadence,
        closer: this.closer,
      };
      let stage = 'fresh-session adoption';
      try {
        await this.adoptFresh(
          published.document,
          source,
          selection,
          snapshot.draftMetadata,
          (step) => {
            stage = `fresh-session adoption / ${step}`;
          },
        );
        stage = 'original-registration release';
        await this.ports.documents.release(state.identity);
      } catch (error) {
        this.retire();
        await this.ports.documents
          .release(published.document.identity)
          .catch(() => undefined);
        this.opened = previous.opened;
        this.controller = previous.controller;
        this.cadence = previous.cadence;
        this.closer = previous.closer;
        rollbackEditor();
        const code = error as { code?: string; error?: { code?: string } };
        const detail =
          error instanceof Error
            ? error.message
            : (code?.error?.code ?? code?.code ?? 'unconfirmed operation');
        throw new Error(
          `Save As adoption failed during ${stage} (${detail}); the original session remains open and the new file ${published.fileName} stands alone`,
          { cause: error },
        );
      }
      previous.cadence?.dispose();
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
    prepared?: { snapshot: CapturedSnapshot; apply(): void },
  ): Promise<void> {
    const active = this.requireActive();
    if (active.readOnly)
      throw new Error('Read-only sessions cannot adopt bytes');
    const controller = this.controller!;
    const current = await this.editor.capture();
    matchLive(controller.state, current, 'external adoption');
    if (receipt.version <= current.version)
      throw new Error('Adopted version must advance the live sequence');
    const sourceSha256 = await sha256(Uint8Array.from(source));
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
    if (prepared) {
      if (
        prepared.snapshot.version !== receipt.version ||
        prepared.snapshot.sourceSha256 !== sourceSha256
      )
        throw new Error('Prepared replacement does not match the receipt');
      prepared.apply();
    } else this.editor.applySource(source, receipt.version, selection);
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
      prepare: (
        source: readonly number[],
        version: number,
        metadata?: JsonValue,
      ) => Promise<CapturedSnapshot>,
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
      let prepared: { snapshot: CapturedSnapshot; apply(): void } | undefined;
      const result = await operation(
        current,
        async (source, version, metadata) => {
          prepared = await this.editor.prepareSource(
            source,
            version,
            await verifiedEditorMetadata(source, metadata),
          );
          return prepared.snapshot;
        },
      );
      await this.adoptExternalBytes(result.source, result.receipt, prepared);
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

  /** Freeze only capture/protection; review and rendering permit later typing. */
  async captureForPdf(prepare: import('./exportPdf').ExportPdfPort['prepare']) {
    const active = this.requireActive();
    if (active.readOnly)
      throw new Error('Save As a writable copy before PDF export');
    return this.withFrozen(async (snapshot) => {
      await this.controller!.checkpoint(snapshot);
      const receipt = await prepare(this.checkpoint(snapshot));
      if (
        !sameIdentity(receipt.identity, active.identity) ||
        receipt.version !== snapshot.version ||
        receipt.sourceSha256 !== snapshot.sourceSha256 ||
        receipt.checkpoint.version !== snapshot.version ||
        receipt.checkpoint.sourceSha256 !== snapshot.sourceSha256 ||
        !receipt.captureToken
      )
        throw new Error('PDF capture does not match the protected version');
      return { snapshot, receipt };
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
    draftMetadata?: JsonValue,
    adoptionStage: (stage: string) => void = () => undefined,
  ): Promise<void> {
    if (this.disposed) {
      await this.ports.documents.release(opened.identity);
      return;
    }
    // Private Save As error context only; opening and all guards/receipts keep
    // their existing behavior. Priming below does not checkpoint the new identity.
    adoptionStage('controller initialization');
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
        getVersion: () => this.editor.getVersion(),
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
        captureCopy: async () => {
          await cadence.settle();
          await controller.settle();
          try {
            return { snapshot: await this.synchronize() };
          } catch {
            return {
              snapshot: await this.editor.captureDraft(),
              format: 'draftBundle' as const,
            };
          }
        },
      },
    );
    this.externalReview = null;
    this.opened = opened;
    this.controller = controller;
    this.cadence = cadence;
    this.closer = closer;
    let initialVersion = 1;
    if (this.ports.recovery) {
      let entry: import('./startupRecovery').RecoveryEntry;
      try {
        adoptionStage('recovery inspect');
        entry = await this.ports.recovery.inspect(opened.identity);
      } catch (error) {
        try {
          await this.ports.documents.release(opened.identity);
        } finally {
          this.retire();
        }
        throw error;
      }
      adoptionStage('recovery identity');
      if (entry.documentId !== opened.identity.documentId) {
        try {
          await this.ports.documents.release(opened.identity);
        } finally {
          this.retire();
        }
        throw new Error(
          'Recovery identity does not match the selected document',
        );
      }
      const candidates = entry.candidates;
      initialVersion = Math.max(
        initialVersion,
        ...candidates.map((candidate) => candidate.version + 1),
      );
    }
    if (this.disposed) {
      await this.ports.documents.release(opened.identity);
      return;
    }
    try {
      adoptionStage('metadata verification');
      const metadata = await verifiedEditorMetadata(
        source ?? opened.source,
        draftMetadata,
      );
      adoptionStage('editor load');
      this.editor.loadInitial(
        source ?? opened.source,
        selection,
        opened.ownership.status === 'exclusive' && opened.encoding === 'utf8',
        initialVersion,
        metadata,
      );
      adoptionStage('editor capture');
      const initial = await this.editor.capture();
      if (this.disposed) {
        await this.ports.documents.release(opened.identity);
        return;
      }
      adoptionStage('controller captured-version initialization');
      controller.changed(initial);
      adoptionStage('cadence prime');
      cadence.prime(initial);
    } catch (error) {
      try {
        await this.ports.documents.release(opened.identity);
      } catch (cleanup) {
        throw new AggregateError(
          [error, cleanup],
          'Opening failed and native release could not be confirmed',
          { cause: cleanup },
        );
      } finally {
        this.retire();
      }
      throw error;
    }
  }

  private retire(): void {
    try {
      this.cadence?.dispose();
    } catch {
      // Disposal must not hide the adopting session's errors.
    }
    this.externalReview = null;
    this.opened = null;
    this.controller = null;
    this.cadence = null;
    this.closer = null;
  }
}
