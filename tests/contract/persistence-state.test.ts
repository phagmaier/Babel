import { expect, it } from 'vitest';
import {
  acknowledged,
  begin,
  edited,
  failed,
  initialPersistenceState,
  isSaveReceipt,
  persistenceStatus,
  rejected,
  type PersistenceState,
} from '../../src/application/persistenceState';
import { A, B, checkpoint, opened, receipt } from './persistence-fixtures';

it('v21 source acknowledgement advances only v21 while v22 stays dirty', () => {
  let state = edited(initialPersistenceState(opened()), 21, A, 1);
  const save = begin(state, 'sourceFile');
  state = edited(save.state, 22, B, 1);
  state = acknowledged(state, save.operation, receipt(save.operation));
  expect(state.fileSavedVersion).toBe(21);
  expect(state.journaledVersion).toBe(21);
  expect(state.liveVersion).toBe(22);
  expect(persistenceStatus(state)).toBe('Changes pending');
  const next = begin(state, 'sourceFile');
  state = acknowledged(next.state, next.operation, receipt(next.operation));
  expect(persistenceStatus(state)).toBe('Saved locally');
  expect(state.fileSavedVersion).toBe(22);
});
it('a recovery receipt is never a source receipt and a duplicate never mutates another request', () => {
  const state = edited(initialPersistenceState(opened()), 21, A, 1);
  const cp = begin(state, 'recoveryCheckpoint');
  const protectedState = acknowledged(
    cp.state,
    cp.operation,
    checkpoint(cp.operation),
  );
  expect(protectedState.journaledVersion).toBe(21);
  expect(protectedState.fileSavedVersion).toBe(0);
  expect(persistenceStatus(protectedState)).toBe(
    'Recovery protected; file save pending',
  );
  expect(
    acknowledged(protectedState, cp.operation, checkpoint(cp.operation)),
  ).toBe(protectedState);
  const source = begin(protectedState, 'sourceFile');
  const wrong = acknowledged(
    source.state,
    source.operation,
    checkpoint(source.operation),
  );
  expect(wrong.fileSavedVersion).toBe(0);
  expect(persistenceStatus(wrong)).toBe('Save failed');
});
it('old session callbacks cannot act on a new session even when request numbers repeat', () => {
  const old = begin(
    edited(initialPersistenceState(opened()), 21, A, 1),
    'sourceFile',
  );
  const nextOpened = opened();
  nextOpened.identity.sessionId = '44444444-4444-4444-8444-444444444444';
  const fresh = begin(
    edited(initialPersistenceState(nextOpened), 21, A, 1),
    'sourceFile',
  );
  expect(old.operation.id).toBe(fresh.operation.id);
  expect(acknowledged(fresh.state, old.operation, receipt(old.operation))).toBe(
    fresh.state,
  );
  expect(rejected(fresh.state, old.operation, 'transport disappeared')).toBe(
    fresh.state,
  );
  expect(
    acknowledged(fresh.state, fresh.operation, receipt(old.operation)),
  ).toBe(fresh.state);
});
function permutations<T>(items: readonly T[]): T[][] {
  return items.length
    ? items.flatMap((v, i) =>
        permutations(items.filter((_, j) => i !== j)).map((rest) => [
          v,
          ...rest,
        ]),
      )
    : [[]];
}
it('all 24 delivery orders preserve latest source/recovery versions and fingerprint', () => {
  let state = edited(initialPersistenceState(opened()), 21, A, 1);
  const first = begin(state, 'sourceFile');
  const cp1 = begin(first.state, 'recoveryCheckpoint');
  state = edited(cp1.state, 22, B, 1);
  const second = begin(state, 'sourceFile');
  const cp2 = begin(second.state, 'recoveryCheckpoint');
  const messages = [
    { op: first.operation, value: receipt(first.operation) },
    { op: cp1.operation, value: checkpoint(cp1.operation) },
    { op: second.operation, value: receipt(second.operation) },
    { op: cp2.operation, value: checkpoint(cp2.operation) },
  ];
  for (const delivery of permutations(messages)) {
    let actual: PersistenceState = cp2.state;
    for (const m of delivery) actual = acknowledged(actual, m.op, m.value);
    expect(actual.fileSavedVersion).toBe(22);
    expect(actual.journaledVersion).toBe(22);
    expect(actual.fingerprint?.sha256).toBe(B);
    expect(actual.fingerprint?.inode).toBe('32');
    expect(persistenceStatus(actual)).toBe('Saved locally');
  }
});
it('a delayed older failure cannot erase a confirmed newer file or recovery version', () => {
  const old = begin(
    edited(initialPersistenceState(opened()), 21, A, 1),
    'sourceFile',
  );
  const newer = begin(edited(old.state, 22, B, 1), 'sourceFile');
  let state = acknowledged(
    newer.state,
    newer.operation,
    receipt(newer.operation),
  );
  state = failed(
    state,
    old.operation,
    'io',
    'sourceUnchanged',
    checkpoint(old.operation),
  );
  expect(state.failure).toBeNull();
  expect(persistenceStatus(state)).toBe('Saved locally');
  expect(state.journaledVersion).toBe(22);
});
it('uncertain replacement and transport failures freeze file saving while allowing raw recovery', () => {
  for (const replacement of [
    'replacedButUnconfirmed',
    'outcomeUnknown',
    undefined,
  ] as const) {
    const source = begin(
      edited(initialPersistenceState(opened()), 21, A, 1),
      'sourceFile',
    );
    const state = failed(
      source.state,
      source.operation,
      'io',
      replacement,
      checkpoint(source.operation),
    );
    expect(state.fileSavedVersion).toBe(0);
    expect(state.journaledVersion).toBe(21);
    expect(persistenceStatus(state)).toBe('Save failed');
    expect(() => begin(state, 'sourceFile')).toThrow();
    expect(
      begin(edited(state, 22, B, 1), 'recoveryCheckpoint').operation.version,
    ).toBe(22);
  }
});
it('external-change failure preserves both counters and prohibits normal replacement', () => {
  const source = begin(
    edited(initialPersistenceState(opened()), 21, A, 1),
    'sourceFile',
  );
  const state = failed(
    source.state,
    source.operation,
    'sourceChanged',
    'sourceUnchanged',
    checkpoint(source.operation),
  );
  expect(persistenceStatus(state)).toBe('External change detected');
  expect(state.journaledVersion).toBe(21);
  expect(state.fileSavedVersion).toBe(0);
  expect(() => begin(state, 'sourceFile')).toThrow();
  expect(begin(state, 'recoveryCheckpoint').operation.version).toBe(21);
});
it('receipt hash, length, generation, discriminator and nested identity are checked', () => {
  const source = begin(
    edited(initialPersistenceState(opened()), 21, A, 1),
    'sourceFile',
  );
  const good = receipt(source.operation);
  expect(isSaveReceipt(good)).toBe(true);
  for (const bad of [
    { ...good, sourceSha256: B },
    { ...good, fingerprint: { ...good.fingerprint, byteLength: 2 } },
    { ...good, recovery: { ...good.recovery, generation: 0 } },
    {
      ...good,
      recovery: {
        ...good.recovery,
        identity: { ...good.identity, sessionId: 'other' },
      },
    },
    { ...good, version: 22 },
    { ...good, fingerprint: { ...good.fingerprint, sha256: B } },
    { ...good, fingerprint: { ...good.fingerprint, owner: -1 } },
    { ...good, fingerprint: { ...good.fingerprint, modifiedNanos: 1e9 } },
  ]) {
    const state = acknowledged(source.state, source.operation, bad);
    expect(state.fileSavedVersion).toBe(0);
    expect(persistenceStatus(state)).toBe('Save failed');
  }
});
it('only known structured errors are retained; arbitrary transport text never becomes a status detail', () => {
  const source = begin(
    edited(initialPersistenceState(opened()), 21, A, 1),
    'sourceFile',
  );
  const bad = {
    identity: source.state.identity,
    version: 21,
    error: { code: 'private manuscript text', action: 'retry' },
    replacement: 'sourceUnchanged',
  };
  const state = rejected(source.state, source.operation, bad);
  expect(state.failure?.code).toBe('nativeUnavailable');
  expect(state.fileBlocked).toBe(true);
});
it('named initial state, unsaved drafts, read-only state and version bounds are explicit', () => {
  expect(persistenceStatus(initialPersistenceState(opened()))).toBe(
    'Saved locally',
  );
  const unsaved = opened();
  unsaved.kind = 'unsaved';
  unsaved.source = [];
  unsaved.fingerprint = null;
  expect(persistenceStatus(initialPersistenceState(unsaved))).toBe('Unsaved');
  const readOnly = opened();
  readOnly.ownership = { status: 'viewOnly', reasons: ['readOnly'] };
  const state = initialPersistenceState(readOnly);
  expect(persistenceStatus(state)).toBe('Read-only');
  expect(() => begin(edited(state, 1, A, 1), 'sourceFile')).toThrow();
  expect(() => edited(state, Number.MAX_SAFE_INTEGER + 1, A, 1)).toThrow();
  expect(() => edited(edited(state, 1, A, 1), 1, A, 1)).toThrow();
});
