import type { EditorView } from 'prosemirror-view';
import type {
  CheckpointReceipt,
  CheckpointRequest,
  DiskFingerprint,
  DocumentIdentity,
} from './documents';
import { EditorCaptureBoundary } from './editorCapture';
import { MAX_SOURCE_BYTES, validHash } from './persistenceState';
import { sourceImportTransaction } from '../editor/state';
import { dispatchIsolated } from '../editor/formatting';

export interface ImportProtectionReceipt {
  checkpoint: CheckpointReceipt;
  revision: {
    documentId: string;
    version: number | null;
    sourceSha256: string;
    profileSha256: string;
    commitId: string;
    changed: boolean;
    safetyRef: string | null;
  };
}
export interface FountainImportPort {
  protect(request: CheckpointRequest): Promise<ImportProtectionReceipt>;
}
export type ImportResult =
  | { status: 'imported'; protection: ImportProtectionReceipt }
  | { status: 'refused'; reason: string };
class ImportRefusal extends Error {}

/** Explicit whole-screenplay import, never the ordinary clipboard path. */
export class FountainImportBoundary {
  private busy = false;
  constructor(
    private readonly getView: () => EditorView,
    private readonly identity: DocumentIdentity,
    private readonly fingerprint:
      DiskFingerprint | null | (() => DiskFingerprint | null),
    private readonly port: FountainImportPort,
    private readonly capture = new EditorCaptureBoundary(() => getView().state),
    private readonly coordinated?: (
      apply: () => boolean,
      signal?: AbortSignal,
    ) => Promise<import('./workflowProtection').WorkflowResult>,
  ) {}
  async import(bytes: Uint8Array, signal?: AbortSignal): Promise<ImportResult> {
    if (this.busy)
      return {
        status: 'refused',
        reason: 'An import is already pending; imported content retained',
      };
    if (bytes.length > MAX_SOURCE_BYTES)
      return {
        status: 'refused',
        reason: 'Import exceeds the local source limit; content retained',
      };
    const immutable = bytes.slice();
    const view = this.getView();
    const state = view.state;
    if (view.composing || view.isDestroyed)
      return {
        status: 'refused',
        reason: 'Finish composing before importing Fountain',
      };
    this.busy = true;
    try {
      if (this.coordinated) {
        const result = await this.coordinated(() => {
          if (
            this.getView() !== view ||
            view.state !== state ||
            view.isDestroyed ||
            view.composing
          )
            return false;
          const transaction = sourceImportTransaction(state, immutable);
          dispatchIsolated(view, transaction);
          return view.state.doc === transaction.doc;
        }, signal);
        return result.status === 'applied'
          ? { status: 'imported', protection: result.protection }
          : result;
      }
      if (signal?.aborted)
        throw new ImportRefusal(
          'Operation cancelled; current and staged content retained',
        );
      const result = await this.capture.capture();
      if (
        result.status !== 'current' ||
        this.getView() !== view ||
        view.state !== state ||
        view.isDestroyed ||
        view.composing
      )
        throw new ImportRefusal(
          'Editor changed before protection; retry import',
        );
      const snapshot = result.snapshot;
      const receipt = await this.port.protect({
        identity: this.identity,
        version: snapshot.version,
        source: snapshot.source,
        sourceSha256: snapshot.sourceSha256,
        draftMetadata: snapshot.draftMetadata,
        expectedFingerprint:
          typeof this.fingerprint === 'function'
            ? this.fingerprint()
            : this.fingerprint,
      });
      const { checkpoint: cp, revision: rev } = receipt;
      if (
        cp.identity.handle !== this.identity.handle ||
        cp.identity.documentId !== this.identity.documentId ||
        cp.identity.sessionId !== this.identity.sessionId ||
        cp.version !== snapshot.version ||
        cp.sourceSha256 !== snapshot.sourceSha256 ||
        cp.protection !== 'recoveryCheckpoint' ||
        !Number.isSafeInteger(cp.generation) ||
        cp.generation < 1 ||
        rev.documentId !== this.identity.documentId ||
        rev.version !== snapshot.version ||
        rev.sourceSha256 !== snapshot.sourceSha256 ||
        !validHash(rev.profileSha256) ||
        !/^[a-f0-9]{40}$/.test(rev.commitId) ||
        rev.safetyRef !== `refs/safety/${rev.commitId}`
      )
        throw new ImportRefusal(
          'Native import protection did not acknowledge the exact draft',
        );
      if (
        signal?.aborted ||
        !this.capture.isCurrent(snapshot) ||
        this.getView() !== view ||
        view.state !== state ||
        view.isDestroyed ||
        view.composing
      )
        throw new ImportRefusal(
          'Editor changed while protecting; retry import',
        );
      const transaction = sourceImportTransaction(state, immutable);
      dispatchIsolated(view, transaction);
      if (view.state.doc !== transaction.doc)
        throw new ImportRefusal('Editor refused the import');
      return { status: 'imported', protection: receipt };
    } catch (error) {
      return {
        status: 'refused',
        reason:
          error instanceof ImportRefusal
            ? error.message
            : 'Import protection failed; current and imported content retained',
      };
    } finally {
      this.busy = false;
    }
  }
}
