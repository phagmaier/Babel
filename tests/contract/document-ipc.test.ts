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
