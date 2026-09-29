import { beforeEach, expect, it, vi } from 'vitest';
import type {
  DocumentError,
  OpenDocument,
} from '../../src/application/documents';
import { nativeDocuments } from '../../src/infrastructure/nativeDocuments';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/core', () => ({ invoke }));

beforeEach(() => {
  invoke.mockReset();
});

it('passes only opaque identity and returns raw bytes without decoding', async () => {
  const snapshot: OpenDocument = {
    identity: {
      handle: 'handle',
      documentId: 'document',
      sessionId: 'session',
    },
    kind: 'loose',
    persistentIdentity: true,
    ownership: { status: 'viewOnly', reasons: ['unsupportedEncoding'] },
    encoding: 'unsupported',
    source: [239, 187, 191, 32, 255, 13, 10],
    fingerprint: null,
  };
  invoke.mockResolvedValue(snapshot);
  expect(await nativeDocuments.readInitial(snapshot.identity)).toBe(snapshot);
  expect(invoke).toHaveBeenCalledExactlyOnceWith('read_open_document', {
    request: snapshot.identity,
  });
});

it('propagates structured native failure without inventing a source or success', async () => {
  const failure: DocumentError = {
    code: 'identityMismatch',
    action: 'retry',
  };
  invoke.mockRejectedValue(failure);
  await expect(
    nativeDocuments.readInitial({
      handle: 'h',
      documentId: 'd',
      sessionId: 's',
    }),
  ).rejects.toBe(failure);
});

it('relinquishes the exact session and preserves release failure', async () => {
  const identity = { handle: 'h', documentId: 'd', sessionId: 's' };
  invoke.mockResolvedValue(null);
  await nativeDocuments.release(identity);
  expect(invoke).toHaveBeenCalledExactlyOnceWith('release_open_document', {
    request: identity,
  });
  const failure: DocumentError = { code: 'invalidHandle', action: 'retry' };
  invoke.mockRejectedValue(failure);
  await expect(nativeDocuments.release(identity)).rejects.toBe(failure);
});

it('uses a separate native command for explicit risk relinquishment', async () => {
  const identity = { handle: 'h', documentId: 'd', sessionId: 's' };
  invoke.mockResolvedValue(null);
  await nativeDocuments.releaseAtRisk(identity);
  expect(invoke).toHaveBeenCalledExactlyOnceWith(
    'release_open_document_at_risk',
    {
      request: identity,
    },
  );
});

it('sends strict save/checkpoint envelopes through separate commands and preserves protection tags', async () => {
  const { opened, snapshot, receiptFor } =
    await import('./persistence-fixtures');
  const initial = opened();
  const capture = snapshot(21);
  const request = {
    identity: initial.identity,
    version: capture.version,
    source: capture.source,
    sourceSha256: capture.sourceSha256,
    expectedFingerprint: initial.fingerprint!,
    draftMetadata: capture.draftMetadata,
  };
  const saved = receiptFor(21);
  invoke.mockResolvedValue(saved.recovery);
  expect(await nativeDocuments.checkpoint(request)).toBe(saved.recovery);
  expect(invoke).toHaveBeenLastCalledWith('checkpoint_document', { request });
  invoke.mockResolvedValue(saved);
  expect(await nativeDocuments.save(request)).toBe(saved);
  expect(invoke).toHaveBeenLastCalledWith('save_document', { request });
  const failure = {
    identity: initial.identity,
    version: 21,
    error: { code: 'io', action: 'retry' },
    replacement: 'replacedButUnconfirmed',
    recovery: saved.recovery,
  };
  invoke.mockRejectedValue(failure);
  await expect(nativeDocuments.save(request)).rejects.toBe(failure);
});
