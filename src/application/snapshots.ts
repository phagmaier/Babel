/** Independent snapshot/copy receipts never grant file-save or recovery credit. */
import type {
  CheckpointRequest,
  DocumentIdentity,
  DiskFingerprint,
  SaveReceipt,
} from './documents';
export type SnapshotKind = 'rolling' | 'named' | 'preDestructive';
export interface SnapshotSelection {
  snapshotId: string;
  recordSha256: string;
}
export interface SnapshotEntry {
  selection: SnapshotSelection;
  record: {
    schemaVersion: 1;
    snapshotId: string;
    documentId: string;
    sessionId: string;
    version: number | null;
    sourceSha256: string;
    byteLength: number;
    createdSeconds: number;
    kind: SnapshotKind;
    name: string | null;
  };
}
export interface SnapshotCatalog {
  entries: SnapshotEntry[];
  sourceBytes: number;
  needsAttention: boolean;
  unresolvedArtifacts: number;
  orphanBlobs: number;
  atLimit: boolean;
}
export interface CopyDestination {
  token: string;
  storageRelation: 'sameFilesystem' | 'unknownPhysicalDisk';
}
export interface ExternalCopyReceipt {
  identity: DocumentIdentity;
  version: number;
  sourceSha256: string;
  byteLength: number;
  fileName: string;
  storageRelation: CopyDestination['storageRelation'];
}
export interface SnapshotRequest {
  checkpoint: CheckpointRequest;
  kind: SnapshotKind;
  name: string | null;
}
export interface SnapshotReadRequest {
  identity: DocumentIdentity;
  selection: SnapshotSelection;
}
export interface RestoreSnapshotRequest {
  current: CheckpointRequest;
  selection: SnapshotSelection;
  newVersion: number;
  expectedFingerprint: DiskFingerprint;
}
export interface SnapshotPort {
  list(identity: DocumentIdentity): Promise<SnapshotCatalog>;
  read(
    request: SnapshotReadRequest,
  ): Promise<{ entry: SnapshotEntry; source: readonly number[] }>;
  create(request: SnapshotRequest): Promise<SnapshotEntry | null>;
  prune(identity: DocumentIdentity): Promise<SnapshotCatalog>;
  restore(request: RestoreSnapshotRequest): Promise<SaveReceipt>;
  copy(request: {
    checkpoint: CheckpointRequest;
    destinationToken: string;
  }): Promise<ExternalCopyReceipt>;
}
export function sameIdentity(
  a: DocumentIdentity,
  b: DocumentIdentity,
): boolean {
  return (
    a.handle === b.handle &&
    a.documentId === b.documentId &&
    a.sessionId === b.sessionId
  );
}
export const snapshotPolicy =
  'Snapshots keep changed five-minute copies for one hour, hourly copies for 48 hours and daily copies for 30 days. Named and pre-destructive versions stay protected. The limit is 256 records and 256 MiB of source bytes per document; reaching it stops new snapshots without deleting protected versions.';
export function destinationExplanation(destination: CopyDestination): string {
  return destination.storageRelation === 'sameFilesystem'
    ? 'This destination is on the same filesystem as the source or local recovery store. It does not protect against losing that backing disk.'
    : 'This destination is on a different filesystem. Its physical disk could still be shared with the source; a separate disk backup has not been verified.';
}
