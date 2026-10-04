/** Exact pre-operation protection; never a source-save acknowledgement. */
import type { CheckpointReceipt, CheckpointRequest } from './documents';
import { sameIdentity, validHash } from './persistenceState';

export type WorkflowOperation = 'fountainImport' | 'sceneMove' | 'sectionMove';
export interface WorkflowProtectionRequest {
  operation: WorkflowOperation;
  checkpoint: CheckpointRequest;
}
export interface WorkflowProtectionReceipt {
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

  operation: WorkflowOperation;
  byteLength: number;
}
export interface WorkflowProtectionPort {
  protect(
    request: WorkflowProtectionRequest,
  ): Promise<WorkflowProtectionReceipt>;
}
export type WorkflowResult =
  | { status: 'applied'; protection: WorkflowProtectionReceipt }
  | { status: 'refused'; reason: string };

/** Count the exact moved source span, including attachments/newlines. Fail closed. */
export function requiresMoveProtection(rows: number, bytes: number): boolean {
  if (
    !Number.isSafeInteger(rows) ||
    rows < 1 ||
    !Number.isSafeInteger(bytes) ||
    bytes < 0
  )
    throw new RangeError(
      'Move dimensions are unavailable; protect before moving',
    );
  return rows >= 50 || bytes >= 16 * 1024;
}

export function validateWorkflowReceipt(
  request: WorkflowProtectionRequest,
  receipt: WorkflowProtectionReceipt,
): void {
  const { checkpoint: cp, revision: rev } = receipt;
  const expected = request.checkpoint;
  if (
    receipt.operation !== request.operation ||
    receipt.byteLength !== expected.source.length ||
    !sameIdentity(cp.identity, expected.identity) ||
    cp.version !== expected.version ||
    cp.sourceSha256 !== expected.sourceSha256 ||
    cp.protection !== 'recoveryCheckpoint' ||
    !Number.isSafeInteger(cp.generation) ||
    cp.generation < 1 ||
    rev.documentId !== expected.identity.documentId ||
    rev.version !== expected.version ||
    rev.sourceSha256 !== expected.sourceSha256 ||
    !validHash(rev.profileSha256) ||
    !/^[a-f0-9]{40}$/.test(rev.commitId) ||
    rev.safetyRef !== `refs/safety/${rev.commitId}`
  )
    throw new Error(
      'Protection did not acknowledge this operation and exact draft; retry before applying',
    );
}
