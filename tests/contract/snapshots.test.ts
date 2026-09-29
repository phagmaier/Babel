import { describe, expect, it, vi } from 'vitest';
import { nativeSnapshots } from '../../src/infrastructure/nativeSnapshots';
import {
  destinationExplanation,
  snapshotPolicy,
} from '../../src/application/snapshots';
import { identity, fingerprint, A } from './persistence-fixtures';
const invoke = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/core', () => ({ invoke }));
describe('path-free snapshot boundary', () => {
  it('dispatches exact envelopes and propagates failures without save credit', async () => {
    const checkpoint = {
      identity,
      version: 21,
      source: [97],
      sourceSha256: A,
      expectedFingerprint: fingerprint(),
      draftMetadata: {},
    };
    const selection = {
      snapshotId: '44444444-4444-4444-8444-444444444444',
      recordSha256: A,
    };
    const cases: [string, unknown, () => Promise<unknown>][] = [
      ['list_snapshots', identity, () => nativeSnapshots.list(identity)],
      [
        'read_snapshot',
        { identity, selection },
        () => nativeSnapshots.read({ identity, selection }),
      ],
      [
        'create_snapshot',
        { checkpoint, kind: 'named', name: 'Name' },
        () =>
          nativeSnapshots.create({ checkpoint, kind: 'named', name: 'Name' }),
      ],
      ['prune_snapshots', identity, () => nativeSnapshots.prune(identity)],
      [
        'restore_snapshot',
        {
          current: checkpoint,
          selection,
          newVersion: 22,
          expectedFingerprint: fingerprint(),
        },
        () =>
          nativeSnapshots.restore({
            current: checkpoint,
            selection,
            newVersion: 22,
            expectedFingerprint: fingerprint(),
          }),
      ],
      [
        'save_external_copy',
        { checkpoint, destinationToken: 'opaque' },
        () => nativeSnapshots.copy({ checkpoint, destinationToken: 'opaque' }),
      ],
    ];
    for (const [command, request, run] of cases) {
      invoke.mockResolvedValueOnce({ test: command });
      expect(await run()).toEqual({ test: command });
      expect(invoke).toHaveBeenLastCalledWith(command, { request });
    }
    const failure = { code: 'snapshotLimit', action: 'retry' };
    invoke.mockRejectedValueOnce(failure);
    await expect(
      nativeSnapshots.create({ checkpoint, kind: 'named', name: 'Name' }),
    ).rejects.toBe(failure);
  });
  it('documents protected cap and conservative same-disk facts', () => {
    expect(snapshotPolicy).toContain('256 MiB');
    expect(snapshotPolicy).toContain('without deleting protected');
    expect(
      destinationExplanation({ token: 'a', storageRelation: 'sameFilesystem' }),
    ).toContain('does not protect');
    expect(
      destinationExplanation({
        token: 'b',
        storageRelation: 'unknownPhysicalDisk',
      }),
    ).toContain('has not been verified');
  });
});
