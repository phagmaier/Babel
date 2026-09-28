/** M2-01 headless boundary; source is immutable initial bytes, not editor state. */
export interface DocumentIdentity {
  handle: string;
  documentId: string;
  sessionId: string;
}

export type ViewReason =
  | 'readOnly'
  | 'unsafePermissions'
  | 'unsupportedEncoding'
  | 'hardLinked'
  | 'foreignOwner'
  | 'alreadyOwned'
  | 'identityUnavailable'
  | 'unknownProjectSchema'
  | 'invalidProjectMetadata'
  | 'sourceMappingMismatch';

export interface DiskFingerprint {
  device: string;
  inode: string;
  byteLength: number;
  sha256: string;
  modifiedSeconds: number;
  modifiedNanos: number;
  changedSeconds: number;
  changedNanos: number;
  mode: number;
  owner: number;
  links: number;
}

export interface OpenDocument {
  identity: DocumentIdentity;
  kind: 'managed' | 'loose' | 'unsaved';
  persistentIdentity: boolean;
  ownership:
    { status: 'exclusive' } | { status: 'viewOnly'; reasons: ViewReason[] };
  encoding: 'utf8' | 'unsupported';
  source: readonly number[];
  fingerprint: DiskFingerprint | null;
}

export interface DocumentError {
  code:
    | 'missingSource'
    | 'permissionDenied'
    | 'unsafePath'
    | 'notRegularFile'
    | 'sourceTooLarge'
    | 'sourceChanged'
    | 'identityStoreUnavailable'
    | 'invalidHandle'
    | 'identityMismatch'
    | 'ownershipRequired'
    | 'ownershipLost'
    | 'tooManyDocuments'
    | 'nativeUnavailable'
    | 'recoveryNeedsAttention'
    | 'invalidCheckpoint'
    | 'staleRecoveryVersion'
    | 'checkpointConflict'
    | 'invalidSave'
    | 'staleSaveVersion'
    | 'saveConflict'
    | 'saveQueueFull'
    | 'saveNeedsAttention'
    | 'io';
  action: 'selectSourceAgain' | 'reopenOrSaveCopy' | 'retry';
}

/** Native selection is intentionally absent: UI cannot supply a filesystem path. */
export interface DocumentPort {
  readInitial(identity: DocumentIdentity): Promise<OpenDocument>;
  release(identity: DocumentIdentity): Promise<void>;
  checkpoint(request: CheckpointRequest): Promise<CheckpointReceipt>;
  save(request: SaveRequest): Promise<SaveReceipt>;
}

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export interface CheckpointRequest {
  identity: DocumentIdentity;
  version: number;
  source: readonly number[];
  sourceSha256: string;
  expectedFingerprint: DiskFingerprint | null;
  draftMetadata: JsonValue;
}

export interface SaveRequest extends CheckpointRequest {
  expectedFingerprint: DiskFingerprint;
}

export interface CheckpointReceipt {
  identity: DocumentIdentity;
  version: number;
  sourceSha256: string;
  generation: number;
  protection: 'recoveryCheckpoint';
}

export interface SaveReceipt {
  identity: DocumentIdentity;
  version: number;
  sourceSha256: string;
  fingerprint: DiskFingerprint;
  recovery: CheckpointReceipt;
  protection: 'sourceFile';
}

export interface CheckpointFailure {
  identity: DocumentIdentity;
  version: number;
  error: DocumentError;
}

export interface SaveFailure extends CheckpointFailure {
  replacement: 'sourceUnchanged' | 'replacedButUnconfirmed' | 'outcomeUnknown';
  recovery: CheckpointReceipt | null;
}
