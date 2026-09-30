import { beforeEach, expect, it, vi } from 'vitest';
import { nativeRecentProjects } from '../../src/infrastructure/nativeRecentProjects';
const invoke = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/core', () => ({ invoke }));
beforeEach(() => invoke.mockReset());

it('lists only native summaries and preserves attention/unknown states', async () => {
  const result = {
    health: 'needsAttention',
    entries: [{ entryId: 'native', availability: 'unknown' }],
  };
  invoke.mockResolvedValue(result);
  expect(await nativeRecentProjects.list()).toBe(result);
  expect(invoke).toHaveBeenCalledExactlyOnceWith('list_recent_projects', {
    request: {},
  });
});
it('selects and removes opaque entries without filesystem paths', async () => {
  invoke.mockResolvedValueOnce({
    document: { source: [0, 255] },
    registryHealth: 'needsAttention',
  });
  expect(await nativeRecentProjects.open('entry')).toEqual({
    document: { source: [0, 255] },
    registryHealth: 'needsAttention',
  });
  expect(invoke).toHaveBeenLastCalledWith('open_recent_project', {
    request: { entryId: 'entry' },
  });
  invoke.mockResolvedValueOnce(undefined);
  await nativeRecentProjects.remove('entry');
  expect(invoke).toHaveBeenLastCalledWith('remove_recent_project', {
    request: { entryId: 'entry' },
  });
});
it('retains cancellation and requires explicit choice after native selection', async () => {
  invoke.mockResolvedValueOnce(null);
  expect(await nativeRecentProjects.locate('entry')).toBeNull();
  expect(invoke).toHaveBeenLastCalledWith('locate_recent_project', {
    request: { entryId: 'entry' },
  });
  const selection = {
    entryId: 'entry',
    selectionToken: 'native-token',
    fileName: 'moved.fountain',
    sameManagedIdentity: false,
    contentMatchesLastKnown: false,
    canLinkMoved: true,
  };
  for (const choice of ['linkMoved', 'openDifferent'] as const) {
    invoke.mockResolvedValueOnce({ document: {}, registryHealth: 'ready' });
    await nativeRecentProjects.confirmLocation(selection, choice);
    expect(invoke).toHaveBeenLastCalledWith('confirm_recent_location', {
      request: { entryId: 'entry', selectionToken: 'native-token', choice },
    });
  }
});
it('does not convert registry, identity, permission or source errors into success', async () => {
  const failure = { code: 'recentNeedsAttention', action: 'retry' };
  for (const operation of [
    () => nativeRecentProjects.list(),
    () => nativeRecentProjects.open('entry'),
    () => nativeRecentProjects.remove('entry'),
    () => nativeRecentProjects.locate('entry'),
  ]) {
    invoke.mockRejectedValueOnce(failure);
    await expect(operation()).rejects.toBe(failure);
  }
});
