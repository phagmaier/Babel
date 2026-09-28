import { beforeEach, expect, it, vi } from 'vitest';
import type { DocumentIdentity } from '../../src/application/documents';
import type { RecoverySelection } from '../../src/application/startupRecovery';
import type {
  CopyReceipt,
  RecoveryComparison,
} from '../../src/application/recoveryChoices';
const invoke = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/core', () => ({ invoke }));
import { nativeRecoveryChoices } from '../../src/infrastructure/nativeRecoveryChoices';

const identity: DocumentIdentity = {
  handle: '11111111-1111-4111-8111-111111111111',
  documentId: '22222222-2222-4222-8222-222222222222',
  sessionId: '33333333-3333-4333-8333-333333333333',
};
const selection: RecoverySelection = {
  documentId: identity.documentId,
  origin: 'current',
  recordSha256: 'a'.repeat(64),
};
const fingerprint = {
  device: '1',
  inode: '2',
  byteLength: 8,
  sha256: 'b'.repeat(64),
  modifiedSeconds: 1,
  modifiedNanos: 0,
  changedSeconds: 1,
  changedNanos: 0,
  mode: 0o100600,
  owner: 1000,
  links: 1,
};
const comparison: RecoveryComparison = {
  identity,
  selection,
  recovery: {
    selection,
    sessionId: identity.sessionId,
    version: 21,
    generation: 2,
    sourceSha256: 'c'.repeat(64),
    byteLength: 8,
    encoding: 'utf8',
  },
  source: {
    status: 'current',
    fingerprint,
    sourceSha256: 'd'.repeat(64),
    byteLength: 8,
    encoding: 'utf8',
  },
  identical: false,
  externalDivergence: false,
  transaction: 'noTransaction',
};

beforeEach(() => {
  invoke.mockReset();
});

it('uses separate path-free choice commands with exact envelopes', async () => {
  invoke.mockResolvedValueOnce(comparison);
  expect(await nativeRecoveryChoices.compare({ identity, selection })).toBe(
    comparison,
  );
  expect(invoke).toHaveBeenLastCalledWith('compare_recovery', {
    request: { identity, selection },
  });

  const receipt = {
    identity,
    version: 22,
    sourceSha256: 'c'.repeat(64),
    fingerprint,
    recovery: {
      identity,
      version: 22,
      sourceSha256: 'c'.repeat(64),
      generation: 3,
      protection: 'recoveryCheckpoint',
    },
    protection: 'sourceFile',
  };
  invoke.mockResolvedValueOnce(receipt);
  expect(
    await nativeRecoveryChoices.recover({
      identity,
      selection,
      newVersion: 22,
      expectedFingerprint: fingerprint,
    }),
  ).toBe(receipt);
  expect(invoke).toHaveBeenLastCalledWith('recover_checkpoint_as_current', {
    request: {
      identity,
      selection,
      newVersion: 22,
      expectedFingerprint: fingerprint,
    },
  });

  invoke.mockResolvedValueOnce(comparison);
  expect(
    await nativeRecoveryChoices.keep({
      identity,
      selection,
      expectedFingerprint: fingerprint,
    }),
  ).toBe(comparison);
  expect(invoke).toHaveBeenLastCalledWith('keep_current_source', {
    request: { identity, selection, expectedFingerprint: fingerprint },
  });

  const copy: CopyReceipt = {
    identity,
    version: 21,
    fileName: 'story.fountain.recovered-x.fountain',
    fingerprint,
    sourceSha256: 'c'.repeat(64),
    byteLength: 8,
  };
  invoke.mockResolvedValueOnce(copy);
  expect(
    await nativeRecoveryChoices.copy({
      identity,
      selection,
      expectedFingerprint: fingerprint,
    }),
  ).toBe(copy);
  expect(invoke).toHaveBeenLastCalledWith('save_recovered_copy', {
    request: { identity, selection, expectedFingerprint: fingerprint },
  });

  const resolved = {
    identity,
    observation: 'noTransaction',
    completed: null,
    previousPreserved: false,
  };
  invoke.mockResolvedValueOnce(resolved);
  expect(await nativeRecoveryChoices.resolve(identity)).toBe(resolved);
  expect(invoke).toHaveBeenLastCalledWith('resolve_save_transaction', {
    request: { identity },
  });
});

it('propagates typed choice failures without inventing success', async () => {
  const failure = { code: 'sourceChanged', action: 'reopenOrSaveCopy' };
  invoke.mockRejectedValueOnce(failure);
  await expect(
    nativeRecoveryChoices.recover({
      identity,
      selection,
      newVersion: 22,
      expectedFingerprint: fingerprint,
    }),
  ).rejects.toBe(failure);
});
