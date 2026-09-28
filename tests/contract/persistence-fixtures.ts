import type {
  CheckpointReceipt,
  DiskFingerprint,
  OpenDocument,
  SaveReceipt,
} from '../../src/application/documents';
import type { CapturedSnapshot } from '../../src/application/persistenceController';
import type { Operation } from '../../src/application/persistenceState';
// Independently known SHA-256 values for single ASCII bytes a/b.
export const A =
  'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb';
export const B =
  '3e23e8160039594a33894f6564e1b1348bbd7a0088d42c4acb73eeaed59c009d';
export const identity = {
  handle: '11111111-1111-4111-8111-111111111111',
  documentId: '22222222-2222-4222-8222-222222222222',
  sessionId: '33333333-3333-4333-8333-333333333333',
};
export function fingerprint(version = 0, hash = A): DiskFingerprint {
  return {
    device: '1',
    inode: String(10 + version),
    byteLength: 1,
    sha256: hash,
    modifiedSeconds: 1,
    modifiedNanos: 0,
    changedSeconds: 1,
    changedNanos: 0,
    mode: 0o100640,
    owner: 1000,
    links: 1,
  };
}
export function opened(): OpenDocument {
  return {
    identity: { ...identity },
    kind: 'loose',
    persistentIdentity: true,
    ownership: { status: 'exclusive' },
    encoding: 'utf8',
    source: [97],
    fingerprint: fingerprint(),
  };
}
export function snapshot(version = 21, second = false): CapturedSnapshot {
  return {
    version,
    source: [second ? 98 : 97],
    sourceSha256: second ? B : A,
    draftMetadata: { unknown: { keep: true }, emptyBlock: 'character' },
  };
}
export function checkpoint(operation: Operation): CheckpointReceipt {
  return {
    identity: { ...identity },
    version: operation.version,
    sourceSha256: operation.sha256,
    generation: operation.version,
    protection: 'recoveryCheckpoint',
  };
}
export function receipt(operation: Operation): SaveReceipt {
  return {
    identity: { ...identity },
    version: operation.version,
    sourceSha256: operation.sha256,
    fingerprint: fingerprint(operation.version, operation.sha256),
    recovery: checkpoint(operation),
    protection: 'sourceFile',
  };
}
export function receiptFor(version: number, second = false): SaveReceipt {
  return receipt({
    id: 1,
    protection: 'sourceFile',
    version,
    sha256: second ? B : A,
    byteLength: 1,
  });
}
