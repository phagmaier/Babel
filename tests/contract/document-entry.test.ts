import { expect, it, vi, beforeEach } from 'vitest';
import { nativeDocumentEntry } from '../../src/infrastructure/nativeDocumentEntry';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/core', () => ({ invoke }));

beforeEach(() => {
  invoke.mockReset();
});

const identity = {
  handle: 'h',
  documentId: 'd',
  sessionId: 's',
};

const unsaved = {
  identity,
  kind: 'unsaved',
  persistentIdentity: false,
  ownership: { status: 'exclusive' },
  encoding: 'utf8',
  source: [],
  fingerprint: null,
};

it('creates unsaved drafts through a path-free command', async () => {
  invoke.mockResolvedValue(unsaved);
  expect(await nativeDocumentEntry.createUnsaved()).toBe(unsaved);
  expect(invoke).toHaveBeenCalledExactlyOnceWith('create_unsaved_draft', {
    request: {},
  });
});

it('opens picker-selected sources and reports cancel as null', async () => {
  invoke.mockResolvedValueOnce({ ...unsaved, kind: 'loose' });
  expect(await nativeDocumentEntry.openViaPicker()).toEqual({
    ...unsaved,
    kind: 'loose',
  });
  expect(invoke).toHaveBeenLastCalledWith('open_source_via_picker', {
    request: {},
  });
  invoke.mockResolvedValueOnce(null);
  expect(await nativeDocumentEntry.openViaPicker()).toBeNull();
});

it('selects session-bound destinations and reports cancel as null', async () => {
  const destination = {
    token: 'opaque-native',
    storageRelation: 'sameFilesystem',
  };
  invoke.mockResolvedValueOnce(destination);
  expect(await nativeDocumentEntry.selectDestination(identity)).toBe(
    destination,
  );
  expect(invoke).toHaveBeenLastCalledWith('select_destination', {
    request: identity,
  });
  invoke.mockResolvedValueOnce(null);
  expect(await nativeDocumentEntry.selectDestination(identity)).toBeNull();
});

it('propagates structured native failure without inventing a manuscript', async () => {
  const failure = { code: 'nativeUnavailable', action: 'retry' };
  invoke.mockRejectedValueOnce(failure);
  await expect(nativeDocumentEntry.createUnsaved()).rejects.toBe(failure);
  invoke.mockRejectedValueOnce({ code: 'tooManyDocuments', action: 'retry' });
  await expect(nativeDocumentEntry.openViaPicker()).rejects.toEqual({
    code: 'tooManyDocuments',
    action: 'retry',
  });
  invoke.mockRejectedValueOnce({ code: 'identityMismatch', action: 'retry' });
  await expect(nativeDocumentEntry.selectDestination(identity)).rejects.toEqual(
    {
      code: 'identityMismatch',
      action: 'retry',
    },
  );
});
