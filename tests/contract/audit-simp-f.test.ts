import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { sameStamp } from '../../src/application/manuscriptProjection';
import { DOCUMENT_ERROR_CODES } from '../../src/application/documents';
import { createEditorState, isCurrent, stampOf } from '../../src/editor/state';
import {
  begin,
  edited,
  initialPersistenceState,
  rejected,
} from '../../src/application/persistenceState';
import { A, opened } from './persistence-fixtures';

it('matches only identical session, version and immutable document identities', () => {
  const state = createEditorState(new TextEncoder().encode('!Draft.\n'));
  const stamp = stampOf(state);
  expect(sameStamp(stamp, { ...stamp })).toBe(true);
  expect(isCurrent(state, stamp)).toBe(true);
  const other = createEditorState(new TextEncoder().encode('!Draft.\n'));
  for (const changed of [
    { ...stamp, session: {} },
    { ...stamp, version: stamp.version + 1 },
    { ...stamp, doc: other.doc },
  ]) {
    expect(sameStamp(stamp, changed)).toBe(false);
    expect(isCurrent(state, changed)).toBe(false);
  }
  const selected = state.apply(
    state.tr.setSelection(TextSelection.create(state.doc, 2)),
  );
  expect(selected.doc).toBe(state.doc);
  expect(isCurrent(selected, stamp)).toBe(false);
});
it('refuses a foreign document before reading production origin and still rejects a matching raw state', () => {
  const state = createEditorState(new TextEncoder().encode('!Draft.\n'));
  const raw = EditorState.create({ schema: state.schema });
  expect(isCurrent(raw, stampOf(state))).toBe(false);
  expect(() => stampOf(raw)).toThrow('Expected a production screenplay');
  expect(() => isCurrent(raw, { ...stampOf(state), doc: raw.doc })).toThrow(
    'Expected a production screenplay',
  );
});
it('keeps the single TypeScript error-code list in exact parity with the native enum', () => {
  const rust = readFileSync(
    'crates/screenwriter-core/src/documents/mod.rs',
    'utf8',
  );
  const body = rust.match(/pub enum ErrorCode \{([^}]+)\}/)![1]!;
  const native = [...body.matchAll(/\b([A-Z][a-zA-Z]+),/g)].map(
    ([, name]) => name![0]!.toLowerCase() + name!.slice(1),
  );
  expect(native).toHaveLength(31);
  expect(new Set(DOCUMENT_ERROR_CODES).size).toBe(31);
  expect([...DOCUMENT_ERROR_CODES].sort()).toEqual(native.sort());
});
it('retains newly listed structured codes and replacement evidence while unknown codes and invalid actions fail closed', () => {
  const source = begin(
    edited(initialPersistenceState(opened()), 21, A, 1),
    'sourceFile',
  );
  const failure = (code: string, action = 'retry') => ({
    identity: source.state.identity,
    version: 21,
    error: { code, action },
    replacement: 'sourceUnchanged',
  });
  for (const code of [
    'exportNeedsAttention',
    'snapshotNeedsAttention',
    'snapshotLimit',
    'invalidSnapshot',
    'invalidDestination',
    'recentNeedsAttention',
    'invalidRecentSelection',
  ]) {
    const state = rejected(source.state, source.operation, failure(code));
    expect(state.failure?.code).toBe(code);
    expect(state.fileBlocked).toBe(false);
    expect(state.fileSavedVersion).toBe(0);
  }
  for (const value of [
    failure('private manuscript text'),
    failure('exportNeedsAttention', 'uploadManuscript'),
  ]) {
    const state = rejected(source.state, source.operation, value);
    expect(state.failure?.code).toBe('nativeUnavailable');
    expect(state.fileBlocked).toBe(true);
  }
});
