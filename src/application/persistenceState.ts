/** Receipt-driven state only. Immutable snapshots belong to the editor/controller, not this state. */
import type {
  CheckpointReceipt,
  DocumentIdentity,
  DocumentError,
  DiskFingerprint,
  OpenDocument,
  SaveReceipt,
} from './documents';

export type Protection = 'recoveryCheckpoint' | 'sourceFile';
export type PersistenceStatus =
  | 'Unsaved'
  | 'Changes pending'
  | 'Saving'
  | 'Saved locally'
  | 'Recovery protected; file save pending'
  | 'Save failed'
  | 'External change detected'
  | 'Read-only';

export interface Operation {
  readonly id: number;
  readonly protection: Protection;
  readonly version: number;
  readonly sha256: string;
  readonly byteLength: number;
}
export interface PersistenceState {
  readonly identity: DocumentIdentity;
  readonly liveVersion: number;
  readonly liveSha256: string;
  readonly liveByteLength: number;
  readonly journaledVersion: number;
  readonly fileSavedVersion: number;
  readonly journaledSha256: string | null;
  readonly fileSavedSha256: string | null;
  readonly fingerprint: DiskFingerprint | null;
  readonly writable: boolean;
  readonly pending: readonly Operation[];
  readonly completedFileId: number;
  readonly completedRecoveryId: number;
  readonly nextId: number;
  readonly failure: {
    readonly id: number;
    readonly version: number;
    readonly protection: Protection;
    readonly code: DocumentError['code'] | 'invalidReceipt';
  } | null;
  readonly fileBlocked: boolean;
  readonly externalChange: boolean;
}
const EMPTY_SHA256 =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
export const MAX_SOURCE_BYTES = 16 * 1024 * 1024;
export const MAX_DRAFT_METADATA_BYTES = 64 * 1024 - 2048;
export function validHash(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}
function validVersion(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
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
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function identity(value: unknown): value is DocumentIdentity {
  return (
    object(value) &&
    ['handle', 'documentId', 'sessionId'].every(
      (k) => typeof value[k] === 'string',
    )
  );
}
function fingerprint(value: unknown): value is DiskFingerprint {
  return (
    object(value) &&
    ['device', 'inode'].every(
      (k) => typeof value[k] === 'string' && /^\d+$/.test(value[k] as string),
    ) &&
    validHash(value.sha256) &&
    [
      'byteLength',
      'modifiedSeconds',
      'modifiedNanos',
      'changedSeconds',
      'changedNanos',
      'mode',
      'owner',
      'links',
    ].every(
      (k) => typeof value[k] === 'number' && Number.isSafeInteger(value[k]),
    ) &&
    (value.byteLength as number) >= 0 &&
    (value.byteLength as number) <= MAX_SOURCE_BYTES &&
    (value.links as number) === 1 &&
    (value.mode as number) >= 0 &&
    (value.mode as number) <= 0xffffffff &&
    ((value.mode as number) & 0o170000) === 0o100000 &&
    (value.owner as number) >= 0 &&
    (value.owner as number) <= 0xffffffff &&
    ['modifiedNanos', 'changedNanos'].every(
      (k) => (value[k] as number) >= 0 && (value[k] as number) < 1_000_000_000,
    )
  );
}
export function isCheckpointReceipt(
  value: unknown,
): value is CheckpointReceipt {
  return (
    object(value) &&
    value.protection === 'recoveryCheckpoint' &&
    identity(value.identity) &&
    validVersion(value.version) &&
    validVersion(value.generation) &&
    validHash(value.sourceSha256)
  );
}
export function isSaveReceipt(value: unknown): value is SaveReceipt {
  return (
    object(value) &&
    value.protection === 'sourceFile' &&
    identity(value.identity) &&
    validVersion(value.version) &&
    validHash(value.sourceSha256) &&
    fingerprint(value.fingerprint) &&
    value.fingerprint.sha256 === value.sourceSha256 &&
    isCheckpointReceipt(value.recovery) &&
    sameIdentity(value.identity, value.recovery.identity) &&
    value.recovery.version === value.version &&
    value.recovery.sourceSha256 === value.sourceSha256
  );
}
export function initialPersistenceState(
  opened: OpenDocument,
): PersistenceState {
  return {
    identity: { ...opened.identity },
    liveVersion: 0,
    liveSha256: opened.fingerprint?.sha256 ?? EMPTY_SHA256,
    liveByteLength: opened.source.length,
    journaledVersion: 0,
    fileSavedVersion: 0,
    journaledSha256: null,
    fileSavedSha256: opened.fingerprint?.sha256 ?? null,
    fingerprint: opened.fingerprint ? { ...opened.fingerprint } : null,
    writable: opened.ownership.status === 'exclusive',
    pending: [],
    completedFileId: 0,
    completedRecoveryId: 0,
    nextId: 1,
    failure: null,
    fileBlocked: false,
    externalChange: false,
  };
}
export function edited(
  state: PersistenceState,
  version: number,
  sha256: string,
  byteLength: number,
): PersistenceState {
  if (
    !validVersion(version) ||
    version <= state.liveVersion ||
    !validHash(sha256) ||
    !Number.isSafeInteger(byteLength) ||
    byteLength < 0 ||
    byteLength > MAX_SOURCE_BYTES
  )
    throw new Error('Invalid document version/snapshot');
  return {
    ...state,
    liveVersion: version,
    liveSha256: sha256,
    liveByteLength: byteLength,
  };
}
export function begin(
  state: PersistenceState,
  protection: Protection,
): { state: PersistenceState; operation: Operation } {
  if (
    !state.writable ||
    state.liveVersion === 0 ||
    state.pending.length >= 8 ||
    (protection === 'sourceFile' &&
      (!state.fingerprint || state.fileBlocked || state.externalChange))
  )
    throw new Error('Persistence operation unavailable');
  const operation: Operation = Object.freeze({
    id: state.nextId,
    protection,
    version: state.liveVersion,
    sha256: state.liveSha256,
    byteLength: state.liveByteLength,
  });
  return {
    operation,
    state: {
      ...state,
      pending: [...state.pending, operation],
      nextId: state.nextId + 1,
    },
  };
}
function matches(
  state: PersistenceState,
  operation: Operation,
  receipt: CheckpointReceipt | SaveReceipt,
): boolean {
  return (
    sameIdentity(state.identity, receipt.identity) &&
    receipt.version === operation.version &&
    receipt.sourceSha256 === operation.sha256
  );
}
function journal(
  state: PersistenceState,
  receipt: CheckpointReceipt,
): PersistenceState {
  return receipt.version >= state.journaledVersion
    ? {
        ...state,
        journaledVersion: receipt.version,
        journaledSha256: receipt.sourceSha256,
      }
    : state;
}
export function acknowledged(
  state: PersistenceState,
  operation: Operation,
  receipt: unknown,
): PersistenceState {
  if (!state.pending.includes(operation)) return state; // Reference token binds this exact request/session.
  const id = operation.id;
  if (
    object(receipt) &&
    identity(receipt.identity) &&
    !sameIdentity(state.identity, receipt.identity)
  )
    return state;
  const valid =
    operation.protection === 'sourceFile'
      ? isSaveReceipt(receipt)
      : isCheckpointReceipt(receipt);
  if (
    !valid ||
    !(isCheckpointReceipt(receipt) || isSaveReceipt(receipt)) ||
    !matches(state, operation, receipt) ||
    (isSaveReceipt(receipt) &&
      receipt.fingerprint.byteLength !== operation.byteLength)
  ) {
    return failed(state, operation, 'invalidReceipt', undefined, null);
  }
  let next: PersistenceState = {
    ...state,
    pending: state.pending.filter((p) => p !== operation),
  };
  if (isSaveReceipt(receipt)) {
    next = journal(next, receipt.recovery);
    next = {
      ...next,
      completedRecoveryId: Math.max(state.completedRecoveryId, id),
    };
    if (
      receipt.version >= state.fileSavedVersion &&
      id >= state.completedFileId
    ) {
      next = {
        ...next,
        fileSavedVersion: receipt.version,
        fileSavedSha256: receipt.sourceSha256,
        fingerprint: { ...receipt.fingerprint },
        completedFileId: id,
      };
    }
  } else {
    next = journal(next, receipt);
    next = {
      ...next,
      completedRecoveryId: Math.max(state.completedRecoveryId, id),
    };
  }
  if (
    next.failure &&
    next.failure.id <= id &&
    (next.failure.protection === operation.protection ||
      operation.protection === 'sourceFile')
  )
    next = { ...next, failure: null };
  return next;
}
/** Native failures carry no filesystem paths/text. Unknown transport results are conservative. */
export function failed(
  state: PersistenceState,
  operation: Operation,
  code: DocumentError['code'] | 'invalidReceipt',
  replacement:
    'sourceUnchanged' | 'replacedButUnconfirmed' | 'outcomeUnknown' | undefined,
  recovery: unknown,
): PersistenceState {
  if (!state.pending.includes(operation)) return state;
  const id = operation.id;
  let next: PersistenceState = {
    ...state,
    pending: state.pending.filter((p) => p.id !== id),
  };
  if (
    operation.protection === 'sourceFile' &&
    isCheckpointReceipt(recovery) &&
    matches(state, operation, recovery)
  )
    next = journal(next, recovery);
  const completed =
    operation.protection === 'sourceFile'
      ? state.completedFileId
      : state.completedRecoveryId;
  if (id < completed) return next;
  const uncertain =
    operation.protection === 'sourceFile' && replacement !== 'sourceUnchanged';
  next = {
    ...next,
    failure: {
      id,
      version: operation.version,
      protection: operation.protection,
      code,
    },
    fileBlocked: state.fileBlocked || uncertain,
    externalChange:
      state.externalChange ||
      (operation.protection === 'sourceFile' && code === 'sourceChanged'),
  };
  return next;
}
export function persistenceStatus(state: PersistenceState): PersistenceStatus {
  if (!state.writable) return 'Read-only';
  if (state.externalChange) return 'External change detected';
  if (state.fileBlocked) return 'Save failed';
  if (
    state.failure?.version === state.liveVersion &&
    state.failure.protection === 'sourceFile'
  )
    return 'Save failed';
  if (
    state.pending.some(
      (p) => p.protection === 'sourceFile' && p.version === state.liveVersion,
    )
  )
    return 'Saving';
  if (
    state.fingerprint &&
    state.fileSavedVersion === state.liveVersion &&
    state.fileSavedSha256 === state.liveSha256
  )
    return 'Saved locally';
  if (state.failure?.version === state.liveVersion) return 'Save failed';
  if (
    state.liveVersion > 0 &&
    state.journaledVersion === state.liveVersion &&
    state.journaledSha256 === state.liveSha256
  )
    return 'Recovery protected; file save pending';
  return state.fingerprint ? 'Changes pending' : 'Unsaved';
}

const errorCodes: readonly DocumentError['code'][] = [
  'missingSource',
  'permissionDenied',
  'unsafePath',
  'notRegularFile',
  'sourceTooLarge',
  'sourceChanged',
  'identityStoreUnavailable',
  'invalidHandle',
  'identityMismatch',
  'ownershipRequired',
  'ownershipLost',
  'tooManyDocuments',
  'nativeUnavailable',
  'recoveryNeedsAttention',
  'invalidCheckpoint',
  'staleRecoveryVersion',
  'checkpointConflict',
  'invalidSave',
  'staleSaveVersion',
  'saveConflict',
  'saveQueueFull',
  'saveNeedsAttention',
  'historyNeedsAttention',
  'io',
];
/** A response/failure cannot act on a different operation, even when per-session ids repeat. */
export function rejected(
  state: PersistenceState,
  operation: Operation,
  value: unknown,
): PersistenceState {
  if (!state.pending.includes(operation)) return state;
  if (
    object(value) &&
    identity(value.identity) &&
    !sameIdentity(state.identity, value.identity)
  )
    return failed(state, operation, 'invalidReceipt', undefined, null);
  if (
    object(value) &&
    identity(value.identity) &&
    value.version === operation.version &&
    object(value.error) &&
    typeof value.error.code === 'string' &&
    errorCodes.includes(value.error.code as DocumentError['code']) &&
    ['retry', 'reopenOrSaveCopy', 'selectSourceAgain'].includes(
      String(value.error.action),
    )
  ) {
    const replacement =
      value.replacement === 'sourceUnchanged' ||
      value.replacement === 'replacedButUnconfirmed' ||
      value.replacement === 'outcomeUnknown'
        ? value.replacement
        : undefined;
    return failed(
      state,
      operation,
      value.error.code as DocumentError['code'],
      replacement,
      value.recovery,
    );
  }
  return failed(state, operation, 'nativeUnavailable', undefined, null);
}
