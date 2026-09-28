import { beforeEach, expect, it, vi } from 'vitest';
import type {
  RecoveryCatalog,
  RecoveryPreview,
  RecoverySelection,
} from '../../src/application/startupRecovery';
const invoke = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/core', () => ({ invoke }));
import { nativeRecovery } from '../../src/infrastructure/nativeRecovery';
beforeEach(() => invoke.mockReset());
it('uses separate path-free read-only commands and preserves exact values/rejection', async () => {
  const catalog: RecoveryCatalog = {
    entries: [],
    truncated: true,
    unrecognizedArtifacts: 1,
  };
  invoke.mockResolvedValueOnce(catalog);
  expect(await nativeRecovery.list()).toBe(catalog);
  expect(invoke).toHaveBeenLastCalledWith('list_local_recovery', {
    request: {},
  });
  const selection: RecoverySelection = {
    documentId: '11111111-1111-4111-8111-111111111111',
    origin: 'previous',
    recordSha256: 'a'.repeat(64),
  };
  const candidate = {
    selection,
    sessionId: '22222222-2222-4222-8222-222222222222',
    version: 21,
    generation: 1,
    sourceSha256: 'b'.repeat(64),
    byteLength: 4,
    encoding: 'unsupported' as const,
  };
  const preview: RecoveryPreview = {
    candidate,
    source: [0, 255, 13, 10],
    metadata: {
      documentId: selection.documentId,
      sessionId: candidate.sessionId,
      version: 21,
      generation: 1,
      sourceSha256: candidate.sourceSha256,
      baseFingerprint: null,
      draftMetadata: { unknown: true },
    },
  };
  invoke.mockResolvedValueOnce(preview);
  expect(await nativeRecovery.preview(selection)).toBe(preview);
  expect(invoke).toHaveBeenLastCalledWith('read_local_recovery', {
    request: selection,
  });
  const error = { code: 'recoveryNeedsAttention', action: 'reopenOrSaveCopy' };
  invoke.mockRejectedValueOnce(error);
  await expect(nativeRecovery.preview(selection)).rejects.toBe(error);
});

it('bounds text preview without corrupting a UTF-8 character split at the display limit', async () => {
  const { displayPreview } =
    await import('../../src/application/startupRecovery');
  const source = Array.from(new TextEncoder().encode('a'.repeat(65535) + 'éz'));
  const selection: RecoverySelection = {
    documentId: '11111111-1111-4111-8111-111111111111',
    origin: 'current',
    recordSha256: 'a'.repeat(64),
  };
  const candidate = {
    selection,
    sessionId: '22222222-2222-4222-8222-222222222222',
    version: 21,
    generation: 1,
    sourceSha256: 'b'.repeat(64),
    byteLength: source.length,
    encoding: 'utf8' as const,
  };
  const result: RecoveryPreview = {
    candidate,
    source,
    metadata: {
      documentId: selection.documentId,
      sessionId: candidate.sessionId,
      version: 21,
      generation: 1,
      sourceSha256: candidate.sourceSha256,
      baseFingerprint: null,
      draftMetadata: {},
    },
  };
  const displayed = displayPreview(result);
  expect(displayed.truncated).toBe(true);
  expect(displayed.text).toBe('a'.repeat(65535));
  expect(displayed.hex).toBe(false);
  expect(result.source).toEqual(source);
});
