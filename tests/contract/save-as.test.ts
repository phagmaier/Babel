import { beforeEach, expect, it, vi } from 'vitest';
import { nativeSaveAs } from '../../src/infrastructure/nativeSaveAs';
import { A, fingerprint, identity, opened } from './persistence-fixtures';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/core', () => ({ invoke }));

beforeEach(() => {
  invoke.mockReset();
});

const target = {
  token: 'opaque-save-token',
  fileName: 'Copy.fountain',
  storageRelation: 'sameFilesystem',
};

const checkpoint = {
  identity,
  version: 21,
  source: [97],
  sourceSha256: A,
  expectedFingerprint: fingerprint(),
  draftMetadata: {},
};

it('selects save destinations without sending a path', async () => {
  invoke.mockResolvedValueOnce(target);
  expect(await nativeSaveAs.selectDestination(identity)).toBe(target);
  expect(invoke).toHaveBeenLastCalledWith('select_save_destination', {
    request: identity,
  });
  invoke.mockResolvedValueOnce(null);
  expect(await nativeSaveAs.selectDestination(identity)).toBeNull();
});

it('publishes Save As copies and returns the fresh registration', async () => {
  const result = {
    document: { ...opened(), identity: { ...identity, handle: 'new' } },
    version: 21,
    sourceSha256: A,
    fileName: 'Copy.fountain',
    storageRelation: 'sameFilesystem',
  };
  invoke.mockResolvedValueOnce(result);
  expect(
    await nativeSaveAs.saveAs({ checkpoint, destinationToken: 'opaque' }),
  ).toBe(result);
  expect(invoke).toHaveBeenLastCalledWith('save_as_copy', {
    request: { checkpoint, destinationToken: 'opaque' },
  });
});

it('propagates refusal without inventing a new identity', async () => {
  invoke.mockRejectedValueOnce({ code: 'invalidDestination', action: 'retry' });
  await expect(
    nativeSaveAs.saveAs({ checkpoint, destinationToken: 'stale' }),
  ).rejects.toEqual({ code: 'invalidDestination', action: 'retry' });
  invoke.mockRejectedValueOnce({ code: 'nativeUnavailable', action: 'retry' });
  await expect(nativeSaveAs.selectDestination(identity)).rejects.toEqual({
    code: 'nativeUnavailable',
    action: 'retry',
  });
});
