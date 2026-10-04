/** Read-only discovery/inspection. These values confer no source-save or adoption authority. */
import type {
  DocumentError,
  DocumentIdentity,
  OpenDocument,
  DiskFingerprint,
  JsonValue,
} from './documents';

export type RecoveryOrigin =
  'current' | 'previous' | 'pending' | 'previousPending';
export interface RecoverySelection {
  documentId: string;
  origin: RecoveryOrigin;
  recordSha256: string;
}
export interface RecoveryCandidate {
  selection: RecoverySelection;
  sessionId: string;
  version: number;
  generation: number;
  sourceSha256: string;
  byteLength: number;
  encoding: 'utf8' | 'unsupported';
}
export type RecoveryNotice =
  | 'truncatedTail'
  | 'corruptTail'
  | 'unsupportedSchema'
  | 'tooLarge'
  | 'pending'
  | 'quarantined'
  | 'conflictingGeneration'
  | 'unreadableArtifact';
export interface RecoveryEntry {
  documentId: string;
  /** Native journal admission only; absent readers never imply acceptance. */
  reconciled?: boolean;
  candidates: readonly RecoveryCandidate[];
  notices: readonly RecoveryNotice[];
  error: DocumentError | null;
}
export interface RecoveryCatalog {
  entries: readonly RecoveryEntry[];
  truncated: boolean;
  unrecognizedArtifacts: number;
}
export interface RecoveryPreview {
  candidate: RecoveryCandidate;
  metadata: {
    documentId: string;
    sessionId: string;
    version: number;
    generation: number;
    sourceSha256: string;
    baseFingerprint: DiskFingerprint | null;
    draftMetadata: JsonValue;
  };
  source: readonly number[];
}
export interface RecoveryPort {
  list(): Promise<RecoveryCatalog>;
  preview(selection: RecoverySelection): Promise<RecoveryPreview>;
  inspect(identity: DocumentIdentity): Promise<RecoveryEntry>;
  previewSelected(request: {
    identity: DocumentIdentity;
    selection: RecoverySelection;
  }): Promise<RecoveryPreview>;
  resume(
    selection: RecoverySelection,
  ): Promise<{ document: OpenDocument; draftMetadata: JsonValue }>;
}
export const unavailableRecovery: RecoveryPort = {
  inspect: async () => {
    throw { code: 'nativeUnavailable', action: 'retry' };
  },
  previewSelected: async () => {
    throw { code: 'nativeUnavailable', action: 'retry' };
  },
  resume: async () => {
    throw { code: 'nativeUnavailable', action: 'retry' };
  },
  list: async () => {
    throw { code: 'nativeUnavailable', action: 'retry' };
  },
  preview: async () => {
    throw { code: 'nativeUnavailable', action: 'retry' };
  },
};

export function sameSelection(
  a: RecoverySelection,
  b: RecoverySelection,
): boolean {
  return (
    a.documentId === b.documentId &&
    a.origin === b.origin &&
    a.recordSha256 === b.recordSha256
  );
}
/** Display is bounded; bytes remain immutable and are never sent back as a replacement. */
export function displayPreview(preview: RecoveryPreview): {
  text: string;
  truncated: boolean;
  hex: boolean;
} {
  const hex = preview.candidate.encoding !== 'utf8';
  const limit = hex ? 4096 : 64 * 1024;
  const bytes = Uint8Array.from(preview.source.slice(0, limit));
  const truncated = preview.source.length > limit;
  return {
    text: hex
      ? Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ')
      : new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
          bytes,
          { stream: truncated },
        ),
    truncated,
    hex,
  };
}
