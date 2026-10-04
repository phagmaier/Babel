/**
 * Explicit recovery choices over a natively opened source. Requests carry
 * opaque identity plus the exact recovery selection and expected fingerprint
 * from a prior comparison; no path ever crosses the boundary. A choice never
 * deletes recovery or source material.
 */
import type {
  DiskFingerprint,
  DocumentIdentity,
  SaveReceipt,
} from './documents';
import type { RecoveryCandidate, RecoverySelection } from './startupRecovery';

export type ChoiceSourceStatus = 'current' | 'missing' | 'unreadable';
export type ChoiceTransaction =
  | 'noTransaction'
  | 'prepared'
  | 'installedCandidateUnconfirmed'
  | 'confirmedRecordMatchesSource'
  | 'confirmedRecordDiverged'
  | 'diverged'
  | 'needsAttention';

export interface ChoiceSourceSnapshot {
  status: ChoiceSourceStatus;
  fingerprint: DiskFingerprint | null;
  sourceSha256: string | null;
  byteLength: number | null;
  encoding: 'utf8' | 'unsupported' | null;
}

/** Facts about both generations. No timestamp is exposed, so no winner is picked by clock. */
export interface RecoveryComparison {
  identity: DocumentIdentity;
  selection: RecoverySelection;
  recovery: RecoveryCandidate;
  source: ChoiceSourceSnapshot;
  identical: boolean;
  externalDivergence: boolean;
  transaction: ChoiceTransaction;
}

export interface RecoverRequest {
  identity: DocumentIdentity;
  selection: RecoverySelection;
  newVersion: number;
  replacementMetadata?: import('./documents').JsonValue;
  expectedFingerprint: DiskFingerprint;
}

export interface KeepRequest {
  identity: DocumentIdentity;
  selection: RecoverySelection;
  expectedFingerprint: DiskFingerprint;
}

export interface CopyRequest {
  identity: DocumentIdentity;
  selection: RecoverySelection;
  expectedFingerprint: DiskFingerprint;
}

export interface CopyReceipt {
  identity: DocumentIdentity;
  version: number;
  /** Sibling file name only, never a path. */
  fileName: string;
  fingerprint: DiskFingerprint;
  sourceSha256: string;
  byteLength: number;
}

export interface TransactionResolution {
  identity: DocumentIdentity;
  observation: ChoiceTransaction;
  completed: SaveReceipt | null;
  previousPreserved: boolean;
}

export interface RecoveryChoicesPort {
  compare(selection: {
    identity: DocumentIdentity;
    selection: RecoverySelection;
  }): Promise<RecoveryComparison>;
  recover(request: RecoverRequest): Promise<SaveReceipt>;
  keep(request: KeepRequest): Promise<RecoveryComparison>;
  copy(request: CopyRequest): Promise<CopyReceipt>;
  resolve(identity: DocumentIdentity): Promise<TransactionResolution>;
}

export function sameFingerprint(
  a: DiskFingerprint,
  b: DiskFingerprint,
): boolean {
  return (
    a.device === b.device &&
    a.inode === b.inode &&
    a.byteLength === b.byteLength &&
    a.sha256 === b.sha256 &&
    a.modifiedSeconds === b.modifiedSeconds &&
    a.modifiedNanos === b.modifiedNanos &&
    a.changedSeconds === b.changedSeconds &&
    a.changedNanos === b.changedNanos &&
    a.mode === b.mode &&
    a.owner === b.owner &&
    a.links === b.links
  );
}
