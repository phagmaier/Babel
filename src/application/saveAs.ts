/**
 * Save As versus Export Fountain copy.
 *
 * An export writes a standalone copy and leaves the active document and
 * identity unchanged. Save As publishes the current bytes to a natively
 * selected file and returns a fresh registration; adopting the new identity
 * (invalidating old captures/receipts) stays the caller's explicit step.
 */
import type {
  CheckpointRequest,
  DocumentIdentity,
  OpenDocument,
} from './documents';
import type { CopyDestination } from './snapshots';

export type SaveStorageRelation = CopyDestination['storageRelation'];

export interface SaveTarget {
  token: string;
  fileName: string;
  storageRelation: SaveStorageRelation;
}

export interface SaveAsRequest {
  checkpoint: CheckpointRequest;
  destinationToken: string;
}

export interface SaveAsResult {
  document: OpenDocument;
  version: number;
  sourceSha256: string;
  fileName: string;
  storageRelation: SaveStorageRelation;
}

export interface SaveAsPort {
  /** Native file-save picker. Null means the user cancelled. */
  selectDestination(identity: DocumentIdentity): Promise<SaveTarget | null>;
  /** Publishes to the selected file; never mutates the source registration. */
  saveAs(request: SaveAsRequest): Promise<SaveAsResult>;
}
